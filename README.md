# Switchboard

A small desktop app for tracking accounts you juggle throughout the day, so nothing gets left unattended without you noticing. Pixel-art / retro-terminal styling on a blueberry-cheesecake palette.

## How it works

1. **Add an account** — type a name and hit **+ ADD** (or press Enter). Tracking starts immediately — no extra step needed.
2. **The clock runs automatically** — every account counts down on its own (5 minutes by default, adjustable via the **MIN** field next to Add).
3. **If it runs out** — the account shakes once, dims, jumps to the top of the list with an "OVERDUE" tag, the header flips to a blinking "ALERT," and a short bell chime plays (once — it won't keep ringing while the alert is active).
4. **Click "I'M BACK"** — clears the alert and immediately starts a fresh countdown. It only affects that one account; everything else stays exactly as it was.
5. **Click "■ STOP"** — pauses tracking for an account you're not actively juggling right now (dims it, no countdown). Click **RESUME >** to start it back up whenever.
6. **HISTORY** — click the "HISTORY" link above the account list to see a timestamped log of everything (added, overdue, confirmed, stopped, resumed, removed). Any account no longer in your active list gets a **+** button so you can one-click re-add it.

### It remembers you — sort of

Your accounts and their timers are saved automatically. If you close the app by accident and reopen it **within 5 minutes**, everything picks up exactly where it left off — including timers, computed from real elapsed time, as if the app was never closed. If you reopen it **more than 5 minutes later**, it assumes you were done for the day and starts fresh and empty. This 5-minute grace period is fixed and separate from the per-account return-window setting.

### The window itself

- Frameless — no native title bar. Drag the purple "SWITCHBOARD.EXE" bar at the top to move the window.
- Three dots at the top right are real window controls: orange = minimize, purple = maximize/restore, red = close.
- Opens at its smallest usable size by default. It's resizable if you want more room — the accounts list scrolls internally once it doesn't fit, so the rest of the app (title bar, add-account row) never gets squeezed out.

## Project structure

```
src/
  App.tsx        React app — all UI, state, and logic
  main.tsx       React entry point
  index.css      Global styles, fonts, animations
electron/
  main.cjs       Electron main process (window creation, frameless setup, menu removal)
  preload.cjs    Safely exposes window controls (minimize/maximize/close) to the app
index.html       Vite entry HTML
```

## Running it in development

You need [Node.js](https://nodejs.org) (v18+).

```bash
npm install
npm run dev
```

This starts a Vite dev server (prints a `localhost` URL) so you can iterate in a browser with hot reload. Note: window controls (the colored dots) only work inside the actual Electron app, not a browser tab.

## Running it as a desktop app

```bash
npm install
npm start
```

Builds the app and opens it in its own frameless Electron window.

## Packaging a standalone installer

To produce a real installer/executable instead of running from a terminal every time:

```bash
npm install
npm run dist
```

This builds the app and packages it with `electron-builder`. Look inside the new `release/` folder for the installer (e.g. `Switchboard Setup 1.0.0.exe` on Windows). Double-clicking it installs Switchboard like any normal desktop app.

## Notes

- All data (accounts, history, your return-window setting) lives in the app's local storage on your machine — nothing is synced or backed up elsewhere. Pushing this project to GitHub backs up the *code*, not your saved accounts/history.
- History keeps the most recent 200 events and won't grow unbounded; use "CLEAR HISTORY" in the popup to wipe it manually anytime.
- The bell is synthesized in-browser (Web Audio API) — no external sound file to manage or that could fail to load.