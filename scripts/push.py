import os
import sys
import json
import subprocess
import zoneinfo
import random
import shutil
from datetime import datetime, timedelta

# ==========================================
# PHASE 2: SCHEDULING LOGIC
# ==========================================

def loadConfig(file_path="config.json"):
    """Loads and parses the JSON configuration."""
    # Move up one directory if the script is run from inside the scripts folder
    if not os.path.exists(file_path) and os.path.exists(f"../{file_path}"):
        file_path = f"../{file_path}"
        
    with open(file_path, "r") as f:
        return json.load(f)

def getCurrentDateTime():
    """Returns the current timezone-aware UTC datetime. Isolated for testability."""
    return datetime.now(zoneinfo.ZoneInfo("UTC"))

def isWithinSpan(config, nowDateTime):
    """Checks if the current date falls within the configured active day span."""
    tz = zoneinfo.ZoneInfo(config["timezone"])
    now_local = nowDateTime.astimezone(tz)
    now_date = now_local.date()

    start_date = datetime.strptime(config["startDate"], "%Y-%m-%d").date()
    end_date = start_date + timedelta(days=config["spanDays"])

    return start_date <= now_date < end_date

def isScheduledNow(config, nowDateTime):
    """Checks if the current time falls within any of the scheduled time windows (+ jitter)."""
    tz = zoneinfo.ZoneInfo(config["timezone"])
    now_local = nowDateTime.astimezone(tz)

    for t_str in config["times"]:
        t_obj = datetime.strptime(t_str, "%H:%M").time()
        
        # Construct exact scheduled datetime in the target timezone
        scheduled_dt = datetime.combine(now_local.date(), t_obj).replace(tzinfo=tz)
        window_end = scheduled_dt + timedelta(minutes=config["jitterMinutes"])

        if scheduled_dt <= now_local <= window_end:
            return True

    return False

def shouldRunNow(config):
    """Combines span and time checks."""
    now = getCurrentDateTime()
    return isWithinSpan(config, now) and isScheduledNow(config, now)
# ==========================================
# Phase 3 — Content Queue. 
# Building the Queue Reader
# ==========================================
def listPendingItems(queue_dir="queue/pending"):
    """Reads pending files and creates default metadata sidecars if missing."""
    if not os.path.exists(queue_dir) and os.path.exists(f"../{queue_dir}"):
        queue_dir = f"../{queue_dir}"
        
    items = []
    
    # If the folder doesn't exist yet, just return empty
    if not os.path.exists(queue_dir):
        return items

    for file_name in os.listdir(queue_dir):
        # Ignore gitkeep and existing meta files during the scan
        if file_name == ".gitkeep" or file_name.endswith(".meta.json"):
            continue

        content_path = os.path.join(queue_dir, file_name)
        meta_path = f"{content_path}.meta.json"

        # The Phase 3.1 default metadata schema
        meta = {
            "priority": "normal",
            "addedAt": datetime.now(zoneinfo.ZoneInfo("UTC")).isoformat(),
            "notEligibleUntil": None,
            "dependsOn": None,
            "held": False,
            "lastSkippedAt": None,
            "type": "feature"
        }

        # If a meta file already exists, load it. Otherwise, create it.
        if os.path.exists(meta_path):
            try:
                with open(meta_path, "r") as f:
                    meta.update(json.load(f))
            except Exception as e:
                print(f"Error reading meta for {file_name}: {e}", file=sys.stderr)
        else:
            with open(meta_path, "w") as f:
                json.dump(meta, f, indent=2)

        items.append({
            "filename": file_name,
            "contentPath": content_path,
            "metaPath": meta_path,
            "meta": meta
        })

    return items
def getNextQueueItem(items, now_dt):
    """Filters eligible items and picks the highest priority one."""
    eligible = []
    
    for item in items:
        meta = item["meta"]
        
        # 1. Skip if held
        if meta.get("held", False):
            continue
            
        # 2. Skip if not eligible yet
        if meta.get("notEligibleUntil"):
            not_eligible_dt = datetime.fromisoformat(meta["notEligibleUntil"])
            if not_eligible_dt > now_dt:
                continue
                
        # 3. Skip if it depends on a file still in the pending queue
        if meta.get("dependsOn"):
            depends_exists = any(i["filename"] == meta["dependsOn"] for i in items)
            if depends_exists:
                continue
                
        eligible.append(item)

    if not eligible:
        return None

    # Group by priority tier, highest non-empty tier wins
    for tier in ["high", "normal", "low"]:
        tier_items = [i for i in eligible if i["meta"].get("priority") == tier]
        if tier_items:
            # Sort by lastSkippedAt (if exists), otherwise addedAt
            def get_sort_key(x):
                m = x["meta"]
                key_str = m.get("lastSkippedAt") or m.get("addedAt")
                return datetime.fromisoformat(key_str) if key_str else datetime.min.replace(tzinfo=zoneinfo.ZoneInfo("UTC"))
                
            tier_items.sort(key=get_sort_key)
            return tier_items[0]
            
    return None

def applyQueueItem(item):
    """Copies the item's content into the main repository source folder."""
    # We will copy it into a 'src' folder in the root of your repo
    target_dir = "src"
    if not os.path.exists(target_dir) and os.path.exists(f"../{target_dir}"):
        target_dir = f"../{target_dir}"
        
    os.makedirs(target_dir, exist_ok=True)
    target_path = os.path.join(target_dir, item["filename"])
    
    shutil.copy2(item["contentPath"], target_path)
    return target_path

def markItemUsed(item):
    """Moves the item and its meta file to the queue/used directory."""
    used_dir = "queue/used"
    if not os.path.exists(used_dir) and os.path.exists(f"../{used_dir}"):
        used_dir = f"../{used_dir}"
        
    # Update meta with usedAt timestamp
    meta = item["meta"]
    meta["usedAt"] = datetime.now(zoneinfo.ZoneInfo("UTC")).isoformat()
    
    with open(item["metaPath"], "w") as f:
        json.dump(meta, f, indent=2)
        
    # Move both files out of pending
    content_dest = os.path.join(used_dir, item["filename"])
    meta_dest = os.path.join(used_dir, f"{item['filename']}.meta.json")
    
    shutil.move(item["contentPath"], content_dest)
    shutil.move(item["metaPath"], meta_dest)
# ==========================================
# PHASE 1: GIT & LOGGING LOGIC
# ==========================================

def appendLog(file_path="activity.log"):
    """Reads current time, formats as ISO 8601, appends as a new line."""
    if not os.path.exists(file_path) and os.path.exists(f"../{file_path}"):
        file_path = f"../{file_path}"
        
    try:
        now = datetime.now(zoneinfo.ZoneInfo("UTC")).replace(microsecond=0).isoformat()
        line = f"Run at: {now}\n"
        
        with open(file_path, "a") as f:
            f.write(line)
        return line
    except Exception as e:
        print(f"Error writing to {file_path}: {e}", file=sys.stderr)
        sys.exit(1)

def runGitCommand(args):
    """Spawns `git` as a child process with those args."""
    result = subprocess.run(["git"] + args, capture_output=True, text=True)
    return {
        "stdout": result.stdout.strip(),
        "stderr": result.stderr.strip(),
        "exitCode": result.returncode
    }

def commitAndPush(message):
    """Adds, commits, and pushes to the current branch."""
    add_result = runGitCommand(["add", "."])
    if add_result["exitCode"] != 0:
        return {"success": False, "commitHash": None, "error": f"Git Add Failed: {add_result['stderr']}"}

    commit_result = runGitCommand(["commit", "-m", message])
    if commit_result["exitCode"] != 0:
        if "nothing to commit" in commit_result["stdout"] or "nothing to commit" in commit_result["stderr"]:
            return {"success": True, "commitHash": None, "error": None}
        else:
            return {"success": False, "commitHash": None, "error": f"Git Commit Failed: {commit_result['stderr']}"}

    branch_result = runGitCommand(["rev-parse", "--abbrev-ref", "HEAD"])
    branch = branch_result["stdout"] if branch_result["exitCode"] == 0 else "main"

    push_result = runGitCommand(["push", "origin", branch])
    if push_result["exitCode"] != 0:
         return {"success": False, "commitHash": None, "error": f"Git Push Failed: {push_result['stderr']}"}

    hash_result = runGitCommand(["rev-parse", "HEAD"])
    commit_hash = hash_result["stdout"] if hash_result["exitCode"] == 0 else "unknown"

    return {"success": True, "commitHash": commit_hash, "error": None}
#===================================================
#                    RANDOM MESSAGE
#===================================================
def getRandomMessage(file_path="messages.json"):
    """Loads messages.json and picks a random string from a random category."""
    if not os.path.exists(file_path) and os.path.exists(f"../{file_path}"):
        file_path = f"../{file_path}"
        
    try:
        with open(file_path, "r") as f:
            messages_dict = json.load(f)
            
        # Pick a random category (e.g., 'general', 'feature', 'fix')
        categories = list(messages_dict.keys())
        chosen_category = random.choice(categories)
        
        # Pick a random message from that category
        chosen_message = random.choice(messages_dict[chosen_category])
        return chosen_message
        
    except Exception as e:
        print(f"Error loading messages: {e}. Defaulting to 'minor update'", file=sys.stderr)
        return "minor update"
#===================================================
#                    Phase -4  refined logs
#===================================================
def logRun(entry, log_path="logs/run-log.json"):
    """Appends a run entry to the JSON log, backing it up if corrupted."""
    if not os.path.exists(log_path) and os.path.exists(f"../{log_path}"):
        log_path = f"../{log_path}"
        
    # Ensure the logs directory exists
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    
    data = {"runs": []}
    
    # Try to load existing data safely
    if os.path.exists(log_path):
        try:
            with open(log_path, "r") as f:
                data = json.load(f)
                if "runs" not in data or not isinstance(data["runs"], list):
                    raise ValueError("Invalid schema: missing 'runs' array")
        except Exception as e:
            # Corrupted file - back it up as specified in Phase 4.1
            timestamp_str = datetime.now(zoneinfo.ZoneInfo("UTC")).strftime("%Y%m%d%H%M%S")
            backup_path = log_path.replace(".json", f".corrupt.{timestamp_str}.json")
            shutil.copy2(log_path, backup_path)
            print(f"Log file corrupted. Backed up to {backup_path}", file=sys.stderr)
            data = {"runs": []} # Start fresh
            
    # Append the new entry
    data["runs"].append(entry)
    
    # Write back to the file
    with open(log_path, "w") as f:
        json.dump(data, f, indent=2)
# ==========================================
# MAIN EXECUTION
# ==========================================
#phase 4
def main():
    print("Starting bot cycle...")
    
    config = loadConfig("config.json")
    if not shouldRunNow(config):
        print("Not scheduled to run now. Exiting.")
        return
        
    now = getCurrentDateTime()
    items = listPendingItems()
    
    item = getNextQueueItem(items, now)

    if item is None:
        print("Queue is empty or no items eligible right now. Falling back to dummy log.")
        appendLog()
        
    else:
        print(f"Selected item from queue: {item['filename']}")
        applyQueueItem(item)
    
    commit_msg = getRandomMessage("messages.json")
    print(f"Selected commit message: '{commit_msg}'")
    
    # Attempt to push
    result = commitAndPush(commit_msg)
    
    # --- NEW PHASE 4 LOGIC: CONSTRUCT THE LOG ENTRY ---
    status = "success" if result["success"] else "failure"
    if item is None and result["success"]:
        status = "no-op" # It succeeded but only pushed a dummy log

    log_entry = {
        "timestamp": now.isoformat(),
        "status": status,
        "commitHash": result.get("commitHash"),
        "item": item["filename"] if item else None,
        "message": commit_msg,
        "jitterSeconds": 0, # We will add jitter logic later
        "error": result.get("error")
    }
    
    # Write the receipt
    logRun(log_entry)
    print("Run log updated successfully.")
    # --------------------------------------------------
    
    if result["success"]:
        if result["commitHash"]:
            print(f"Success! Pushed commit: {result['commitHash']}")
        else:
            print("Success! (Nothing new to commit)")
            
        if item is not None:
            markItemUsed(item)
            print(f"Moved {item['filename']} to the used queue.")
    else:
        print(f"Failed! Error: {result['error']}", file=sys.stderr)

if __name__ == "__main__":
    main()

#phase 3
# def main():
#     print("Starting bot cycle...")
    
#     # 1. Load config and check schedule
#     config = loadConfig("config.json")
#     if not shouldRunNow(config):
#         print("Not scheduled to run now. Exiting.")
#         return
        
#     # --- PHASE 3: READ AND PROCESS THE QUEUE ---
#     now = getCurrentDateTime()
#     items = listPendingItems()
#     print(f"DEBUG: Found {len(items)} items in the pending queue.")
    
#     # NEW: Pick the highest priority item from the queue
#     item = getNextQueueItem(items, now)

#     # 2. Execute push cycle if scheduled
#     if item is None:
#         # We only do the dummy log update if the queue is totally empty
#         print("Queue is empty or no items eligible right now. Falling back to dummy log.")
#         logged_line = appendLog()
#         print(f"Appended to log: {logged_line.strip()}")
#     else:
#         # If we found a real file, apply it to the source code folder
#         print(f"Selected item from queue: {item['filename']}")
#         applyQueueItem(item)
    
#     # Pick a random commit message instead of hardcoding it
#     commit_msg = getRandomMessage("messages.json")
#     print(f"Selected commit message: '{commit_msg}'")
    
#     result = commitAndPush(commit_msg)
    
#     if result["success"]:
#         if result["commitHash"]:
#             print(f"Success! Pushed commit: {result['commitHash']}")
#         else:
#             print("Success! (Nothing new to commit)")
            
#         # NEW: Move the file to the 'used' folder ONLY if the push was successful
#         if item is not None:
#             markItemUsed(item)
#             print(f"Moved {item['filename']} to the used queue.")
#     else:
#         print(f"Failed! Error: {result['error']}", file=sys.stderr)
#phase 2+
# def main():
#     print("Starting bot cycle...")
    
#     # 1. Load config and check schedule
#     config = loadConfig("config.json")
#     if not shouldRunNow(config):
#         print("Not scheduled to run now. Exiting.")
#         return
#     # --- PHASE 3: READ THE QUEUE ---
#     items = listPendingItems()
#     print(f"DEBUG: Found {len(items)} items in the pending queue.")
#     for item in items:
#         print(f" -> Found file: {item['filename']} | Priority: {item['meta']['priority']}")

#     # 2. Execute push cycle if scheduled
#     logged_line = appendLog()
#     print(f"Appended to log: {logged_line.strip()}")
    
#     # Pick a random commit message instead of hardcoding it
#     commit_msg = getRandomMessage("messages.json")
#     print(f"Selected commit message: '{commit_msg}'")
    
#     result = commitAndPush(commit_msg)
    
#     if result["success"]:
#         if result["commitHash"]:
#             print(f"Success! Pushed commit: {result['commitHash']}")
#         else:
#             print("Success! (Nothing new to commit)")
#     else:
#         print(f"Failed! Error: {result['error']}", file=sys.stderr)

if __name__ == "__main__":
    main()