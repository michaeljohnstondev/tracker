import {
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from '@react-native-firebase/firestore';
import { db } from './firebase';
import { newId } from '../lib/nodes';

/**
 * Sharing, for a world where everything is a node.
 *
 * A shared node and everything beneath it lives in one flat `nodes`
 * collection. Each document carries `rootId` — the node that was actually
 * shared — and membership is recorded against that root.
 *
 * That denormalised rootId is what keeps security rules cheap: "can this
 * person read this node" is one membership lookup, rather than walking an
 * ancestor chain of unknown length, which rules cannot do. Moving a node in or
 * out of a shared subtree rewrites rootId across that subtree.
 */

// A shared tree's nodes live under its root: trees/{rootId}/nodes/{nodeId}.
//
// The root is in the path rather than a field on purpose. Security rules can
// read a path variable directly, so "may this person read this node" is
// isMember(rootId) with nothing to prove — and reading a whole tree is a
// plain collection read rather than a query. With rootId as a field instead,
// the subscription had to be a query filtered on it, and Firestore evaluates
// query rules against the query rather than its results: it cannot prove a
// filter guarantees a rule that reads document data, so it denied the lot.
const treeRef = (rootId) => collection(db, 'trees', rootId, 'nodes');
const nodeDoc = (rootId, id) => doc(treeRef(rootId), id);

export const membershipId = (rootId, uid) => `${rootId}_${uid}`;

function snapExists(snap) {
  return typeof snap.exists === 'function' ? snap.exists() : !!snap.exists;
}

function snapData(snap) {
  return typeof snap.data === 'function' ? snap.data() : snap.data;
}

// Only fields that belong on the server. Local-only concerns — where you have
// filed something on your own device — stay out of it.
function toRemote(node, rootId) {
  return {
    rootId,
    parentId: node.parentId ?? null,
    name: node.name ?? '',
    // Without this a shared category came back with no kind and fell through
    // to "item" — sharing a folder turned it into a task.
    kind: node.kind === 'category' ? 'category' : 'item',
    color: node.color ?? 'vibeBlue',
    order: node.order ?? Date.now(),
    createdAt: node.createdAt ?? Date.now(),
    done: !!node.done,
    doneAt: node.doneAt ?? null,
    doneBy: node.doneBy ?? null,
    note: node.note ?? '',
    startMs: node.startMs ?? null,
    goalHours: node.goalHours ?? null,
    repeat: node.repeat ?? null,
    reminders: node.reminders ?? [],
  };
}

/**
 * Publish a node and its whole subtree.
 *
 * Nothing is awaited between writes. Firestore only resolves a write once the
 * server has acknowledged it, so awaiting here would hang offline — and any
 * write after the await would never even be queued. Issued back to back they
 * all land in the offline queue in order, which is what makes sharing work on
 * a bad connection.
 */
export function shareSubtree({ node, descendants, uid }) {
  const rootId = node.remoteId ?? newId();

  const writes = [
    // Order matters, and it's circular unless the root goes first: the
    // membership rule reads the root node to confirm ownership, while every
    // other node's rule requires that membership. Firestore replays queued
    // writes in order, so root, then membership, then the rest.
    setDoc(nodeDoc(rootId, rootId), {
      ...toRemote(node, rootId),
      parentId: null,
      ownerUid: uid,
    }),
    setDoc(doc(db, 'memberships', membershipId(rootId, uid)), {
      rootId,
      uid,
      role: 'owner',
      joinedAt: Date.now(),
    }),
    // Descendants keep their shape and their ids; only their home changes.
    ...descendants.map((child) =>
      setDoc(nodeDoc(rootId, child.id), {
        ...toRemote(child, rootId),
        // A direct child of the shared node points at the root's new id.
        parentId: child.parentId === node.id ? rootId : child.parentId,
        ownerUid: uid,
      })
    ),
  ];

  return { rootId, settled: Promise.all(writes) };
}

/**
 * Move a local node, and everything under it, into an existing shared tree.
 *
 * Ids are reused rather than regenerated, so the parent links between the
 * descendants stay valid without any rewriting — only the moved node's own
 * parent changes, to point at its new home.
 */
export function publishInto({ node, descendants, parentId, rootId, uid }) {
  const writes = [
    setDoc(nodeDoc(rootId, node.id), {
      ...toRemote(node, rootId),
      parentId,
      ownerUid: uid,
    }),
    ...descendants.map((child) =>
      setDoc(nodeDoc(rootId, child.id), { ...toRemote(child, rootId), ownerUid: uid })
    ),
  ];
  return Promise.all(writes);
}

/** Live view of every shared tree this user belongs to. */
export function subscribeToMemberships(uid, onChange, onError) {
  return onSnapshot(
    query(collection(db, 'memberships'), where('uid', '==', uid)),
    (snap) => onChange(snap.docs.map((d) => snapData(d))),
    onError
  );
}

/**
 * Live view of every node in one shared tree.
 *
 * A plain collection read, not a query — the tree is the collection, so
 * there's nothing to filter and nothing for the rules to have to prove.
 */
export function subscribeToTree(rootId, onChange, onError) {
  return onSnapshot(
    treeRef(rootId),
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...snapData(d) }))),
    onError
  );
}

export function updateNode(rootId, id, patch) {
  return updateDoc(nodeDoc(rootId, id), patch);
}

export function createNode(node, rootId, uid) {
  return setDoc(nodeDoc(rootId, node.id), { ...toRemote(node, rootId), ownerUid: uid });
}

export async function deleteNode(id, rootId) {
  // Children first, so nothing is left pointing at a parent that has gone.
  const snap = await getDocs(treeRef(rootId));
  const all = snap.docs.map((d) => ({ id: d.id, ...snapData(d) }));

  const doomed = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    all.forEach((n) => {
      if (!doomed.has(n.id) && doomed.has(n.parentId)) {
        doomed.add(n.id);
        grew = true;
      }
    });
  }

  await Promise.all(
    Array.from(doomed).map((nodeId) => deleteDoc(nodeDoc(rootId, nodeId)))
  );
}

// ---- Invites -------------------------------------------------------------

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(length = 6) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export async function createInvite(rootId, uid, attempts = 5) {
  for (let i = 0; i < attempts; i += 1) {
    const code = randomCode();
    const ref = doc(db, 'invites', code);
    if (snapExists(await getDoc(ref))) continue;
    await setDoc(ref, { rootId, createdBy: uid, createdAt: Date.now() });
    return code;
  }
  throw new Error('Could not generate an invite code. Try again.');
}

export async function redeemInvite(code, uid) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) throw new Error('Enter an invite code.');

  const snap = await getDoc(doc(db, 'invites', normalized));
  if (!snapExists(snap)) throw new Error('That code isn’t valid.');

  const { rootId } = snapData(snap);
  await setDoc(doc(db, 'memberships', membershipId(rootId, uid)), {
    rootId,
    uid,
    role: 'member',
    joinedAt: Date.now(),
    usedInviteCode: normalized,
  });
  return rootId;
}

export function leaveTree(rootId, uid) {
  return deleteDoc(doc(db, 'memberships', membershipId(rootId, uid)));
}
