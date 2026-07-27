"""
bot/scheduler.py
All time-window and scheduling logic.
Knows about: spans, time slots, jitter windows, skip dates.
Does NOT touch git, files, or alerts.
"""
import zoneinfo
from datetime import datetime, timedelta
from bot.utils import getCurrentDateTime


def isWithinSpan(schedule: dict, nowDateTime: datetime) -> bool:
    """
    Returns True if nowDateTime's local date falls within
    [startDate, startDate + spanDays).
    """
    tz = zoneinfo.ZoneInfo(schedule["timezone"])
    now_local = nowDateTime.astimezone(tz)
    now_date = now_local.date()

    start_date = datetime.strptime(schedule["startDate"], "%Y-%m-%d").date()
    end_date = start_date + timedelta(days=schedule["spanDays"])

    return start_date <= now_date < end_date


def isScheduledNow(schedule: dict, nowDateTime: datetime) -> bool:
    """
    Returns True if nowDateTime falls inside any time slot's window:
        [scheduledTime, scheduledTime + jitterMinutes].
    """
    tz = zoneinfo.ZoneInfo(schedule["timezone"])
    now_local = nowDateTime.astimezone(tz)

    for t_str in schedule["times"]:
        t_obj = datetime.strptime(t_str, "%H:%M").time()
        scheduled_dt = datetime.combine(now_local.date(), t_obj).replace(tzinfo=tz)
        window_end = scheduled_dt + timedelta(minutes=schedule["jitterMinutes"])

        if scheduled_dt <= now_local <= window_end:
            return True

    return False


def isSkipDay(schedule: dict, nowDateTime: datetime) -> bool:
    """
    Returns True if today's ISO date string is in schedule.skipDates[].
    e.g. skipDates: ["2026-08-01", "2026-08-15"]
    """
    tz = zoneinfo.ZoneInfo(schedule["timezone"])
    today_str = nowDateTime.astimezone(tz).date().isoformat()
    return today_str in schedule.get("skipDates", [])


def shouldRunNow(schedule: dict) -> bool:
    """Master check: combines skip-day, span, and time-window checks."""
    now = getCurrentDateTime()
    if isSkipDay(schedule, now):
        return False
    return isWithinSpan(schedule, now) and isScheduledNow(schedule, now)


def getCurrentSlotId(schedule: dict, nowDateTime: datetime) -> str | None:
    """
    Returns the ISO 8601 string for the time slot that is currently active,
    or None if we are not in any slot window right now.
    Used as the key for abort flags and armed-slot dedup.
    """
    tz = zoneinfo.ZoneInfo(schedule["timezone"])
    now_local = nowDateTime.astimezone(tz)

    for t_str in schedule["times"]:
        t_obj = datetime.strptime(t_str, "%H:%M").time()
        scheduled_dt = datetime.combine(now_local.date(), t_obj).replace(tzinfo=tz)
        window_end = scheduled_dt + timedelta(minutes=schedule["jitterMinutes"])

        if scheduled_dt <= now_local <= window_end:
            return scheduled_dt.isoformat()

    return None
