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
 *   repeat      'daily' | 'weekly' | null
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

export function makeNode({ name, color = NODE_COLORS[0], parentId = null, ...rest }) {
  return {
    id: newId(),
    name,
    color,
    parentId,
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
