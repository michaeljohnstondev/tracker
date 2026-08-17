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

// Categories are a flat label rather than real nesting. Folders inside
// folders would raise questions with no good answer — whether a shared list
// can live in a private folder, what reordering means across levels — and a
// household app doesn't need that depth to stop the home screen sprawling.
export const TRACKER_CATEGORIES = ['Goals', 'To-do', 'Shopping', 'Health', 'Other'];

// Anything created before categories existed reads as this.
export const DEFAULT_CATEGORY = 'Other';

export const categoryOf = (tracker) =>
  TRACKER_CATEGORIES.includes(tracker?.category)
    ? tracker.category
    : DEFAULT_CATEGORY;

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

export function makeTimerTracker({ name, color, goalHours = 16, category = DEFAULT_CATEGORY }) {
  return {
    id: newId(),
    type: 'timer',
    name,
    color,
    category,
    createdAt: Date.now(),
    startMs: null,
    goalHours,
    items: [],
  };
}

export function makeListTracker({ name, color, category = DEFAULT_CATEGORY }) {
  return {
    id: newId(),
    type: 'list',
    name,
    color,
    category,
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

// Category lives on the device, keyed by tracker id, rather than on the list
// document — the same reasoning as ordering. It's personal shelving: a list
// you file under Shopping may be Health to whoever you share it with. It also
// means a shared list, which has no local record, can still be filed.
const CATEGORY_KEY = 'trackerCategories.v1';

export async function loadTrackerCategories() {
  const raw = await AsyncStorage.getItem(CATEGORY_KEY);
  if (raw == null) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveTrackerCategories(map) {
  await AsyncStorage.setItem(CATEGORY_KEY, JSON.stringify(map));
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
