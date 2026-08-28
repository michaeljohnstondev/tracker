import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Brings forward the lists made before "Everything is a node".
 *
 * That change moved storage from `trackers.v1` to `nodes.v1` and shipped no
 * migration, so a phone updating across it opened to an empty app — the old
 * data still sitting in AsyncStorage under keys nothing reads any more. It
 * reads as total loss, and for a list that was never shared there is no copy
 * anywhere else to fall back on.
 *
 * The old shape:
 *   trackers.v1        [{ id, type, name, color, createdAt, startMs,
 *                         goalHours, items: [{ id, text, done, createdAt }] }]
 *   trackerParents.v1  { trackerId: categoryTrackerId } — personal filing
 *   trackerOrder.v1    [trackerId] — home-screen order
 *
 * `trackerCategories.v1` is deliberately skipped. It was the earlier flat
 * version whose values were category *names* rather than ids, and the code
 * that replaced it chose to drop them rather than guess; there is no more
 * information available now than there was then.
 */

const TRACKERS_KEY = 'trackers.v1';
const PARENT_KEY = 'trackerParents.v1';
const ORDER_KEY = 'trackerOrder.v1';

// Set once the old keys have been read across. The old data is deliberately
// left where it is — this is a copy forward, not a move — so without a marker
// a user who later empties the app would have it all reappear on next launch.
const DONE_KEY = 'nodes.migratedFromTrackers.v1';

async function readJson(key, fallback) {
  const raw = await AsyncStorage.getItem(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * A tracker and each of its items become nodes.
 *
 * Ids carry over unchanged. Both sides came from the same generator, so they
 * are already unique against each other, and keeping them means anything else
 * that referred to a tracker by id still points at the right thing.
 */
function toNodes(trackers, parents, order) {
  const position = new Map(order.map((id, i) => [id, i]));
  const nodes = [];

  trackers.forEach((tracker, index) => {
    if (!tracker?.id) return;

    // Ordering was a separate list of ids. Anything missing from it sorts
    // after everything named there, in the order it was stored.
    const at = position.has(tracker.id)
      ? position.get(tracker.id)
      : order.length + index;

    nodes.push({
      id: tracker.id,
      name: tracker.name ?? '',
      color: tracker.color ?? 'vibeBlue',
      // Filing lived in its own map, with the field on the record as a
      // fallback for the version in between.
      parentId: parents[tracker.id] ?? tracker.parentId ?? null,
      // All three old types were containers holding items, and none of them
      // could be ticked off — only the items inside them could. `kind` is
      // exactly that distinction now, so every tracker becomes a category
      // regardless of which of the three it was. A timer keeps its clock
      // through goalHours/startMs, which is what made it a timer anyway.
      kind: 'category',
      order: at,
      createdAt: tracker.createdAt ?? Date.now(),
      done: false,
      doneAt: null,
      doneBy: null,
      note: '',
      startMs: tracker.startMs ?? null,
      goalHours: tracker.goalHours ?? null,
      count: null,
      countedAt: null,
      dueAt: null,
      dueTo: null,
      repeat: null,
      reminders: [],
    });

    (tracker.items || []).forEach((item, i) => {
      if (!item?.id) return;
      nodes.push({
        id: item.id,
        // The field was called `text` on an item and `name` on a tracker;
        // they are the same thing now.
        name: item.text ?? '',
        color: tracker.color ?? 'vibeBlue',
        parentId: tracker.id,
        kind: 'item',
        order: i,
        createdAt: item.createdAt ?? Date.now(),
        done: !!item.done,
        doneAt: item.done ? item.createdAt ?? null : null,
        doneBy: null,
        note: '',
        startMs: null,
        goalHours: null,
        count: null,
        countedAt: null,
        dueAt: null,
        dueTo: null,
        repeat: null,
        reminders: [],
      });
    });
  });

  return nodes;
}

/**
 * Returns the recovered nodes, or null when there is nothing to recover.
 *
 * Only ever called with an empty `nodes.v1`, and it never writes to the old
 * keys, so the worst case is that it finds nothing and the app opens exactly
 * as it would have.
 */
export async function recoverLegacyTrackers() {
  const already = await AsyncStorage.getItem(DONE_KEY);
  if (already) return null;

  const trackers = await readJson(TRACKERS_KEY, null);
  if (!Array.isArray(trackers) || !trackers.length) {
    // Nothing there to bring forward. Marked anyway: this phone has now been
    // looked at, and looking again on every launch achieves nothing.
    await AsyncStorage.setItem(DONE_KEY, String(Date.now()));
    return null;
  }

  const [parents, order] = await Promise.all([
    readJson(PARENT_KEY, {}),
    readJson(ORDER_KEY, []),
  ]);

  const nodes = toNodes(
    trackers,
    parents && typeof parents === 'object' ? parents : {},
    Array.isArray(order) ? order : []
  );

  return nodes.length ? nodes : null;
}

/** Called once the recovered nodes are safely stored. */
export async function markLegacyRecovered() {
  await AsyncStorage.setItem(DONE_KEY, String(Date.now()));
}
