# Commit Chrono - Master Tutorial

Welcome to Commit Chrono! This guide will walk you through exactly how to set up, configure, and automate your GitHub commits using the application.

## Table of Contents
1. [Initial Setup (The Wizard)](#1-initial-setup-the-wizard)
2. [Connecting Your Repositories](#2-connecting-your-repositories)
3. [The Drop Zone & Queue](#3-the-drop-zone--queue)
4. [Setting Up Dependencies (File Linking)](#4-setting-up-dependencies)
5. [Using Habit Goals & AI Splitter](#5-using-habit-goals--ai-splitter)
6. [Handling T-Minus Notifications & Aborting](#6-handling-t-minus-notifications--aborting)

---

### 1. Initial Setup (The Wizard)
When you first launch the `.exe` file, a Setup Wizard will appear to help you configure the bot's engine.

**Generating your GitHub Token (PAT):**
1. Log in to your account at GitHub.com.
2. Click your profile picture in the top right -> **Settings**.
3. Scroll down the left sidebar and click **Developer settings**.
4. Click **Personal access tokens** -> **Tokens (classic)**.
5. Click **Generate new token (classic)** in the top right.
6. Name it "Commit Chrono".
7. Under **Select scopes**, check the box next to `repo` (this gives it permission to push code).
8. Scroll to the bottom and click **Generate token**.
9. Copy the long text string (starts with `ghp_...`) and paste it into the Commit Chrono Setup Wizard.

**Setting up your Notification URL:**
- We highly recommend using **ntfy.sh** for privacy.
- Go to `https://ntfy.sh` in your browser.
- Type in a random, secret topic name (e.g., `commit-chrono-alerts-9912`) and click Subscribe.
- In the Commit Chrono Wizard, select **Ntfy.sh** and type in that exact URL: `https://ntfy.sh/commit-chrono-alerts-9912`.

---

### 2. Connecting Your Repositories
Commit Chrono can manage multiple different projects at once.

1. On the left sidebar of the dashboard, click **+ Add Repo**.
2. Because you entered your PAT in the wizard, the app will automatically display a list of every public and private repository on your GitHub account.
3. Click on the repository you want the bot to manage. 
4. It will now appear as a "Schedule Card" in the left sidebar. You can click on it to make it your "Active" schedule.

---

### 3. The Drop Zone & Queue
The core workflow revolves around giving the bot code files that you want it to push *eventually*.

1. Write a bunch of code in your code editor as you normally would.
2. When you finish a file (e.g., `login.js`), drag and drop that file from your computer directly into the dashed **Drop Zone** in the center of the app.
3. The file will instantly appear in the **Queue** below the Drop Zone with a yellow "Pending" dot.
4. The Python Engine will now periodically check this queue. When the time is right, it will commit and push the file to the currently active repository.

---

### 4. Setting Up Dependencies
What if you drag in `database.js` and `api.js`, but `api.js` will break if `database.js` isn't pushed first?

1. Click on `api.js` inside the Queue list. A modal will pop up.
2. Look for the dropdown labeled **"Depends On"**.
3. Select `database.js` from the dropdown list.
4. Click **Save Settings**.
5. The engine is now locked. It will absolutely refuse to push `api.js` until it has successfully pushed `database.js`.

---

### 5. Using Habit Goals & AI Splitter
You can customize *how* the bot helps you build habits and manage large files:

- **Habit Goals:** Click the **Config** button to select a target like "Weekend Warrior" or "The 9-to-5". The bot will monitor your local commits and send a push notification to your phone if you forget to commit real code on your target days.
- **AI Code Splitter:** If you drop a massive, monolithic file into the app, the Gemini AI engine can automatically read it and break it down into clean, atomic commits for a perfect git history.
- **Jitter:** If you schedule the queue to push at 9:00 AM, a Jitter of 120 minutes means the bot will randomly push anywhere between 7:00 AM and 11:00 AM, giving your batched commits a natural flow.

---

### 6. Handling T-Minus Notifications & Aborting
Commit Chrono is built to give you a safety net. 

1. If you set your **Notify Before** time to 10 minutes, the bot will send a notification to your phone (via Ntfy or Discord) exactly 10 minutes before it executes a push.
2. A large, red **LIVE PUSH** banner will appear at the top of the app.
3. If you realize you dragged in a file with a bug, or you simply changed your mind, click the **[ABORT PUSH]** button on that banner.
4. The bot will instantly halt the operation, preserving your repository state.

---
*Happy Automating!*
