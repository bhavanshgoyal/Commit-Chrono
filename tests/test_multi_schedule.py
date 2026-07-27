import sys
import os
from unittest.mock import patch, MagicMock

# Add project root to path so we can import bot
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from bot import main as bot_main


def test_crash_isolation():
    """
    Test that if one schedule crashes during its commit cycle,
    the bot catches the exception, logs it, and continues to the next schedule.
    """
    mock_config = {
        "schedules": [
            {
                "id": "schedule-crash",
                "timezone": "UTC",
                "times": ["12:00"],
                "spanDays": 10,
                "startDate": "2026-07-26",
                "intensity": {}
            },
            {
                "id": "schedule-safe",
                "timezone": "UTC",
                "times": ["12:00"],
                "spanDays": 10,
                "startDate": "2026-07-26",
                "intensity": {}
            }
        ]
    }

    print("--- Starting Multi-Schedule Crash Isolation Test ---\n")

    # We mock everything that touches the disk or git
    with patch("bot.main.loadConfig", return_value=mock_config), \
         patch("bot.main.shouldRunNow", return_value=True), \
         patch("bot.main.isSkipDay", return_value=False), \
         patch("bot.main.checkAborted", return_value=False), \
         patch("bot.main.getCurrentSlotId", return_value="2026-07-27T12:00:00+00:00"), \
         patch("bot.main.checkAndNotify"), \
         patch("bot.main.getIntensity", return_value="normal"), \
         patch("bot.main.intensityToCount", return_value=1), \
         patch("bot.main.processResolutions"), \
         patch("bot.main.logRun") as mock_log, \
         patch("bot.main.sendAlert") as mock_alert, \
         patch("bot.main.runOneCommitCycle") as mock_cycle:

        # Make schedule 1 crash, schedule 2 succeed
        def side_effect(schedule, messages_pool):
            if schedule["id"] == "schedule-crash":
                print(f"[TEST] Triggering simulated crash for {schedule['id']}...")
                raise RuntimeError("Simulated synthetic crash!")
            else:
                print(f"[TEST] {schedule['id']} executing safely.")

        mock_cycle.side_effect = side_effect

        # Run the main loop
        bot_main.main()

        print("\n--- Test Assertions ---")
        
        # 1. Did the loop try to run the safe schedule despite the crash?
        assert mock_cycle.call_count == 2, f"Expected 2 cycles, got {mock_cycle.call_count}"
        print("[OK] Loop did not break. 'schedule-safe' was processed.")

        # 2. Was the crash logged as a failure?
        logged_failure = False
        for call in mock_log.call_args_list:
            entry = call.args[0]
            if entry.get("status") == "failure" and "Simulated synthetic crash" in str(entry.get("error")):
                logged_failure = True
        
        assert logged_failure, "Crash was not logged to run-log.json"
        print("[OK] Crash was properly caught and logged.")

        # 3. Was a Discord alert sent for the crash?
        alerted = any("Bot crashed: Simulated synthetic crash" in call.args[0] for call in mock_alert.call_args_list)
        assert alerted, "Crash did not trigger a Discord alert"
        print("[OK] Crash triggered a Discord failure alert.")

        print("\n[SUCCESS] Multi-Schedule Isolation Test Passed!")


if __name__ == "__main__":
    test_crash_isolation()
