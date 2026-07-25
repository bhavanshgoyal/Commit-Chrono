import os
import sys
import json
import subprocess
import zoneinfo
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


# ==========================================
# MAIN EXECUTION
# ==========================================

def main():
    print("Starting bot cycle...")
    
    # 1. Load config and check schedule
    config = loadConfig("config.json")
    if not shouldRunNow(config):
        print("Not scheduled to run now. Exiting.")
        return
        
    # 2. Execute push cycle if scheduled
    logged_line = appendLog()
    print(f"Appended to log: {logged_line.strip()}")
    
    result = commitAndPush("auto update")
    
    if result["success"]:
        if result["commitHash"]:
            print(f"Success! Pushed commit: {result['commitHash']}")
        else:
            print("Success! (Nothing new to commit)")
    else:
        print(f"Failed! Error: {result['error']}", file=sys.stderr)

if __name__ == "__main__":
    main()