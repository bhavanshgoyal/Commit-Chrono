# git-drip — Design Decisions & Notes

## Stack
- **Bot language:** Python 3.11
- **Runner:** GitHub Actions (cron `*/15 * * * *` + `workflow_dispatch`)
- **Dashboard (Phase 6):** Node.js + React, hosted on Vercel
- **Notifications:** Discord (webhook via `ALERT_WEBHOOK` secret)
- **Auth:** Single Fine-Grained PAT (`GH_PAT`) — GitHub handles per-repo access scoping

## Architecture

```
cron (every 15 min)
  └── bot/main.py
        ├── processResolutions()       # consume any resolve-*.json files first
        └── for schedule in schedules[]:
              ├── checkAndNotify()     # T-minus-N Discord alert
              ├── isSkipDay()          # honour skipDates[]
              ├── shouldRunNow()       # span + time window + jitter
              ├── checkAborted()       # per-slot abort flag
              ├── intensityToCount()   # how many commits today
              └── runOneCommitCycle() × N
                    ├── listPendingItems()
                    ├── getNextQueueItem()   # priority + eligibility sort
                    ├── delayWithJitter()
                    ├── applyQueueItem() / deployToTarget()
                    ├── commitAndPushWithRetry()
                    └── markItemUsed()
```

## Queue Design: Flat Directory + Data Routing

`queue/pending/` is a **flat directory** — no subfolders per repo or schedule.
Routing (which repo, which path) lives **inside each item's `.meta.json`**, not in the filesystem.

**Why:**
- AI context efficiency: one flat scan is easier than recursive directory crawling
- Single source of truth: no possibility of folder name vs. JSON disagreeing
- GitHub's Fine-Grained PAT handles repo-level access control on the server side

## `.meta.json` Schema (all fields)

```json
{
  "priority":         "high | normal | low",
  "addedAt":          "ISO 8601",
  "notEligibleUntil": "ISO 8601 | null",
  "dependsOn":        "filename | null",
  "held":             false,
  "lastSkippedAt":    "ISO 8601 | null",
  "type":             "general | feature | fix | refactor | docs | test | chore",
  "scheduleId":       "schedule id | null  (null = visible to all schedules)",
  "targetRepo":       "owner/repo | null  (falls back to schedule.repo)",
  "targetPath":       "path/in/repo/ | null  (falls back to schedule.targetPath)"
}
```

## Target Path Strategy

For **`mode: self`** schedules:
- `item.meta.targetPath` (per-item override) takes precedence
- Falls back to `schedule.targetPath` (e.g. `src/`)
- Files land in the bot repo itself under that path

For **`mode: external`** schedules:
- `deployToTarget()` clones the target repo into a temp dir, copies the file,
  commits, pushes, then deletes the temp dir
- `item.meta.targetRepo` overrides `schedule.repo`
- `item.meta.targetPath` overrides `schedule.targetPath`

## Abort Flag Convention

File path: `queue/pending/abort-<scheduleId>-<urlSafeSlotId>.flag`
`urlSafe()` replaces `:`, `+`, `.` with `-`.

Example: schedule `my-portfolio`, slot `2026-07-27T09:00:00+05:30`
→ `queue/pending/abort-my-portfolio-2026-07-27T09-00-00-05-30.flag`

Commit an empty file with this path to abort the next push for that slot.

## Empty Queue Behaviour

When no items are in the queue for a schedule, the bot logs:
```json
{ "status": "skipped", "error": "empty queue" }
```
**No fallback commit is made.** Real developers take days off — an unbroken
streak of trivial log updates defeats the point of the bot.

## CLI Name

`git-drip` — reflects the drip-feed queue mechanism.
PyPI package: `git-drip` (Phase 8).

## Module Map

| File | Responsibility |
|---|---|
| `bot/utils.py` | getCurrentDateTime, loadConfig, urlSafe, writeMetaFile |
| `bot/scheduler.py` | isWithinSpan, isScheduledNow, isSkipDay, shouldRunNow, getCurrentSlotId |
| `bot/queue_manager.py` | listPendingItems, getNextQueueItem, applyQueueItem, markItemUsed |
| `bot/git_ops.py` | runGitCommand, checkForConflict, commitAndPushWithRetry, deployToTarget |
| `bot/alerts.py` | sendAlert (Discord), checkAndNotify, armed-slot dedup |
| `bot/logger.py` | logRun with corruption recovery |
| `bot/abort_handler.py` | checkAborted, handleAbort (3 modes), resolveReschedule (5 choices) |
| `bot/intensity.py` | getIntensity, intensityToCount, generateIntensityMap |
| `bot/main.py` | Multi-schedule loop, runOneCommitCycle, processResolutions |