"""
bot/utils.py
Shared utility functions used by all other bot modules.
"""
import os
import json
import shutil
import zoneinfo
from datetime import datetime


def getCurrentDateTime() -> datetime:
    """Returns the current UTC-aware datetime. Isolated for test injection."""
    return datetime.now(zoneinfo.ZoneInfo("UTC"))


def loadConfig(file_path: str = "config.json") -> dict:
    """
    Loads and parses the JSON configuration file.
    Tries the given path first, then one directory up (for running from bot/ or scripts/).
    """
    if not os.path.exists(file_path):
        alt = os.path.join("..", file_path)
        if os.path.exists(alt):
            file_path = alt
    with open(file_path, "r") as f:
        return json.load(f)


def validateJson(path: str) -> bool:
    """Returns True if the file exists and contains valid JSON, False otherwise."""
    try:
        with open(path, "r") as f:
            json.load(f)
        return True
    except Exception:
        return False


def urlSafe(s: str) -> str:
    """
    Makes a string safe for use in filenames.
    Replaces :, +, . with - so ISO 8601 slot IDs become valid file name components.
    e.g. "2026-07-27T09:00:00+05:30" -> "2026-07-27T09-00-00-05-30"
    """
    for ch in [":", "+", "."]:
        s = s.replace(ch, "-")
    return s


def writeMetaFile(path: str, meta: dict) -> None:
    """Atomically writes a metadata dict to a JSON file."""
    with open(path, "w") as f:
        json.dump(meta, f, indent=2)


def readJSON(path: str) -> dict:
    """Reads and returns a JSON file as a dict."""
    with open(path, "r") as f:
        return json.load(f)
