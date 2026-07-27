import sys
import os
import json
import tempfile
from datetime import datetime
from unittest.mock import patch, MagicMock

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from bot.abort_handler import checkAborted, handleAbort, resolveReschedule
from bot.utils import getCurrentDateTime

def test_abort_logic():
    print("--- Starting Abort & Reschedule Test ---\n")

    # 1. Test checkAborted
    print("[TEST] 1. checkAborted()")
    with patch("os.path.exists") as mock_exists:
        mock_exists.return_value = True
        is_aborted = checkAborted("my-schedule", "2026-07-27T09:00:00+00:00")
        assert is_aborted == True, "Failed to detect existing abort flag"
        
        # Verify the filename formatting (replacing : + .)
        args = mock_exists.call_args[0][0]
        assert "abort-my-schedule-2026-07-27T09-00-00-00-00.flag" in args.replace("\\", "/"), f"Wrong flag filename generated: {args}"
    print("[OK] Abort flag path generation and detection works.")

    # 2. Test handleAbort - require-rearm
    print("\n[TEST] 2. handleAbort() - require-rearm")
    item = {
        "filename": "test.py",
        "metaPath": "test.py.meta.json",
        "meta": {"held": False}
    }
    schedule = {"id": "my-schedule", "abortBehavior": "require-rearm"}
    
    with patch("bot.abort_handler.writeMetaFile") as mock_write, \
         patch("bot.alerts.sendAlert"):
        
        substitute = handleAbort(item, schedule, [], getCurrentDateTime())
        assert item["meta"]["held"] == True, "require-rearm didn't set held=True"
        assert substitute is None, "require-rearm shouldn't return a substitute"
    print("[OK] require-rearm successfully holds the item.")

    # 3. Test handleAbort - skip-to-next
    print("\n[TEST] 3. handleAbort() - skip-to-next")
    item2 = {
        "filename": "file1.py",
        "metaPath": "file1.py.meta.json",
        "meta": {}
    }
    substitute_item = {"filename": "file2.py"}
    schedule_skip = {"id": "my-schedule", "abortBehavior": "skip-to-next"}
    now = getCurrentDateTime()

    with patch("bot.abort_handler.writeMetaFile"), \
         patch("bot.queue_manager.listPendingItems", return_value=[substitute_item]), \
         patch("bot.queue_manager.getNextQueueItem", return_value=substitute_item):
        
        res = handleAbort(item2, schedule_skip, [], now)
        assert item2["meta"]["lastSkippedAt"] == now.isoformat(), "skip-to-next didn't update lastSkippedAt"
        assert res == substitute_item, "skip-to-next didn't return the substitute item"
    print("[OK] skip-to-next successfully deprioritises the item and selects a substitute.")

    # 4. Test resolveReschedule - after-x-days
    print("\n[TEST] 4. resolveReschedule() - after-x-days")
    item3 = {
        "filename": "file3.py",
        "metaPath": "file3.py.meta.json",
        "meta": {}
    }
    
    # Create a temporary resolve signal file
    with tempfile.NamedTemporaryFile(mode='w', delete=False) as f:
        json.dump({"choice": "after-x-days", "target": 5}, f)
        temp_path = f.name
    
    with patch("bot.abort_handler.writeMetaFile") as mock_write, \
         patch("bot.logger.logRun"):
         
        resolveReschedule(item3, temp_path, [])
        assert "notEligibleUntil" in item3["meta"], "after-x-days didn't set notEligibleUntil"
        assert not os.path.exists(temp_path), "Signal file wasn't deleted after processing"
    print("[OK] after-x-days successfully sets notEligibleUntil and deletes signal file.")

    print("\n[SUCCESS] All Abort & Reschedule tests passed!")


if __name__ == "__main__":
    test_abort_logic()
