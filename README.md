<div align="center">
  <img src="https://github.com/user-attachments/assets/cd0c1c87-a3f1-4db3-bb66-c9569ba5432a" alt="Commit Chrono Logo" width="150" />
  <h1>Commit Chrono</h1>
  <p><strong>A Local-First, Privacy-Respecting GitHub Automator.</strong></p>
</div>

---

## 🕒 The Organic Committer

**Commit Chrono** is an advanced desktop application (built with Tauri + React) paired with a background Python Engine that completely automates your GitHub activity graph.

Unlike SaaS platforms that hold your GitHub tokens on central servers, **Commit Chrono runs 100% locally on your hardware**. Your tokens, your code, and your git history never touch our servers.

### Key Features
- 🔒 **Local-First Architecture:** The React UI configures rules that a local Python cron-job executes. Your `GH_PAT` (Personal Access Token) is stored securely on your own hard drive.
- 🔗 **Dependency Queuing:** Drag and drop large features, and tell the engine "Do not push File B until File A is synced".
- 📅 **Date Locking:** Prevent the bot from pushing a specific file before a certain date (`notEligibleUntil`).
- 🔔 **T-Minus Notifications:** Pings your phone (via Discord or Ntfy.sh) 10 minutes before a push, giving you time to hit the glowing **[ABORT PUSH]** button if you spot a bug.
- 🎨 **Deep Customization:** Modify jitter (randomized times), skip dates, and abort behaviors per repository.

---

## ⚡ Chrono Mods

Commit Chrono ships with powerful algorithmic graph modifiers:
- **Time Machine Mode:** Missed a week of coding? The bot can alter the `GIT_AUTHOR_DATE` to safely backdate commits into the past, filling your graph organically.
- **Ghost Coder:** Simulates late-night engineering by forcing the engine to wake up and push strictly between 2:00 AM and 4:00 AM local time.

---

## 🚀 Getting Started

1. **Download the Installer:** Grab the `.exe` from the Releases page.
2. **Setup Wizard:** Upon first launch, the app will guide you through generating a GitHub PAT and pasting it into the app.
3. **Configure Notifications:** Enter a [Ntfy.sh](https://ntfy.sh) topic URL (recommended for privacy) or a Discord Webhook.
4. **Fetch Repos:** Click `+ Add Repo` to pull your projects directly from GitHub.
5. **Drop & Forget:** Drag files into the Drop Zone, assign them to a repo, and let the Python engine organically drip-feed them to your GitHub profile.

---

### Architecture 
- **Frontend:** React + Vite, styled with a deep midnight glassmorphic UI.
- **Backend:** Rust (Tauri) handles the fast IPC, reads/writes local `config.json` state, and creates dependency sidecars (`meta.json`).
- **Engine:** Python (`bot/`) acts as the cron-daemon that performs the physical `git push` commands.

*Built for those who code hard locally but want an automated, beautiful GitHub graph.*
