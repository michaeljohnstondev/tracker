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

/**
 * Start of the current repeat period, as a timestamp.
 *
 * A daily item resets at local midnight and a weekly one on Monday morning,
 * rather than 24 hours or 7 days after it was last ticked — "daily" means
 * once a day, not once every twenty-four hours. Ticking something at 11pm
 * shouldn't leave it done until 11pm tomorrow.
 */
export function periodStart(repeat, at = Date.now()) {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  if (repeat === 'weekly') {
    // getDay() is 0 for Sunday; shift so the week starts on Monday.
    const weekday = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - weekday);
  }
  return d.getTime();
}

/** True when a repeating item was completed in an earlier period. */
export function isStale(item) {
  if (!item?.repeat || !item.done) return false;
  return (item.doneAt ?? 0) < periodStart(item.repeat);
}

// Resolve a stored color name (e.g. 'vibeBlue') to its hex, with a
// sensible fallback so a bad/missing value never crashes rendering.
export function resolveColor(name) {
  return theme.colors[name] || theme.colors.vibeBlue;
}
