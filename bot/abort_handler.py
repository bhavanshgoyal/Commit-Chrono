"""
bot/abort_handler.py
Abort flag detection, abort behavior modes, and post-skip reschedule resolution.

Abort flag filename convention:
    queue/pending/abort-<scheduleId>-<urlSafeSlotId>.flag
    e.g.: abort-my-portfolio-2026-07-27T09-00-00-05-30.flag

Reschedule resolution signal file convention:
    queue/pending/resolve-<itemFilename>.json
    e.g.: resolve-day3.py.json
    Contents: { "choice": "after-x-days", "target": 5 }

abortBehavior modes:
    "auto-retry"    → item stays in pending unchanged, picked up next cycle
    "require-rearm" → item.meta.held = true, invisible until manually reset
    "skip-to-next"  → item.meta.lastSkippedAt = now, next eligible item used this cycle

resolveReschedule choices:
    "retry-next-cycle"      → no metadata change
    "push-to-end"           → addedAt = max(tier addedAt) + 1ms
    "after-x-days"          → notEligibleUntil = now + N days
    "after-file-positional" → addedAt = target.addedAt + 1ms
    "after-file-dependency" → dependsOn = target filename
"""
import os
import json
from datetime import datetime, timedelta

from bot.utils import getCurrentDateTime, urlSafe, writeMetaFile


# ── Abort flag helpers ────────────────────────────────────────────────────────

def _flagPath(schedule_id: str, slot_id: str) -> str:
    safe = urlSafe(slot_id)
    return os.path.join("queue", "pending", f"abort-{schedule_id}-{safe}.flag")


def checkAborted(schedule_id: str, slot_id: str | None) -> bool:
    """Returns True if a user-committed abort flag exists for this slot."""
    if not slot_id:
        return False
    return os.path.exists(_flagPath(schedule_id, slot_id))


def clearAbortFlag(schedule_id: str, slot_id: str | None) -> None:
    """Deletes the abort flag file after processing (cleanup)."""
    if not slot_id:
        return
    path = _flagPath(schedule_id, slot_id)
    if os.path.exists(path):
        os.remove(path)
        print(f"🧹 Abort flag cleared: {os.path.basename(path)}")


# ── Abort behavior ────────────────────────────────────────────────────────────

def handleAbort(item: dict | None, schedule: dict, all_items: list, now_dt: datetime) -> dict | None:
    """
    Executes the abort behavior defined in schedule.abortBehavior.

    Returns:
        The substitute item to use in this same cycle (only for "skip-to-next"),
        or None for all other modes.
    """
    behavior = schedule.get("abortBehavior", "auto-retry")

    if item is None:
        print(f"[{schedule['id']}] Abort on empty queue — nothing to rearm or skip.")
        return None

    print(f"[{schedule['id']}] Abort behavior: '{behavior}' for item '{item['filename']}'")

    if behavior == "auto-retry":
        # No metadata change — item stays exactly as-is, picked up next cycle
        pass

    elif behavior == "require-rearm":
        item["meta"]["held"] = True
        writeMetaFile(item["metaPath"], item["meta"])
        from bot.alerts import sendAlert
        sendAlert(
            f"🔒 **[{schedule['id']}]** `{item['filename']}` is now **HELD** after abort.\n"
            f"To re-enable it: set `held: false` in "
            f"`queue/pending/{item['filename']}.meta.json` and commit."
        )
        print(f"[{schedule['id']}] '{item['filename']}' held until manually re-armed.")

    elif behavior == "skip-to-next":
        # Mark the aborted item as recently skipped (deprioritises it within the tier)
        item["meta"]["lastSkippedAt"] = now_dt.isoformat()
        writeMetaFile(item["metaPath"], item["meta"])
        print(f"[{schedule['id']}] '{item['filename']}' deprioritised. Looking for next item...")

        # Re-scan and pick the next eligible item (the skipped item now sorts lower)
        from bot.queue_manager import listPendingItems, getNextQueueItem
        refreshed = listPendingItems(schedule.get("id"))
        substitute = getNextQueueItem(refreshed, now_dt)
        if substitute:
            print(f"[{schedule['id']}] Substitute item: '{substitute['filename']}'")
        else:
            print(f"[{schedule['id']}] No substitute available. Cycle ends.")
        return substitute

    return None


# ── Reschedule resolution ─────────────────────────────────────────────────────

def resolveReschedule(item: dict, resolution_file_path: str, all_items: list) -> None:
    """
    Processes a resolve-<itemName>.json signal file, modifies item metadata
    per the chosen resolution strategy, then deletes the signal file (consumed).

    Valid choices and their effects:
      retry-next-cycle      → no change
      push-to-end           → addedAt = max addedAt in same tier + 1ms
      after-x-days          → notEligibleUntil = now + target (int) days
      after-file-positional → addedAt = target item's addedAt + 1ms
      after-file-dependency → dependsOn = target filename
    """
    from bot.queue_manager import findItemByName, maxAddedAtInTier
    from bot.logger import logRun

    try:
        with open(resolution_file_path, "r") as f:
            resolution = json.load(f)
    except Exception as e:
        print(f"⚠️  Could not read resolution file {resolution_file_path}: {e}")
        return

    choice = resolution.get("choice")
    target = resolution.get("target")
    now    = getCurrentDateTime()

    print(f"[resolve] '{item['filename']}' -> choice='{choice}' target='{target}'")

    if choice == "retry-next-cycle":
        pass  # no metadata change

    elif choice == "push-to-end":
        max_dt = maxAddedAtInTier(item["meta"]["priority"])
        if max_dt.tzinfo is None:
            max_dt = max_dt.replace(tzinfo=__import__("zoneinfo").ZoneInfo("UTC"))
        item["meta"]["addedAt"] = (max_dt + timedelta(milliseconds=1)).isoformat()

    elif choice == "after-x-days":
        item["meta"]["notEligibleUntil"] = (
            now + timedelta(days=int(target))
        ).isoformat()

    elif choice == "after-file-positional":
        target_item = findItemByName(str(target))
        if target_item:
            target_dt = datetime.fromisoformat(target_item["meta"]["addedAt"])
            if target_dt.tzinfo is None:
                target_dt = target_dt.replace(tzinfo=__import__("zoneinfo").ZoneInfo("UTC"))
            item["meta"]["addedAt"] = (target_dt + timedelta(milliseconds=1)).isoformat()
        else:
            print(f"⚠️  after-file-positional: target '{target}' not found in pending/. No change.")

    elif choice == "after-file-dependency":
        item["meta"]["dependsOn"] = str(target)

    else:
        print(f"⚠️  Unknown reschedule choice: '{choice}'. No change made.")
        os.remove(resolution_file_path)
        return

    writeMetaFile(item["metaPath"], item["meta"])
    os.remove(resolution_file_path)     # signal file is consumed

    logRun({
        "status":  "reschedule-resolved",
        "item":    item["filename"],
        "choice":  choice,
        "target":  target,
    })
    print(f"[OK] Reschedule resolved: '{item['filename']}' via '{choice}'")
