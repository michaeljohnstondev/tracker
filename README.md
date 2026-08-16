# tracker

A personal tracker app. Reuses the "Vibe" neon UI kit from the other apps
(`snapple-park`) — same theme, buttons, and time picker.

## What it does

The home screen is a list of trackers. Each one is a **timer** or a **list**.

### Timer trackers

Count up from a start time — the original fasting use case, now repeatable
for anything.

- **Start now** — tap when it begins; the timer counts up.
- **Set start time** — forgot to tap? Pick the time it actually began (if the
  time lands in the future it's treated as yesterday).
- **Goal** — pick a target (13 / 16 / 18 / 20 / 24h); a bar shows progress and
  keeps counting past the goal.
- **Stop & Reset** — ends the current run.

### List trackers

A simple checklist — add items, tick them off, clear the completed ones.

Everything survives app restarts and reboots. Timers store only the absolute
start timestamp, so elapsed time is recomputed rather than counted. All state
is on-device (AsyncStorage). No account, no network.

## Run it

```
cd C:\dev\tracker
npm install
npm start
```

Then scan the QR with Expo Go (or press `a` / `i` / `w` for Android / iOS / web).

## Builds and updates

Preview builds are internal-distribution APKs, and they receive JS-only
changes over the air:

```
eas build --profile preview --platform android   # native/config changes
eas update --branch preview --platform all       # JS-only changes
```

A rebuild is only needed when native code or app config changes — everything
else ships as an update to the `preview` channel.

## Later ideas

Fast history log, per-tracker notifications, possible public release. The name
is kept generic (`tracker`) so it can grow beyond any one use case.

## Structure

- `App.js` — root providers, plus a tiny two-route switch (home ↔ detail)
- `src/store/TrackerContext.js` — the tracker array, mutations, persistence
- `src/lib/trackers.js` — tracker shapes, id generation, load/save, legacy migration
- `src/lib/format.js` — elapsed/remaining/start-time formatters, color resolution
- `src/lib/useNow.js` — 1s ticking clock that refreshes on app foreground
- `src/screens/` — `HomeScreen`, `TimerDetailScreen`, `ListDetailScreen`
- `src/components/` — `TrackerCard`, `ScreenHeader`, `AddTrackerModal`
- `src/components/ui/` — copied Vibe components (`VibeButton`, `VibeScreen`,
  `VibeTimePicker`, `VibeInput`, `VibeSegmentedControl`, `VibeAlert`)
- `src/theme/themes.js` — copied Vibe theme

### Storage

All trackers live under one `trackers.v1` key as a JSON array. On first run
the v1 keys (`fast.startMs` / `fast.goalHours`) are migrated once into a
"Fast" timer tracker, then deleted — so an in-progress fast is never lost.
