```text
  ██████╗ ██████╗ ███╗   ███╗███╗   ███╗██╗████████╗    ██████╗ ██╗  ██╗██████╗  ██████╗ ███╗   ██╗██████╗ 
 ██╔════╝██╔═══██╗████╗ ████║████╗ ████║██║╚══██╔══╝   ██╔════╝ ██║  ██║██╔══██╗██╔═══██╗████╗  ██║██╔═══██╗
 ██║     ██║   ██║██╔████╔██║██╔████╔██║██║   ██║      ██║      ███████║██████╔╝██║   ██║██╔██╗ ██║██║   ██║
 ██║     ██║   ██║██║╚██╔╝██║██║╚██╔╝██║██║   ██║      ██║      ██╔══██║██╔══██╗██║   ██║██║╚██╗██║██║   ██║
 ╚██████╗╚██████╔╝██║ ╚═╝ ██║██║ ╚═╝ ██║██║   ██║      ╚██████╗ ██║  ██║██║  ██║╚██████╔╝██║ ╚████║╚██████╔╝
  ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚═╝╚═╝   ╚═╝       ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝ 
```

# The Origin of Commit Chrono

### The Cause: The Green Square Anxiety
In the modern software engineering world, the GitHub contribution graph has become a silent resume. Developers face immense pressure to maintain a perfectly manicured "green wall" of activity to prove they are consistently coding. 

This leads to two massive problems:
1. **Burnout:** Developers force themselves to push code every single day, even on weekends or late at night, just to keep a streak alive. 
2. **Privacy Risks:** To combat this, developers turn to SaaS automation tools that promise to "schedule" their commits. But these tools require you to hand over your **Personal Access Tokens (PAT)** to a centralized, third-party server. If that server is hacked, your private repositories and code are entirely compromised.

### The Solution: The Organic Committer
**Commit Chrono** was built to solve the "Green Square Anxiety" without sacrificing privacy or organic engineering habits.

We believe that code automation should happen on **your** hardware. 

How it solves the problem:
- **100% Local-First Privacy:** The engine is built using Rust, React, and Python, running entirely on your local machine. Your Personal Access Token never leaves your hard drive, meaning zero risk of centralized data breaches.
- **Organic Workflows:** Instead of rigid, robotic automation, Commit Chrono introduces "Jitter"—randomizing the exact minute your code is pushed so that the graph looks entirely human.
- **Intelligent Habit Goals:** Commit Chrono acts as a personal coach. By setting a Habit Goal (like "Weekend Warrior" or "The 9-to-5"), the app monitors your local activity and sends you push notifications to your phone to remind you to do real work when your streak is in danger.
- **AI Code Splitter:** Powered by Gemini, the app can take massive, monolithic files written in a single caffeine-fueled weekend, and automatically break them down into clean, atomic commits for easier code review.
- **Granular Control:** With visual dependency chains ("Don't push file B until file A is complete") and T-Minus mobile alerts via Ntfy/Discord, you have absolute control over when and how your code hits the internet.

We built this so you can code at your own pace, dump your files into the Drop Zone, and let the Chrono engine organically build your graph while you sleep.
