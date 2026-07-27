"""
bot/main.py  —  git-drip entry point
Multi-schedule loop that orchestrates every other module.

Run via:
    python -m bot.main              (from repo root)
    python bot/main.py              (also works)

Per-schedule flow (each schedule is fully isolated in its own try/except):
    1.  checkAndNotify()            → T-minus-N Discord alert (if within notify window)
    2.  isSkipDay()                 → exit schedule if today is a skip date
    3.  shouldRunNow()              → exit schedule if outside time window
    4.  checkAborted()              → if abort flag exists, handleAbort() + log + continue
    5.  intensityToCount()          → how many commit cycles to run today
    6.  runOneCommitCycle() × N     → full pipeline: queue → apply → push → mark used

runOneCommitCycle() per-cycle flow:
    1.  listPendingItems()          → scan queue/pending/ filtered by scheduleId
    2.  getNextQueueItem()          → priority/eligibility sort
    3.  Empty queue → log "skipped" and return (NO fallback commit)
    4.  delayWithJitter()           → human-feeling randomised wait
    5.  pickCommitMessage()         → uses item.meta.type, not random category
    6.  mode == "self"  → applyQueueItem() + commitAndPushWithRetry()
        mode == "external" → deployToTarget()
    7.  On success: markItemUsed() + Discord success alert
    8.  On failure: logRun("failure") + Discord failure alert
"""
import os
import sys
import glob
import json
import random
import time
import zoneinfo
from datetime import datetime

from dotenv import load_dotenv

from bot.utils        import getCurrentDateTime, loadConfig
from bot.scheduler    import shouldRunNow, isSkipDay, getCurrentSlotId
from bot.queue_manager import (
    listPendingItems, getNextQueueItem,
    applyQueueItem, markItemUsed,
)
from bot.git_ops      import commitAndPushWithRetry, deployToTarget
from bot.alerts       import sendAlert, checkAndNotify
from bot.logger       import logRun
from bot.abort_handler import (
    checkAborted, clearAbortFlag, handleAbort, resolveReschedule,
)
from bot.intensity    import getIntensity, intensityToCount


# ── Message helpers ───────────────────────────────────────────────────────────

def loadMessages(file_path: str = "messages.json") -> dict:
    """Loads the commit message pools from messages.json."""
    if not os.path.exists(file_path):
        return {"general": ["minor update", "small fix", "tweak"]}
    with open(file_path, "r") as f:
        return json.load(f)


def pickCommitMessage(messages_pool: dict, content_type: str = "general") -> str:
    """
    Picks a random message from the pool matching content_type.
    Falls back to "general" if content_type is not found.
    content_type comes from item.meta.type — NOT a random category.
    """
    pool = messages_pool.get(content_type) or messages_pool.get("general", ["minor update"])
    return random.choice(pool)


# ── Jitter ────────────────────────────────────────────────────────────────────

def delayWithJitter(jitter_minutes: int) -> int:
    """
    Sleeps for a random duration within [0, jitter_minutes * 60] seconds.
    Returns the actual delay in seconds (logged for auditability).
    Note: this sleep consumes GitHub Actions runner minutes on private repos.
    """
    if jitter_minutes <= 0:
        return 0
    delay_s = random.randint(0, jitter_minutes * 60)
    print(f"⏳ Jitter delay: {delay_s}s (max {jitter_minutes * 60}s) [SKIPPED FOR TEST]")
    # time.sleep(delay_s)  <-- Temporarily disabled for live test
    return delay_s


# ── Reschedule resolution scan ────────────────────────────────────────────────

def processResolutions() -> None:
    """
    Scans queue/pending/ for resolve-*.json signal files and processes each.
    Runs once at bot startup, before any schedule cycles.
    """
    all_items = listPendingItems()
    for resolution_file in glob.glob(os.path.join("queue", "pending", "resolve-*.json")):
        # Extract the item filename from the signal filename
        base      = os.path.basename(resolution_file)           # resolve-day3.py.json
        item_name = base[len("resolve-"):-len(".json")]         # day3.py

        target_item = next((i for i in all_items if i["filename"] == item_name), None)
        if target_item:
            resolveReschedule(target_item, resolution_file, all_items)
        else:
            print(f"⚠️  Resolution file '{base}' references unknown item '{item_name}'. Skipping.")


# ── Single commit cycle ───────────────────────────────────────────────────────

def runOneCommitCycle(schedule: dict, messages_pool: dict) -> None:
    """
    Executes one complete queue-item → push cycle for a given schedule.
    Empty queue → logs "skipped", returns immediately (no dummy commit).
    """
    GH_PAT = os.getenv("GH_PAT")
    now    = getCurrentDateTime()
    mode   = schedule.get("mode", "self")

    # 1. Read and filter the queue for this schedule
    items = listPendingItems(schedule.get("id"))
    item  = getNextQueueItem(items, now)

    # 2. Empty queue: skip this cycle entirely
    if item is None:
        print(f"[{schedule['id']}] Queue is empty. Skipping cycle (no dummy commit).")
        logRun({
            "scheduleId":    schedule["id"],
            "status":        "skipped",
            "item":          None,
            "message":       None,
            "jitterSeconds": 0,
            "commitHash":    None,
            "error":         "empty queue",
        })
        return

    # 3. Jitter delay
    jitter_s = delayWithJitter(schedule.get("jitterMinutes", 0))

    # 4. Pick commit message based on item type (not random category)
    msg  = pickCommitMessage(messages_pool, item["meta"].get("type", "general"))
    mode = schedule.get("mode", "self")

    print(f"[{schedule['id']}] -> '{item['filename']}' | mode={mode} | msg='{msg}'")

    # 5. Execute push
    if mode == "self":
        applyQueueItem(item, schedule)
        result = commitAndPushWithRetry(msg)
    else:  # "external"
        if not GH_PAT:
            result = {
                "success": False, "commitHash": None,
                "error": "GH_PAT not set — cannot authenticate external repo clone.",
            }
        else:
            result = deployToTarget(item, GH_PAT, msg, schedule)

    # 6. Log and alert
    status = "success" if result["success"] else "failure"
    logRun({
        "scheduleId":    schedule["id"],
        "status":        status,
        "item":          item["filename"],
        "message":       msg,
        "jitterSeconds": jitter_s,
        "commitHash":    result.get("commitHash"),
        "error":         result.get("error"),
    })

    if result["success"]:
        markItemUsed(item)
        if result.get("commitHash"):
            sendAlert(
                f"✅ **[{schedule['id']}]** Pushed `{item['filename']}` — _{msg}_\n"
                f"Hash: `{result['commitHash'][:7]}`"
            )
        # commitHash == None means "nothing to commit" — no alert needed
    else:
        sendAlert(
            f"❌ **[{schedule['id']}]** Push failed: {result.get('error')}"
        )


# ── Main multi-schedule loop ──────────────────────────────────────────────────

def main() -> None:
    print("=" * 55)
    print("  git-drip bot starting")
    print(f"  {getCurrentDateTime().isoformat()}")
    print("=" * 55)

    load_dotenv()   # reads .env for local runs; no-op in Actions (secrets via env)

    config       = loadConfig("config.json")
    messages_pool = loadMessages("messages.json")
    now          = getCurrentDateTime()

    # Process any pending reschedule resolutions before cycling
    processResolutions()

    schedules = config.get("schedules", [])
    if not schedules:
        print("⚠️  No schedules found in config.json. Exiting.")
        return

    for schedule in schedules:
        schedule_id = schedule.get("id", "unknown")
        print(f"\n{'-' * 45}")
        print(f"  Schedule: {schedule_id}")
        print(f"{'-' * 45}")

        try:
            # ── T-minus-N notification (runs regardless of shouldRunNow) ──
            checkAndNotify(schedule, now)

            # ── Skip-day check ────────────────────────────────────────────
            if isSkipDay(schedule, now):
                print(f"[{schedule_id}] Today is a skip date. Moving on.")
                continue

            # ── Schedule window check ─────────────────────────────────────
            if not shouldRunNow(schedule):
                print(f"[{schedule_id}] Outside scheduled window. Moving on.")
                continue

            # ── Abort flag check ──────────────────────────────────────────
            slot_id = getCurrentSlotId(schedule, now)
            if checkAborted(schedule_id, slot_id):
                print(f"[{schedule_id}] 🚨 Abort flag detected for slot {slot_id}")

                items      = listPendingItems(schedule_id)
                item       = getNextQueueItem(items, now)
                substitute = handleAbort(item, schedule, items, now)
                clearAbortFlag(schedule_id, slot_id)

                logRun({
                    "scheduleId":    schedule_id,
                    "status":        "aborted",
                    "item":          item["filename"] if item else None,
                    "message":       None,
                    "jitterSeconds": 0,
                    "commitHash":    None,
                    "error":         None,
                })

                # skip-to-next mode: run the substitute item this cycle
                if substitute:
                    msg  = pickCommitMessage(messages_pool, substitute["meta"].get("type", "general"))
                    mode = schedule.get("mode", "self")
                    GH_PAT = os.getenv("GH_PAT")

                    if mode == "self":
                        applyQueueItem(substitute, schedule)
                        result = commitAndPushWithRetry(msg)
                    else:
                        result = deployToTarget(substitute, GH_PAT, msg, schedule) if GH_PAT else {
                            "success": False, "commitHash": None, "error": "GH_PAT missing"
                        }

                    status = "success" if result["success"] else "failure"
                    logRun({
                        "scheduleId":    schedule_id,
                        "status":        status,
                        "item":          substitute["filename"],
                        "message":       msg,
                        "jitterSeconds": 0,
                        "commitHash":    result.get("commitHash"),
                        "error":         result.get("error"),
                    })
                    if result["success"]:
                        markItemUsed(substitute)

                continue   # abort handling complete, move to next schedule

            # ── Intensity → commit count ──────────────────────────────────
            tz    = zoneinfo.ZoneInfo(schedule["timezone"])
            today = now.astimezone(tz).date()
            level = getIntensity(schedule, today)
            count = intensityToCount(level)

            # light intensity can return 0 (skip day naturally)
            if count == 0:
                print(f"[{schedule_id}] Light intensity rolled 0 commits. Skipping today.")
                continue

            print(f"[{schedule_id}] Intensity: {level} -> {count} commit(s) today")

            # ── Commit cycles ─────────────────────────────────────────────
            for cycle_num in range(1, count + 1):
                print(f"\n[{schedule_id}] Cycle {cycle_num}/{count}")
                runOneCommitCycle(schedule, messages_pool)

        except Exception as e:
            # One crashed schedule must NEVER kill other schedules
            import traceback
            print(f"[{schedule_id}] 💥 Uncaught exception:", file=sys.stderr)
            traceback.print_exc()
            logRun({
                "scheduleId":    schedule_id,
                "status":        "failure",
                "error":         str(e),
                "item":          None,
                "message":       None,
                "jitterSeconds": 0,
                "commitHash":    None,
            })
            sendAlert(f"🚨 **[{schedule_id}]** Bot crashed: {e}")
            # Loop continues to next schedule

    print(f"\n{'=' * 55}")
    print("  git-drip bot cycle complete")
    print(f"  {getCurrentDateTime().isoformat()}")
    print(f"{'=' * 55}")


if __name__ == "__main__":
    main()
