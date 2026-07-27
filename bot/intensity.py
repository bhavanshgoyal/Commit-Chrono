"""
bot/intensity.py
Determines how many commits happen on a given day based on intensity level.
Intensity levels: "light" | "normal" | "heavy"

Also provides generateIntensityMap() for the dashboard pattern-picker.
"""
import random
from datetime import datetime, timedelta


# Maps intensity level to a callable that returns a commit count.
# "light" sometimes returns 0 (the bot skips the day entirely — realistic).
INTENSITY_DISPATCH = {
    "light":  lambda: random.choice([0, 1]),
    "normal": lambda: 1,
    "heavy":  lambda: random.randint(2, 4),
}


def getIntensity(schedule: dict, today_date) -> str:
    """
    Returns the intensity level for today_date from schedule.intensity dict.
    Falls back to "normal" if today has no explicit override.
    today_date should be a datetime.date object.
    """
    intensity_map = schedule.get("intensity", {})
    date_str = today_date.isoformat() if hasattr(today_date, "isoformat") else today_date
    return intensity_map.get(date_str, "normal")


def intensityToCount(level: str) -> int:
    """
    Translates an intensity level string into a concrete commit count.
    light  → 0 or 1  (sometimes skips)
    normal → always 1
    heavy  → 2, 3, or 4
    """
    fn = INTENSITY_DISPATCH.get(level, INTENSITY_DISPATCH["normal"])
    return fn()


def generateIntensityMap(schedule: dict, pattern: list) -> dict:
    """
    Builds a date → intensity dict from a user-provided pattern list.

    Args:
        schedule: must contain "startDate" (YYYY-MM-DD) and "spanDays" (int)
        pattern:  list of intensity strings, one per day.
                  Must have exactly schedule["spanDays"] entries.

    Returns:
        dict like { "2026-07-26": "heavy", "2026-07-27": "normal", ... }

    Raises:
        AssertionError if pattern length doesn't match spanDays.
    """
    span = schedule["spanDays"]
    assert len(pattern) == span, (
        f"Pattern length ({len(pattern)}) must equal spanDays ({span})"
    )
    valid_levels = set(INTENSITY_DISPATCH.keys())
    for i, level in enumerate(pattern):
        assert level in valid_levels, (
            f"Invalid intensity '{level}' at index {i}. "
            f"Valid values: {sorted(valid_levels)}"
        )

    start = datetime.strptime(schedule["startDate"], "%Y-%m-%d").date()
    return {
        (start + timedelta(days=i)).isoformat(): pattern[i]
        for i in range(span)
    }
