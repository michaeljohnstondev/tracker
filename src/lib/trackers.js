import AsyncStorage from '@react-native-async-storage/async-storage';

// All trackers live under one key as a JSON array. Each tracker carries
// its own type-specific fields; unused fields just stay null/empty.
const KEY = 'trackers.v1';

// Home-screen ordering is stored separately, as a plain list of tracker ids.
// Keeping it out of the tracker records themselves means it can also cover
// shared lists — whose documents are owned by Firestore and shared with other
// people, so a personal ordering has no business living there. Two people
// arranging their own home screens never fight over it.
const ORDER_KEY = 'trackerOrder.v1';

// Legacy keys from the original single-fast version — migrated once into
// a "Fast" timer tracker so an in-progress fast is never lost.
const LEGACY_START = 'fast.startMs';
const LEGACY_GOAL = 'fast.goalHours';

export const TRACKER_COLORS = [
  'vibeBlue',
  'vibeGreen',
  'vibePurple',
  'vibeOrange',
  'vibePink',
  'vibeTeal',
];

let idCounter = 0;
export function newId() {
  // Date.now + a short counter/rand keeps ids unique even when several
  // are created within the same millisecond.
  idCounter = (idCounter + 1) % 1000;
  return `${Date.now().toString(36)}${idCounter.toString(36)}${Math.floor(
    Math.random() * 1296
  ).toString(36)}`;
}

// Defaults to an hour rather than a 16-hour fast: this is a general timer now.
export function makeTimerTracker({ name, color, goalHours = 1 }) {
  return {
    id: newId(),
    type: 'timer',
    name,
    color,
    createdAt: Date.now(),
    startMs: null,
    goalHours,
    items: [],
  };
}

export function makeListTracker({ name, color }) {
  return {
    id: newId(),
    type: 'list',
    name,
    color,
    createdAt: Date.now(),
    startMs: null,
    goalHours: null,
    items: [],
  };
}

/**
 * A category is a tracker that holds other trackers — a folder, and it can
 * hold other categories to any depth.
 *
 * Unlimited nesting is safe here precisely because a category is never itself
 * shared: sharing one shares the lists inside it, and the recipient files
 * those wherever they like. So the tree is local bookkeeping and never
 * something security rules have to walk.
 */
export function makeCategoryTracker({ name, color }) {
  return {
    id: newId(),
    type: 'category',
    name,
    color,
    createdAt: Date.now(),
    startMs: null,
    goalHours: null,
    items: [],
  };
}

export async function loadTrackers() {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw != null) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through to migration / empty
    }
  }
  // First run: migrate a legacy fast if one exists.
  const migrated = await migrateLegacyFast();
  await saveTrackers(migrated);
  return migrated;
}

export async function saveTrackers(trackers) {
  await AsyncStorage.setItem(KEY, JSON.stringify(trackers));
}

// Which category a tracker sits in, as trackerId -> categoryTrackerId. Stored
// on the device rather than on the shared document, the same as ordering: it's
// personal shelving. A list you keep under Shopping may live somewhere else
// entirely for whoever you share it with, and neither overwrites the other. It
// also means a shared tracker, which has no local record, can still be filed.
//
// Superseded the earlier flat-label version, whose values were category names
// rather than ids; those are ignored rather than migrated, since there were
// only ever a handful.
const PARENT_KEY = 'trackerParents.v1';

/**
 * Categories a tracker may legally be filed into.
 *
 * Excludes itself and anything already inside it: filing a category into its
 * own descendant would detach that branch from the tree and orphan everything
 * in it. The upward walk is loop-guarded so corrupt data can't hang it.
 */
export function filingTargets(trackers, tracker) {
  const byId = new Map(trackers.map((t) => [t.id, t]));

  const isInside = (candidate) => {
    let parent = candidate.parentId;
    const seen = new Set();
    while (parent && !seen.has(parent)) {
      if (parent === tracker?.id) return true;
      seen.add(parent);
      parent = byId.get(parent)?.parentId ?? null;
    }
    return false;
  };

  return trackers.filter(
    (t) => t.type === 'category' && t.id !== tracker?.id && !isInside(t)
  );
}

export async function loadTrackerParents() {
  const raw = await AsyncStorage.getItem(PARENT_KEY);
  if (raw == null) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveTrackerParents(map) {
  await AsyncStorage.setItem(PARENT_KEY, JSON.stringify(map));
}

export async function loadTrackerOrder() {
  const raw = await AsyncStorage.getItem(ORDER_KEY);
  if (raw == null) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveTrackerOrder(ids) {
  await AsyncStorage.setItem(ORDER_KEY, JSON.stringify(ids));
}

async function migrateLegacyFast() {
  const [start, goal] = await Promise.all([
    AsyncStorage.getItem(LEGACY_START),
    AsyncStorage.getItem(LEGACY_GOAL),
  ]);
  const fast = makeTimerTracker({
    name: 'Fast',
    color: 'vibeBlue',
    goalHours: goal != null ? Number(goal) : 16,
  });
  if (start != null) fast.startMs = Number(start);
  // Clean up the old keys so we don't migrate twice.
  await Promise.all([
    AsyncStorage.removeItem(LEGACY_START),
    AsyncStorage.removeItem(LEGACY_GOAL),
  ]);
  return [fast];
}
