# tracker

A personal fasting tracker. Reuses the "Vibe" neon UI kit from the other apps
(`snapple-park`) — same theme, buttons, and time picker.

## What it does (v1)

- **Start now** — tap when you finish a meal; the timer counts up.
- **Set start time** — forgot to tap? Pick the time your fast actually began
  (if the time lands in the future it's treated as yesterday).
- **Goal** — pick a target (13 / 16 / 18 / 20 / 24h); a bar shows progress and
  keeps counting past the goal.
- **Stop & Reset** — ends the current fast.

The current fast survives app restarts and reboots — only the absolute start
timestamp is stored (on-device, via AsyncStorage). No account, no network.

## Run it

```
cd C:\dev\tracker
npm install
npm start
```

Then scan the QR with Expo Go (or press `a` / `i` / `w` for Android / iOS / web).

## Later ideas

Goal tracker + todo list, fast history log, possible public release. Kept the
name generic (`tracker`) so it can grow beyond fasting.

## Structure

- `App.js` — root, providers + status bar
- `src/screens/FastScreen.js` — all the fasting logic + UI
- `src/lib/storage.js` — AsyncStorage read/write
- `src/theme/themes.js` — copied Vibe theme
- `src/components/ui/` — copied Vibe components (`VibeButton`, `VibeScreen`, `VibeTimePicker`)
