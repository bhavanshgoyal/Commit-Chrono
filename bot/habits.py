from datetime import datetime, date

def check_habit_warning(schedule: dict, today: date) -> bool:
    """
    Evaluates the 'activePreset' (Habit Goal) and determines if the user
    should receive a warning today for failing to push code.
    
    Returns True if a warning should be triggered.
    """
    # Note: frontend currently saves activePreset at root or we might need to extract it
    preset = schedule.get("activePreset", "organic")
    day_of_week = today.weekday() # 0 = Monday, 6 = Sunday

    if preset == "weekend":
        if day_of_week in [5, 6]:
            return True
    elif preset == "corporate":
        if day_of_week < 5:
            return True
    elif preset == "burnout":
        if today.timetuple().tm_yday % 3 == 0:
            return True
    else: # organic
        return True
        
    return False

def get_habit_message(preset: str) -> str:
    """Returns a tailored push notification string based on the habit."""
    messages = {
        "weekend": "Hey Weekend Warrior! It's the weekend. Time to queue up some commits!",
        "corporate": "The 9-to-5 grind is on. Don't forget to push your code today.",
        "burnout": "Sprint day! Get into the zone and push a massive update.",
        "organic": "Daily Grind reminder: keep your streak alive today."
    }
    return messages.get(preset, "Reminder: keep your coding streak alive!")
