import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Everything in the app is a node.
 *
 * There are no types. A node that has children behaves like a folder, one with
 * goalHours behaves like a timer, one you tick behaves like a task — and a
 * single node can be all three at once. Capabilities are optional fields
 * rather than categories of thing, which is what lets a "Do Daily" folder hold
 * a repeating task that also times itself.
 *
 * The shape:
 *   id, name, color, createdAt
 *   parentId    where it sits; null means the top level
 *   order       position among its siblings
 *   done/doneAt/doneBy   if it has been ticked
 *   note        free text
 *   startMs, goalHours   a running timer and its target
 *   count, countedAt     a tally, and when it last moved
 *   dueAt, dueTo         when it's due, and which list should surface it then
 *   repeat      'daily' | 'weekly' | 'always' | null
 *   reminders[] absolute timestamps to be alarmed at
 *   shared, remoteId, rootId   set once it lives in Firestore
 */

const KEY = 'nodes.v1';

export const NODE_COLORS = [
  'vibeBlue',
  'vibeGreen',
  'vibePurple',
  'vibeOrange',
  'vibePink',
  'vibeTeal',
];

let idCounter = 0;
export function newId() {
  // Date.now plus a counter keeps ids unique even when several are created
  // inside the same millisecond.
  idCounter = (idCounter + 1) % 1000;
  return `${Date.now().toString(36)}${idCounter.toString(36)}${Math.floor(
    Math.random() * 1296
  ).toString(36)}`;
}

export function makeNode({
  name,
  color = NODE_COLORS[0],
  parentId = null,
  kind = 'item',
  ...rest
}) {
  return {
    id: newId(),
    name,
    color,
    parentId,
    // Presentation only. A category and an item behave identically — both can
    // hold children, run a timer, repeat — but you don't tick a folder off, so
    // a category shows no checkbox. It's about saying what you meant, not
    // about what the thing can do.
    kind,
    // Timestamp rather than an index: a new node sorts last without having to
    // know how many siblings it has, and two devices adding at once don't
    // collide on the same position.
    order: Date.now(),
    createdAt: Date.now(),
    done: false,
    doneAt: null,
    doneBy: null,
    note: '',
    startMs: null,
    goalHours: null,
    // null means no counter at all, rather than a counter sitting at zero —
    // otherwise every item would have one.
    count: null,
    countedAt: null,
    // A due item is shown by another list rather than moved into it. Moving
    // would throw away where it actually belongs, and there'd be nowhere to
    // put it back once it was done.
    dueAt: null,
    dueTo: null,
    repeat: null,
    reminders: [],
    ...rest,
  };
}

// ---- Reading the tree ----------------------------------------------------

export const childrenOf = (nodes, parentId) =>
  nodes
    .filter((n) => (n.parentId ?? null) === (parentId ?? null))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

/** Every node beneath this one, at any depth. */
export function descendantsOf(nodes, id) {
  const out = [];
  const walk = (parentId) => {
    nodes
      .filter((n) => n.parentId === parentId)
      .forEach((child) => {
        out.push(child);
        walk(child.id);
      });
  };
  walk(id);
  return out;
}

/**
 * Nodes this one may be filed into: anything but itself and its own
 * descendants. Moving a node inside its own subtree would detach that branch
 * from the tree entirely.
 */
export function filingTargets(nodes, node) {
  if (!node) return [];
  const banned = new Set([node.id, ...descendantsOf(nodes, node.id).map((n) => n.id)]);
  return nodes.filter((n) => !banned.has(n.id));
}

export const hasTimer = (node) => node?.goalHours != null || node?.startMs != null;

export const hasCounter = (node) => node?.count != null;

// The home screen has no node of its own, so it needs a name to be picked as
// a destination. Anything else is an ordinary node id.
export const DUE_HOME = '__home__';

/** Where this screen sits, in the terms `dueTo` is written in. */
export const dueKeyFor = (node) => node?.id ?? DUE_HOME;

/**
 * Items another list should be showing right now.
 *
 * Only once they're actually due, never the ones already living here, and
 * never the ones already done — the point is a list that fills up as things
 * come due and empties as you deal with them.
 */
export function dueVisitorsFor(nodes, node, at = Date.now()) {
  const here = dueKeyFor(node);
  return nodes
    .filter(
      (n) =>
        n.dueTo === here &&
        n.dueAt != null &&
        n.dueAt <= at &&
        !n.done &&
        (n.parentId ?? DUE_HOME) !== here
    )
    .sort((a, b) => a.dueAt - b.dueAt);
}

// ---- Persistence ---------------------------------------------------------

export async function loadNodes() {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw == null) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveNodes(nodes) {
  await AsyncStorage.setItem(KEY, JSON.stringify(nodes));
}

// ---- Shared trees, kept on the device too --------------------------------

const MIRROR_KEY = 'sharedTrees.v1';

/**
 * A local copy of every shared tree, written on each snapshot.
 *
 * Sharing used to move a list off the device entirely: the only copy lived in
 * Firestore, and anything that interrupted the connection to it — a denied
 * read, a rules change, a bug in this file — was indistinguishable from the
 * list having been deleted. It has read as lost twice, and once it genuinely
 * was. Now the last known contents stay on the phone, so a failure to read is
 * a failure to refresh rather than a disappearance.
 */
// Stamped with the account it belongs to, so signing in as someone else shows
// their lists rather than the last person's.
export async function loadSharedMirror() {
  const raw = await AsyncStorage.getItem(MIRROR_KEY);
  if (raw == null) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.uid && parsed?.trees ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveSharedMirror(uid, trees) {
  if (!uid) return;
  await AsyncStorage.setItem(MIRROR_KEY, JSON.stringify({ uid, trees }));
}
