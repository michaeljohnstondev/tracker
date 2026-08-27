import { darkTheme } from '../theme/themes';

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
 * When a running timer reaches its goal, said the way you'd say it out loud.
 *
 * The day is named only when it isn't today, because "ends at 4:35 PM" is the
 * answer to the question nearly every time and a date in front of it is just
 * something to read past. A fast that runs past midnight genuinely needs it.
 */
export function fmtEndTime(endMs, now = Date.now()) {
  if (!endMs) return null;

  const end = new Date(endMs);
  const time = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const days = Math.floor((endMs - midnight.getTime()) / 86400000);

  if (days <= 0) return time;
  if (days === 1) return `${time} tomorrow`;
  if (days < 7) return `${time} ${end.toLocaleDateString([], { weekday: 'long' })}`;
  return `${time} ${end.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
}

/**
 * A due date, in the terms you'd think about it.
 *
 * Overdue comes first and says so plainly, because that's the one that changes
 * what you do next.
 */
export function fmtDue(dueAt, now = Date.now()) {
  if (!dueAt) return null;

  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const days = Math.floor((dueAt - midnight.getTime()) / 86400000);
  const due = new Date(dueAt);
  const time = due.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (dueAt < now) return days < 0 ? 'Overdue' : `Due ${time}`;
  if (days === 0) return `Due ${time}`;
  if (days === 1) return `Due tomorrow ${time}`;
  if (days < 7) return `Due ${due.toLocaleDateString([], { weekday: 'long' })}`;
  return `Due ${due.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
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

/**
 * True when a repeating item was completed in an earlier period.
 *
 * 'always' has no period, so nothing about it is ever stale. It means the item
 * is permanent — Clear leaves it alone and it stays ticked until you untick it
 * yourself — rather than that it comes back on a schedule.
 */
export function isStale(item) {
  if (!item?.repeat || item.repeat === 'always' || !item.done) return false;
  return (item.doneAt ?? 0) < periodStart(item.repeat);
}

/**
 * True when a counter on a repeating item was last touched in an earlier
 * period — so today's reps start from zero.
 *
 * Deliberately not tied to `done`: you count without ever ticking the item off,
 * and a tally that carried over from yesterday would be worse than useless.
 */
export function isCountStale(item) {
  if (!item?.repeat || item.repeat === 'always') return false;
  if (item.count == null || item.count === 0) return false;
  return (item.countedAt ?? 0) < periodStart(item.repeat);
}

// Resolve a stored color name (e.g. 'vibeBlue') to its hex, with a
// sensible fallback so a bad/missing value never crashes rendering.
//
// The theme comes in as an argument rather than being imported: this module is
// plain functions, not components, so it cannot read the active theme itself.
// Callers that render pass the theme they already hold; the dark default keeps
// non-rendering callers working unchanged.
export function resolveColor(name, theme = darkTheme) {
  return theme.colors[name] || theme.colors.vibeBlue;
}
