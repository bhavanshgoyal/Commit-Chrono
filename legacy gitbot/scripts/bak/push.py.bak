import os
import sys
import json
import subprocess
import zoneinfo
import random
import shutil
import time
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv
import tempfile
import shutil
from git import Repo
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
            # FIX: Do not return early here! We just pass and let it proceed to the push step
            # to catch any lingering commits that failed to push previously.
            print("No new files to commit, proceeding to push existing changes...")
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
# --- PHASE 4.3: ALERTS ---
def sendAlert(text):
    webhook_url = os.getenv("ALERT_WEBHOOK")
    if not webhook_url:
        print("⚠️ No ALERT_WEBHOOK found in .env. Skipping alert.")
        return
    
    try:
        # "content" is the standard payload key for Discord. 
        # (Change to "text" if you are using Slack).
        response = requests.post(webhook_url, json={"content": text})
        response.raise_for_status()
    except Exception as e:
        print(f"⚠️ Failed to send alert: {e}")
        # The blueprint explicitly states: "do not crash the run over a failed notification"

# --- PHASE 4.1: CORRUPTION RECOVERY LOGGING ---
def logRun(entry):
    log_file = os.path.join("logs", "run-log.json")
    os.makedirs("logs", exist_ok=True)
    
    data = {"runs": []}
    
    if os.path.exists(log_file):
        try:
            with open(log_file, "r") as f:
                data = json.load(f)
        except json.JSONDecodeError:
            # Corruption detected! Back it up and start fresh.
            now_str = datetime.now().strftime("%Y%m%d%H%M%S")
            corrupt_file = os.path.join("logs", f"run-log.corrupt.{now_str}.json")
            shutil.move(log_file, corrupt_file)
            print(f"🚨 Corrupt log file detected! Backed up to {corrupt_file}")
            
            # Use our new alert system to warn you!
            sendAlert(f"🚨 Central Command Warning: `run-log.json` was corrupted. Backed up to {corrupt_file} and reset.")
            data = {"runs": []}
            
    data["runs"].append(entry)
    
    with open(log_file, "w") as f:
        json.dump(data, f, indent=4)
# ==========================================
# PHASE 4.2 RETRY
# ==========================================
def commitAndPushWithRetry(message, max_attempts=3):
    """Attempts to commit and push, retrying with exponential backoff on failure."""
    for attempt in range(1, max_attempts + 1):
        result = commitAndPush(message)
        
        # If it worked, return the success result immediately
        if result["success"]:
            return result
            
        # If it failed but we still have attempts left, wait and retry
        if attempt < max_attempts:
            backoff_seconds = (2 ** attempt) * 5
            print(f"Push failed (Attempt {attempt}/{max_attempts}). Retrying in {backoff_seconds} seconds...", file=sys.stderr)
            time.sleep(backoff_seconds)
            
    # If we get here, all attempts failed
    return {
        "success": False, 
        "commitHash": None, 
        "error": f"Max retries ({max_attempts}) exceeded. Last error: {result['error']}"
    }
# ==========================================
# Target deployment
# ==========================================
def deployToTarget(item, github_token, commit_msg):
    filename = item["filename"]
    target_repo = item["targetRepo"] # e.g., "Bhavansh/Movie-API"
    target_path = item["targetPath"] # e.g., "src/main/resources/data.sql"
    
    # 1. Build the secure URL using your token
    repo_url = f"https://{github_token}@github.com/{target_repo}.git"
    
    # 2. Create a temporary invisible folder
    temp_dir = tempfile.mkdtemp()
    
    try:
        print(f"📥 Cloning {target_repo} into temporary workspace...")
        # This is GitPython replacing 'git clone'
        repo = Repo.clone_from(repo_url, temp_dir)
        
        # 3. Figure out where the file is and where it needs to go
        # Assuming your pending files are still in a folder named 'queue/pending'
        source_file = os.path.join("queue", "pending", filename)
        dest_file = os.path.join(temp_dir, target_path)
        
        # Make sure the destination subfolders actually exist inside the repo
        os.makedirs(os.path.dirname(dest_file), exist_ok=True)
        
        print(f"📦 Copying '{filename}' into the repository...")
        shutil.copy2(source_file, dest_file)
        
        # 4. Object-Oriented Git: Add, Commit, and Push
        repo.index.add([target_path])
        repo.index.commit(commit_msg)
        
        print("🚀 Pushing payload to remote...")
        origin = repo.remote(name='origin')
        origin.push()
        
        # Grab the commit hash for your logs
        commit_hash = repo.head.commit.hexsha
        print(f"✅ Successfully deployed! Hash: {commit_hash}")
        
        return {"success": True, "commitHash": commit_hash}
        
    except Exception as e:
        print(f"🚨 Deployment failed: {str(e)}")
        return {"success": False, "error": str(e)}
        
    finally:
        # 5. Clean up the evidence (ignore_errors is needed on Windows for .git folders)
        shutil.rmtree(temp_dir, ignore_errors=True)


# ==========================================
# MAIN EXECUTION
# ==========================================
#phase 4
def main():
    print("Starting bot cycle...")
    # --- PHASE 5.1: AUTHENTICATION ---
    load_dotenv() # This reads the .env file
    github_token = os.getenv("GITHUB_TOKEN")
    
    if not github_token:
        print("🚨 ERROR: GITHUB_TOKEN not found in .env file. Aborting.")
        return
    # ---------------------------------
    # --- PHASE 4.6: EMERGENCY ABORT SWITCH ---
    if os.path.exists("abort.flag"):
        print("🚨 ABORT FLAG DETECTED! Canceling the run immediately.")
        # Optional: You could log this abort to run-log.json here if you want a record of it
        return
    # -----------------------------------------
    config = loadConfig("config.json")
    # if not shouldRunNow(config):
    #     print("Not scheduled to run now. Exiting.")
    #     return
    # Check if Dry Run is active
    dry_run = config.get("dryRun", False)
    if dry_run:
        print("🛠️ DRY RUN MODE ACTIVATED: No files will be moved or pushed.")

    # --- PHASE 4.3: JITTER LOGIC ---
    # Read jitterMinutes from config, multiply by 60 to get seconds (default to 0)
    jitter_max_seconds = config.get("jitterMinutes", 0) * 60
    jitter_applied = 0
    
    if jitter_max_seconds > 0:
        jitter_applied = random.randint(1, jitter_max_seconds)
        print(f"Jitter activated: Waiting {jitter_applied} seconds to simulate human behavior...")
        time.sleep(jitter_applied)
    # -------------------------------
    # --- PHASE 5.2: READ THE MANIFEST (queue.json) ---
    now = getCurrentDateTime()
    try:
        with open("queue.json", "r") as f:
            queue = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        print("🚨 queue.json not found or formatted incorrectly.")
        queue = []

    commit_msg = getRandomMessage("messages.json")
    print(f"Selected commit message: '{commit_msg}'")

    if len(queue) == 0:
        print("Queue is empty. Running dummy log on central repo.")
        item = None
        appendLog()
        if not dry_run:
            result = commitAndPushWithRetry(commit_msg) # Old function keeps the daily streak alive
        else:
            result = {"success": True, "commitHash": "dry-run-dummy"}
    else:
        item = queue[0]
        print(f"🚀 Mission Acquired: Moving '{item['filename']}' to '{item['targetRepo']}'")
        
        if not dry_run:
            result = deployToTarget(item, github_token, commit_msg)
        else:
            print("🛠️ DRY RUN: Skipping actual deployment.")
            result = {"success": True, "commitHash": "dry-run-hash"}

    # --- PHASE 4.4: CONSTRUCT THE LOG ENTRY ---
    status = "success" if result["success"] else "failure"
    if dry_run:
        status = "dry-run"
    elif item is None and result["success"]:
        status = "no-op"

    log_entry = {
        "timestamp": now.isoformat(),
        "status": status,
        "commitHash": result.get("commitHash"),
        "item": item["filename"] if item else None,
        "message": commit_msg,
        "jitterSeconds": jitter_applied, 
        "error": result.get("error")
    }
    
    logRun(log_entry)
    print("Run log updated successfully.")

    # --- PHASE 5.3: CLEAN UP THE QUEUE ---
    if result["success"] and item is not None and not dry_run:
        # 1. Move the physical file so we have a backup
        source_file = os.path.join("queue", "pending", item["filename"])
        dest_file = os.path.join("queue", "used", item["filename"])
        if os.path.exists(source_file):
            shutil.move(source_file, dest_file)
            print(f"📂 Backed up {item['filename']} to the used folder.")
            
        # 2. Cross the task off the JSON map
        queue.pop(0)
        with open("queue.json", "w") as f:
            json.dump(queue, f, indent=4)
        print("✅ queue.json updated. Task marked as complete.")
        
    elif not result["success"]:
        print(f"Failed! Error: {result.get('error')}", file=sys.stderr)
    # # --- PHASE 5.2: READ THE MANIFEST (queue.json) ---
    # now = getCurrentDateTime()
    # try:
    #     with open("queue.json", "r") as f:
    #         queue = json.load(f)
    # except (FileNotFoundError, json.JSONDecodeError):
    #     print("🚨 queue.json not found or formatted incorrectly. Falling back to dummy log.")
    #     queue = []

    # if len(queue) == 0:
    #     print("Queue is empty. Nothing to push right now! Running dummy log.")
    #     item = None
    #     appendLog()
    # else:
    #     # Grab the first task in the list
    #     item = queue[0]
    #     filename = item["filename"]
    #     target_repo = item["targetRepo"]
    #     target_path = item["targetPath"]
    #     print(f"🚀 Mission Acquired: Moving '{filename}' to '{target_repo}' at '{target_path}'")
        
    #     # Note: We are temporarily skipping 'applyQueueItem' because Phase 5 
    #     # requires a totally new deployment function to handle external repos.    
    # # now = getCurrentDateTime()
    # # items = listPendingItems()
    
    # # item = getNextQueueItem(items, now)

    # # if item is None:
    # #     print("Queue is empty or no items eligible right now. Falling back to dummy log.")
    # #     appendLog()
        
    # # else:
    # #     print(f"Selected item from queue: {item['filename']}")
    # #     applyQueueItem(item)
    
    # commit_msg = getRandomMessage("messages.json")
    # print(f"Selected commit message: '{commit_msg}'")
    # #Commit push with retry 4.2 phase
    # # Attempt to push with backoff retries
    # result = commitAndPushWithRetry(commit_msg)
    # # Attempt to push
    # # result = commitAndPush(commit_msg)
    # # Construct the log entry
    # status = "success" if result["success"] else "failure"
    # if dry_run:
    #     status = "dry-run"
    # elif item is None and result["success"]:
    #     status = "no-op"
    # # --- NEW PHASE 4 LOGIC: CONSTRUCT THE LOG ENTRY ---
    # status = "success" if result["success"] else "failure"
    # if item is None and result["success"]:
    #     status = "no-op" # It succeeded but only pushed a dummy log

    # log_entry = {
    #     "timestamp": now.isoformat(),
    #     "status": status,
    #     "commitHash": result.get("commitHash"),
    #     "item": item["filename"] if item else None,
    #     "message": commit_msg,
    #     "jitterSeconds": 0, # We will add jitter logic later
    #     "error": result.get("error")
    # }
    
    # # Write the receipt
    # logRun(log_entry)
    # print("Run log updated successfully.")
    # # --------------------------------------------------
    
    # if result["success"]:
    #     if dry_run:
    #          print("Success! (Dry Run Complete)")
    #     elif result.get("commitHash"):
    #         print(f"Success! Pushed commit: {result['commitHash']}")
    #     else:
    #         print("Success! (Nothing new to commit)")
            
    #     if item is not None:
    #         if not dry_run:
    #             markItemUsed(item)
    #             print(f"Moved {item['filename']} to the used queue.")
    #         else:
    #             print(f"DRY RUN: Left {item['filename']} untouched in the pending queue.")
    # else:
    #     print(f"Failed! Error: {result['error']}", file=sys.stderr)
sendAlert("🟢 Central Command Systems Check: Webhook routing is operational.")
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

# if __name__ == "__main__":
#     main()