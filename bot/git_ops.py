"""
bot/git_ops.py
All git operations: local commits (self mode) and remote deployments (external mode).

Key design decisions:
- runGitCommand() returns a result dict — never throws — so callers decide
  how to handle non-zero exit codes.
- checkForConflict() runs BEFORE every push (after commit) to detect
  concurrent edits on the remote branch during the bot's jitter window.
- deployToTarget() uses GitPython to clone into a temp dir, apply the file,
  commit, push, then delete the temp dir — leaving no trace on the runner.
- A single GH_PAT (Fine-Grained PAT) handles auth for all repos;
  GitHub's server enforces per-repo access restrictions.
"""
import os
import subprocess
import tempfile
import shutil
import time

from git import Repo


def runGitCommand(args: list) -> dict:
    """
    Spawns `git` as a subprocess with the given args.
    Returns { stdout, stderr, exitCode }.
    Non-zero exit codes are NOT raised — callers interpret them.
    """
    result = subprocess.run(
        ["git"] + args,
        capture_output=True,
        text=True,
    )
    return {
        "stdout":   result.stdout.strip(),
        "stderr":   result.stderr.strip(),
        "exitCode": result.returncode,
    }


def checkForConflict(branch: str) -> bool:
    """
    Fetches the latest remote state and checks if the remote branch has new commits
    that our local branch doesn't have.
    Returns True if the remote has moved ahead (conflict), False if clean.
    Called AFTER `git commit` but BEFORE `git push`.
    """
    runGitCommand(["fetch", "origin", branch])
    # Count how many commits origin/branch has that HEAD does not have
    result = runGitCommand(["rev-list", f"HEAD..origin/{branch}", "--count"])
    return result["stdout"].strip() != "0"


def commitAndPush(message: str) -> dict:
    """
    Runs: git add . → git commit -m <message> → conflict check → git push.
    Returns { success: bool, commitHash: str|None, error: str|None }.

    Special case: "nothing to commit" is treated as a silent no-op success
    (commitHash is None) — the caller distinguishes this from a real push.
    """
    add_result = runGitCommand(["add", "."])
    if add_result["exitCode"] != 0:
        return {
            "success": False,
            "commitHash": None,
            "error": f"git add failed: {add_result['stderr']}",
        }

    commit_result = runGitCommand(["commit", "-m", message])
    if commit_result["exitCode"] != 0:
        combined = commit_result["stdout"] + commit_result["stderr"]
        if "nothing to commit" in combined:
            print("ℹ️  Nothing to commit. No push needed.")
            return {"success": True, "commitHash": None, "error": None}
        return {
            "success": False,
            "commitHash": None,
            "error": f"git commit failed: {commit_result['stderr']}",
        }

    # Detect current branch dynamically
    branch_result = runGitCommand(["rev-parse", "--abbrev-ref", "HEAD"])
    branch = branch_result["stdout"] if branch_result["exitCode"] == 0 else "main"

    # Conflict check: did the remote move while we were working?
    if checkForConflict(branch):
        return {
            "success": False,
            "commitHash": None,
            "error": (
                f"Conflict detected: remote '{branch}' moved ahead during this run. "
                "Not pushing to avoid overwrite. Review and re-run manually."
            ),
        }

    push_result = runGitCommand(["push", "origin", branch])
    if push_result["exitCode"] != 0:
        return {
            "success": False,
            "commitHash": None,
            "error": f"git push failed: {push_result['stderr']}",
        }

    hash_result = runGitCommand(["rev-parse", "HEAD"])
    commit_hash = hash_result["stdout"] if hash_result["exitCode"] == 0 else "unknown"

    return {"success": True, "commitHash": commit_hash, "error": None}


def commitAndPushWithRetry(message: str, max_attempts: int = 3) -> dict:
    """
    Wraps commitAndPush() with exponential backoff retry.
    Delays: attempt 1 → 10s, attempt 2 → 20s, attempt 3 → 40s.
    Designed for transient failures (rate limits, network blips).
    Conflict failures are NOT retried (conflict is a permanent state until resolved).
    """
    last_result = None
    for attempt in range(1, max_attempts + 1):
        last_result = commitAndPush(message)

        if last_result["success"]:
            return last_result

        # Don't retry conflicts — they won't self-resolve
        if last_result.get("error", "").startswith("Conflict detected"):
            return last_result

        if attempt < max_attempts:
            backoff = (2 ** attempt) * 5  # 10s, 20s, 40s
            print(
                f"⚠️  Push failed (attempt {attempt}/{max_attempts}). "
                f"Retrying in {backoff}s... Error: {last_result['error']}"
            )
            time.sleep(backoff)

    return {
        "success":    False,
        "commitHash": None,
        "error": (
            f"Max retries ({max_attempts}) exceeded. "
            f"Last error: {last_result['error'] if last_result else 'unknown'}"
        ),
    }


def deployToTarget(item: dict, github_token: str, commit_msg: str, schedule: dict) -> dict:
    """
    Pushes item content to an EXTERNAL repository via GitPython.
    Routing (what repo, what path) is resolved in this order:
      1. item.meta.targetRepo / item.meta.targetPath  (per-item override)
      2. schedule.repo / schedule.targetPath           (schedule-level default)

    Process:
      1. Clone target repo into a temp directory (authenticated via token)
      2. Checkout the target branch
      3. Copy content file to resolved destination path
      4. git add → commit → push (via GitPython)
      5. Temp dir deleted unconditionally (finally block)

    Returns { success, commitHash, error }.
    """
    target_repo  = item["meta"].get("targetRepo")  or schedule.get("repo")
    item_subpath = item["meta"].get("targetPath")  or schedule.get("targetPath", "")
    branch       = schedule.get("branch", "main")
    filename     = item["filename"]

    if not target_repo:
        return {
            "success":    False,
            "commitHash": None,
            "error": "No targetRepo configured in item meta or schedule.",
        }

    if not github_token:
        return {
            "success":    False,
            "commitHash": None,
            "error": "GH_PAT not available. Cannot authenticate clone.",
        }

    repo_url = f"https://{github_token}@github.com/{target_repo}.git"
    temp_dir = tempfile.mkdtemp(prefix="git-drip-")

    try:
        print(f"📥 Cloning {target_repo} (branch: {branch})...")
        repo = Repo.clone_from(repo_url, temp_dir)
        repo.git.checkout(branch)

        # Resolve destination: if item_subpath ends with /, it's a directory
        if item_subpath and not item_subpath.endswith("/"):
            dest_path = os.path.join(temp_dir, item_subpath)
        else:
            dest_path = os.path.join(temp_dir, item_subpath or "", filename)

        os.makedirs(os.path.dirname(os.path.abspath(dest_path)), exist_ok=True)

        print(f"📦 Copying '{filename}' → '{dest_path}'")
        shutil.copy2(item["contentPath"], dest_path)

        # Stage, commit, push via GitPython
        relative_dest = os.path.relpath(dest_path, temp_dir)
        repo.index.add([relative_dest])
        repo.index.commit(commit_msg)

        print(f"🚀 Pushing to {target_repo}/{branch}...")
        origin = repo.remote(name="origin")
        origin.push()

        commit_hash = repo.head.commit.hexsha
        print(f"✅ Deployed! Hash: {commit_hash[:7]}")
        return {"success": True, "commitHash": commit_hash, "error": None}

    except Exception as e:
        print(f"🚨 deployToTarget failed: {e}")
        return {"success": False, "commitHash": None, "error": str(e)}

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
