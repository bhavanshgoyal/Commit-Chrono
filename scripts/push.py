import sys
import subprocess
from datetime import datetime, timezone

def appendLog(file_path="activity.log"):
    """Reads current time, formats as ISO 8601, appends as a new line."""
    try:
        # Get current time in ISO 8601 format
        now = datetime.now(timezone.utc).astimezone().replace(microsecond=0).isoformat()
        line = f"Run at: {now}\n"
        
        with open(file_path, "a") as f:
            f.write(line)
        return line
    except Exception as e:
        print(f"Error writing to {file_path}: {e}", file=sys.stderr)
        sys.exit(1)

def runGitCommand(args):
    """Spawns `git` as a child process with those args."""
    # Run the git command and capture output
    result = subprocess.run(["git"] + args, capture_output=True, text=True)
    return {
        "stdout": result.stdout.strip(),
        "stderr": result.stderr.strip(),
        "exitCode": result.returncode
    }

def commitAndPush(message):
    """Adds, commits, and pushes to the current branch."""
    # 1. Add files
    add_result = runGitCommand(["add", "."])
    if add_result["exitCode"] != 0:
        return {"success": False, "commitHash": None, "error": f"Git Add Failed: {add_result['stderr']}"}

    # 2. Commit
    commit_result = runGitCommand(["commit", "-m", message])
    
    # Check for the special case: nothing to commit
    if commit_result["exitCode"] != 0:
        if "nothing to commit" in commit_result["stdout"] or "nothing to commit" in commit_result["stderr"]:
            return {"success": True, "commitHash": None, "error": None} # Treat as no-op success
        else:
            return {"success": False, "commitHash": None, "error": f"Git Commit Failed: {commit_result['stderr']}"}

    # 3. Get current branch name dynamically
    branch_result = runGitCommand(["rev-parse", "--abbrev-ref", "HEAD"])
    branch = branch_result["stdout"] if branch_result["exitCode"] == 0 else "main"

    # 4. Push
    push_result = runGitCommand(["push", "origin", branch])
    if push_result["exitCode"] != 0:
         return {"success": False, "commitHash": None, "error": f"Git Push Failed: {push_result['stderr']}"}

    # 5. Get the new commit hash
    hash_result = runGitCommand(["rev-parse", "HEAD"])
    commit_hash = hash_result["stdout"] if hash_result["exitCode"] == 0 else "unknown"

    return {"success": True, "commitHash": commit_hash, "error": None}

def main():
    print("Starting bot cycle...")
    
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