"""
bot/logger.py
Structured run-log management with automatic corruption recovery.
Every run appends one entry to logs/run-log.json.
Schema: { "runs": [ { timestamp, scheduleId, status, item, message,
                       jitterSeconds, commitHash, error }, ... ] }
Valid status values: success | failure | aborted | skipped | dry-run | no-op
                     reschedule-resolved
"""
import os
import json
import shutil
from datetime import datetime

LOG_FILE = os.path.join("logs", "run-log.json")


def logRun(entry: dict) -> None:
    """
    Appends entry to run-log.json.
    If the file is corrupted (invalid JSON from a crashed previous run),
    backs it up as run-log.corrupt.<timestamp>.json and starts fresh
    rather than crashing every subsequent run forever.
    """
    os.makedirs("logs", exist_ok=True)
    data = {"runs": []}

    if os.path.exists(LOG_FILE):
        try:
            with open(LOG_FILE, "r") as f:
                data = json.load(f)
        except json.JSONDecodeError:
            # Corruption detected — back up and reset
            now_str = datetime.now().strftime("%Y%m%d%H%M%S")
            corrupt_backup = os.path.join("logs", f"run-log.corrupt.{now_str}.json")
            shutil.move(LOG_FILE, corrupt_backup)
            print(f"🚨 Corrupt run-log.json detected! Backed up to {corrupt_backup}")
            # Alert (lazy import to avoid circular dependency)
            try:
                from bot.alerts import sendAlert
                sendAlert(
                    f"🚨 `run-log.json` was corrupted and has been reset. "
                    f"Backup: `{corrupt_backup}`"
                )
            except Exception:
                pass
            data = {"runs": []}

    # Ensure a timestamp is always present
    if "timestamp" not in entry:
        from bot.utils import getCurrentDateTime
        entry["timestamp"] = getCurrentDateTime().isoformat()

    data["runs"].append(entry)

    with open(LOG_FILE, "w") as f:
        json.dump(data, f, indent=4)
