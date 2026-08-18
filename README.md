# Switchboard

A desktop app for tracking accounts you switch between, so you never leave one open by accident. Built from the Figma design — pixel-art / retro-terminal styling on the blueberry-cheesecake palette.

## How it works

1. **Log your accounts** — add each account you use (name + optional notes).
2. **Switch away** — when you leave an account to work on another, click **SWITCH >**. A countdown starts (5 minutes by default, adjustable via the return window field).
3. **If you forget it** — once the countdown hits zero, the account shakes, dims, and jumps to the top of the list with an "OVERDUE" tag, and the header chip flips to a blinking "ALERT."
4. **Resolving one** — click **I'M BACK** on that specific account to clear it. Only that account is affected; every other pending or overdue account stays exactly as it was until you deal with it individually.

## Running it in development

You need [Node.js](https://nodejs.org) (v18+).

```bash
npm install
npm run dev
```

This starts a Vite dev server (prints a `localhost` URL) so you can iterate on the design in a browser with hot reload.

## Running it as a desktop app

```bash
npm install
npm start
```

This builds the app and opens it in its own Electron window.

## Packaging a standalone app (optional)

To produce a double-clickable installer instead of running from a terminal:

```bash
npm run build
npm install --save-dev electron-builder
npx electron-builder --mac    # or --win / --linux
```

## Notes

- This build reflects exactly the design in `src/App.tsx` from Figma — the account list starts with three example accounts (Acme Corp, Personal, Freelance) and resets on every launch. There's no local persistence built in yet; let me know if you'd like accounts saved between sessions.
- The return window (default 5 minutes) is adjustable from the field on the main screen at any time.
