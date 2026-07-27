"""
bot/alerts.py
Discord webhook notifications + T-minus-N pre-push armed-slot tracking.

Armed-slot dedup is stored in logs/pending-push.json:
{
  "armedSlots": [
    { "scheduleId": "...", "slotId": "...", "notifiedAt": "...",
      "aborted": false, "resolution": null }
  ]
}
"""
import os
import json
import zoneinfo
from datetime import datetime, timedelta
import requests

from bot.utils import getCurrentDateTime, urlSafe

PENDING_PUSH_LOG = os.path.join("logs", "pending-push.json")


# ── Discord webhook ──────────────────────────────────────────────────────────

def sendAlert(text: str, webhook_url: str | None = None) -> None:
    """
    POSTs a message to the configured Discord webhook.
    If the webhook URL is missing or the POST fails, logs a warning
    but does NOT crash the run — a failed notification is never fatal.
    """
    url = webhook_url or os.getenv("ALERT_WEBHOOK")
    if not url:
        print("⚠️  No ALERT_WEBHOOK set. Skipping alert.")
        return
    try:
        # "content" is the standard Discord webhook payload key.
        # Switch to "text" here if you ever add Slack support.
        response = requests.post(url, json={"content": text}, timeout=10)
        response.raise_for_status()
        print(f"📣 Alert sent: {text[:100]}{'...' if len(text) > 100 else ''}")
    except Exception as e:
        print(f"⚠️  Alert failed (non-fatal): {e}")


# ── Armed-slot persistence ───────────────────────────────────────────────────

def _loadArmedSlots() -> dict:
    os.makedirs("logs", exist_ok=True)
    if not os.path.exists(PENDING_PUSH_LOG):
        return {"armedSlots": []}
    try:
        with open(PENDING_PUSH_LOG, "r") as f:
            return json.load(f)
    except Exception:
        return {"armedSlots": []}


def _saveArmedSlots(data: dict) -> None:
    with open(PENDING_PUSH_LOG, "w") as f:
        json.dump(data, f, indent=2)


def alreadyArmed(schedule_id: str, slot_id: str) -> bool:
    """Returns True if a notification has already been sent for this slot."""
    data = _loadArmedSlots()
    return any(
        s["scheduleId"] == schedule_id and s["slotId"] == slot_id
        for s in data["armedSlots"]
    )


def recordArmedSlot(schedule_id: str, slot_id: str) -> None:
    """Persists the fact that a pre-push notification was sent for this slot."""
    data = _loadArmedSlots()
    data["armedSlots"].append({
        "scheduleId": schedule_id,
        "slotId": slot_id,
        "notifiedAt": getCurrentDateTime().isoformat(),
        "aborted": False,
        "resolution": None
    })
    _saveArmedSlots(data)


# ── T-minus-N notification ───────────────────────────────────────────────────

def checkAndNotify(schedule: dict, now_dt: datetime | None = None) -> None:
    """
    Fires once per slot when we are within schedule.notifyBeforeMinutes of a push.
    Deduplicates using armedSlots so only one alert fires per slot per day,
    regardless of how many times the cron fires in that window.

    The alert message tells the user exactly what filename to commit to abort.
    """
    if now_dt is None:
        now_dt = getCurrentDateTime()

    tz = zoneinfo.ZoneInfo(schedule["timezone"])
    now_local = now_dt.astimezone(tz)
    notify_window = schedule.get("notifyBeforeMinutes", 10)
    schedule_id = schedule["id"]

    for t_str in schedule["times"]:
        t_obj = datetime.strptime(t_str, "%H:%M").time()
        slot_dt = datetime.combine(now_local.date(), t_obj).replace(tzinfo=tz)
        minutes_until = (slot_dt - now_local).total_seconds() / 60

        if 0 < minutes_until <= notify_window:
            slot_id = slot_dt.isoformat()
            if not alreadyArmed(schedule_id, slot_id):
                safe_id = urlSafe(slot_id)
                msg = (
                    f"⏰ **[{schedule_id}]** Push in ~{int(minutes_until)} min "
                    f"(`{slot_id}`).\n"
                    f"To **abort**, commit an empty file at:\n"
                    f"`queue/pending/abort-{schedule_id}-{safe_id}.flag`"
                )
                sendAlert(msg)
                recordArmedSlot(schedule_id, slot_id)
                print(f"[{schedule_id}] Pre-push notification sent for slot {slot_id}")
