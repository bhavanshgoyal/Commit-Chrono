"""
bot/queue_manager.py
File-system queue management for queue/pending/ and queue/used/.

Queue layout:
  queue/pending/
      myfile.py              ← content file the user dropped in
      myfile.py.meta.json    ← routing + scheduling metadata sidecar

Routing is data-driven (in meta.json), NOT directory-driven.
The flat queue/pending/ folder holds items for ALL schedules.
Items are filtered to a schedule via meta.scheduleId.

Updated .meta.json schema (all fields):
{
  "priority":        "high" | "normal" | "low",
  "addedAt":         "<ISO 8601>",
  "notEligibleUntil": null | "<ISO 8601>",
  "dependsOn":       null | "<filename>",
  "held":            false,
  "lastSkippedAt":   null | "<ISO 8601>",
  "type":            "general" | "feature" | "fix" | "refactor" | "docs" | "test" | "chore",
  "scheduleId":      null | "<schedule id>",
  "targetRepo":      null | "owner/repo",
  "targetPath":      null | "path/within/repo/"
}
"""
import os
import json
import shutil
import zoneinfo
from datetime import datetime, timedelta

from bot.utils import getCurrentDateTime, writeMetaFile

QUEUE_DIR = "queue/pending"
USED_DIR  = "queue/used"

# Files in queue/pending/ that are control signals, not content
_SKIP_EXTENSIONS = (".meta.json", ".flag")
_SKIP_NAMES      = {".gitkeep"}
_SKIP_PREFIXES   = ("abort-", "resolve-")


def _isContentFile(name: str) -> bool:
    if name in _SKIP_NAMES:
        return False
    if any(name.endswith(ext) for ext in _SKIP_EXTENSIONS):
        return False
    if any(name.startswith(pfx) for pfx in _SKIP_PREFIXES):
        return False
    return True


def _defaultMeta() -> dict:
    return {
        "priority":         "normal",
        "addedAt":          getCurrentDateTime().isoformat(),
        "notEligibleUntil": None,
        "dependsOn":        None,
        "held":             False,
        "lastSkippedAt":    None,
        "type":             "general",
        "scheduleId":       None,
        "targetRepo":       None,
        "targetPath":       None,
    }


def listPendingItems(schedule_id: str | None = None) -> list:
    """
    Scans queue/pending/, returns a list of item dicts.
    If schedule_id is given, only returns items whose meta.scheduleId matches
    OR items with meta.scheduleId == null (unassigned items visible to all schedules).
    Auto-creates a default .meta.json sidecar for any content file that lacks one.
    """
    items = []
    if not os.path.exists(QUEUE_DIR):
        return items

    for file_name in sorted(os.listdir(QUEUE_DIR)):
        if not _isContentFile(file_name):
            continue

        content_path = os.path.join(QUEUE_DIR, file_name)
        meta_path    = f"{content_path}.meta.json"

        meta = _defaultMeta()

        if os.path.exists(meta_path):
            try:
                with open(meta_path, "r") as f:
                    loaded = json.load(f)
                meta.update(loaded)      # overlay loaded values onto defaults
            except Exception as e:
                print(f"⚠️  Error reading meta for '{file_name}': {e}. Using defaults.")
        else:
            # Auto-create sidecar so the item is trackable from first scan
            writeMetaFile(meta_path, meta)

        # Filter by scheduleId: include if unassigned (None) or matching
        item_sid = meta.get("scheduleId")
        if schedule_id and item_sid and item_sid != schedule_id:
            continue

        items.append({
            "filename":    file_name,
            "contentPath": content_path,
            "metaPath":    meta_path,
            "meta":        meta,
        })

    return items


def getNextQueueItem(items: list, now_dt: datetime) -> dict | None:
    """
    Filters eligible items and returns the highest-priority one.

    Eligibility rules (all must pass):
      1. meta.held == False
      2. meta.notEligibleUntil is null OR <= now_dt
      3. meta.dependsOn is null OR the named file no longer exists in pending/

    Within each priority tier (high → normal → low):
      Sort by lastSkippedAt ?? addedAt, ascending.
      Items skipped recently (lastSkippedAt set) sort after non-skipped items.
    """
    eligible = []

    for item in items:
        meta = item["meta"]

        # Rule 1: held
        if meta.get("held", False):
            continue

        # Rule 2: not-eligible-until
        not_until = meta.get("notEligibleUntil")
        if not_until:
            not_until_dt = datetime.fromisoformat(not_until)
            if not_until_dt.tzinfo is None:
                not_until_dt = not_until_dt.replace(tzinfo=zoneinfo.ZoneInfo("UTC"))
            if not_until_dt > now_dt:
                continue

        # Rule 3: dependency
        depends_on = meta.get("dependsOn")
        if depends_on:
            dep_exists = any(i["filename"] == depends_on for i in items)
            if dep_exists:
                continue

        eligible.append(item)

    if not eligible:
        return None

    def sort_key(x):
        m = x["meta"]
        key_str = m.get("lastSkippedAt") or m.get("addedAt")
        if key_str:
            dt = datetime.fromisoformat(key_str)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=zoneinfo.ZoneInfo("UTC"))
            return dt
        return datetime.min.replace(tzinfo=zoneinfo.ZoneInfo("UTC"))

    for tier in ["high", "normal", "low"]:
        tier_items = [i for i in eligible if i["meta"].get("priority") == tier]
        if tier_items:
            tier_items.sort(key=sort_key)
            return tier_items[0]

    return None


def applyQueueItem(item: dict, schedule: dict) -> str:
    """
    Copies the item's content file into the local repository for 'self' mode.
    Target path resolution order:
      1. item.meta.targetPath  (per-item override, full path)
      2. schedule.targetPath   (schedule-level base directory)
      3. Fallback: "src/"
    Returns the destination path that was written.
    """
    item_target = item["meta"].get("targetPath")
    base_target = schedule.get("targetPath", "src/")

    if item_target:
        # If it looks like a directory (ends with /), append filename
        if item_target.endswith("/"):
            target_dir  = item_target
            target_path = os.path.join(target_dir, item["filename"])
        else:
            target_path = item_target
    else:
        target_dir  = base_target
        target_path = os.path.join(target_dir, item["filename"])

    os.makedirs(os.path.dirname(os.path.abspath(target_path)), exist_ok=True)
    shutil.copy2(item["contentPath"], target_path)
    print(f"📦 Applied '{item['filename']}' → '{target_path}'")
    return target_path


def markItemUsed(item: dict) -> None:
    """
    Moves both the content file and its .meta.json sidecar from
    queue/pending/ to queue/used/, stamping usedAt in the meta.
    """
    os.makedirs(USED_DIR, exist_ok=True)

    meta = item["meta"]
    meta["usedAt"] = getCurrentDateTime().isoformat()
    writeMetaFile(item["metaPath"], meta)

    content_dest = os.path.join(USED_DIR, item["filename"])
    meta_dest    = os.path.join(USED_DIR, f"{item['filename']}.meta.json")

    shutil.move(item["contentPath"], content_dest)
    shutil.move(item["metaPath"],    meta_dest)
    print(f"✅ Moved '{item['filename']}' to used/")


def findItemByName(name: str, queue_dir: str = QUEUE_DIR) -> dict | None:
    """Looks up a specific item in pending by filename. Returns None if not found."""
    content_path = os.path.join(queue_dir, name)
    meta_path    = f"{content_path}.meta.json"
    if not os.path.exists(content_path):
        return None
    meta = _defaultMeta()
    if os.path.exists(meta_path):
        with open(meta_path, "r") as f:
            meta.update(json.load(f))
    return {"filename": name, "contentPath": content_path, "metaPath": meta_path, "meta": meta}


def maxAddedAtInTier(priority: str) -> datetime:
    """
    Returns the maximum addedAt datetime among all pending items in the given
    priority tier. Used by resolveReschedule's push-to-end choice.
    Falls back to now() if no items exist in that tier.
    """
    items = listPendingItems()
    tier_items = [i for i in items if i["meta"].get("priority") == priority]
    if not tier_items:
        return getCurrentDateTime()

    def to_dt(i):
        dt = datetime.fromisoformat(i["meta"]["addedAt"])
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=zoneinfo.ZoneInfo("UTC"))
        return dt

    return max(to_dt(i) for i in tier_items)
