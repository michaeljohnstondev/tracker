import theme from '../theme/themes';

export const pad = (n) => String(n).padStart(2, '0');

// Elapsed ms -> "HH:MM:SS" (hours can exceed 24 for a long timer).
export function fmtElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// Compact "12h 03m" for card summaries (no seconds).
export function fmtElapsedShort(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${pad(m)}m`;
  return `${m}m`;
}

// Friendly "8:30 PM · Sat Aug 16" label for a moment in time.
export function fmtStart(ms) {
  const d = new Date(ms);
  let h = d.getHours();
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const time = `${h}:${pad(d.getMinutes())} ${period}`;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${time} · ${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`;
}

// "6h left" / "goal reached" for a timer with a target.
export function fmtRemaining(elapsedMs, goalMs) {
  const remaining = goalMs - elapsedMs;
  if (remaining <= 0) return 'Goal reached ✨';
  const total = Math.floor(remaining / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${pad(m)}m left`;
  return `${m}m left`;
}

// Resolve a stored color name (e.g. 'vibeBlue') to its hex, with a
// sensible fallback so a bad/missing value never crashes rendering.
export function resolveColor(name) {
  return theme.colors[name] || theme.colors.vibeBlue;
}
