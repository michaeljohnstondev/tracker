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
    count: node.count ?? null,
    countedAt: node.countedAt ?? null,
    dueAt: node.dueAt ?? null,
    dueTo: node.dueTo ?? null,
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
    // Written at the same moment, so a tree is never remembered in only one
    // place.
    rememberOwnTree(uid, rootId),
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

const ownedTreesRef = (uid) => collection(db, 'users', uid, 'trees');

/**
 * A second record of which trees are yours, kept under your own account.
 *
 * Membership is otherwise a single point of failure: it's the only thing
 * pointing at your shared lists, so losing those documents makes every one of
 * them invisible while the lists themselves sit there untouched. Written
 * alongside the membership, and read only when something has gone missing.
 */
export function rememberOwnTree(uid, rootId) {
  return setDoc(doc(ownedTreesRef(uid), rootId), {
    rootId,
    rememberedAt: Date.now(),
  });
}

export async function findOwnedRootIds(uid) {
  const snap = await getDocs(ownedTreesRef(uid));
  return snap.docs.map((d) => d.id);
}

/** Put back the membership for a tree you own. */
export function claimOwnTree(rootId, uid) {
  return setDoc(doc(db, 'memberships', membershipId(rootId, uid)), {
    rootId,
    uid,
    role: 'owner',
    joinedAt: Date.now(),
  });
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
// I, O, 0 and 1 are missing from that alphabet on purpose: a code gets read
// aloud or copied off a screen, and those four are what people get wrong.
const CODE_LENGTH = 6;

function randomCode(length = CODE_LENGTH) {
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

/**
 * Join by invite code — or, failing that, by the list's own id.
 *
 * The second form is how you get back a list whose membership has gone missing
 * while the list itself is still there. It looks like a back door and isn't
 * one: the write is an ordinary membership create, and the rules only permit it
 * for whoever owns the tree. Anyone else's attempt is refused by the server, so
 * knowing an id buys nothing.
 */
export async function redeemInvite(code, uid) {
  // Spaces and dashes are how people write a code down and read it back, and
  // none of them mean anything here.
  const cleaned = String(code || '').replace(/[\s-]/g, '');
  if (!cleaned) throw new Error('Enter an invite code.');

  const asCode = cleaned.toUpperCase();
  const looksLikeCode = asCode.length === CODE_LENGTH;

  let snap;
  try {
    snap = await getDoc(doc(db, 'invites', asCode));
  } catch (err) {
    // Being refused the read is a different problem from the code being
    // wrong, and saying so saves guessing at which.
    throw new Error(`Could not check that code: ${err?.message || err}`);
  }

  if (snapExists(snap)) {
    const { rootId } = snapData(snap);
    await setDoc(doc(db, 'memberships', membershipId(rootId, uid)), {
      rootId,
      uid,
      role: 'member',
      joinedAt: Date.now(),
      usedInviteCode: asCode,
    });
    return rootId;
  }

  // It was the right shape and there's no such invitation, so it isn't a list
  // id either — say the useful thing rather than trying the other path and
  // reporting whatever that fails with.
  if (looksLikeCode) {
    throw new Error(
      `No invitation with the code ${asCode}. Codes are ${CODE_LENGTH} characters, ` +
        'and one stops working if the list it points at is deleted. Ask for a new one.'
    );
  }

  // Not a code, so treat it as the id of a list you own. Ownership can't be
  // checked from here — reading the root node needs the very membership being
  // restored — so the write is attempted and the rules decide.
  try {
    await setDoc(doc(db, 'memberships', membershipId(cleaned, uid)), {
      rootId: cleaned,
      uid,
      role: 'owner',
      joinedAt: Date.now(),
    });
    return cleaned;
  } catch (err) {
    throw new Error(
      `Not an invite code, and not a list you own.

${err?.message || err}`
    );
  }
}

// ---- Invitations by email ------------------------------------------------

// Addresses are stored lowercased so "Sam@x.com" and "sam@x.com" are the same
// invitation — the id is derived from it, and the rules compare it against the
// sign-in token, which is lowercase.
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const shareId = (rootId, email) => `${rootId}_${normalizeEmail(email)}`;

/**
 * Invite someone by address, rather than by handing them a code.
 *
 * Deliberately does not look up whether they have an account: the invitation
 * is keyed by the address and matched later against the recipient's own
 * verified email. That means nothing here can be used to discover who has
 * signed up, and an invitation left for someone works whether they join today
 * or next week.
 */
export function shareWithEmail({ rootId, email, fromUid, treeName }) {
  const normalized = normalizeEmail(email);
  if (!normalized.includes('@')) throw new Error('That doesn’t look like an email address.');

  return setDoc(doc(db, 'shares', shareId(rootId, normalized)), {
    rootId,
    email: normalized,
    fromUid,
    treeName: treeName ?? '',
    createdAt: Date.now(),
  });
}

/** Invitations waiting for this person. */
export function subscribeToInvitations(email, onChange, onError) {
  const normalized = normalizeEmail(email);
  if (!normalized) return () => {};

  return onSnapshot(
    query(collection(db, 'shares'), where('email', '==', normalized)),
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...snapData(d) }))),
    onError
  );
}

/** Take up an invitation: join the tree, then clear it. */
export async function acceptInvitation({ rootId, email, uid }) {
  await setDoc(doc(db, 'memberships', membershipId(rootId, uid)), {
    rootId,
    uid,
    role: 'member',
    joinedAt: Date.now(),
  });
  await deleteDoc(doc(db, 'shares', shareId(rootId, email)));
}

export function leaveTree(rootId, uid) {
  return deleteDoc(doc(db, 'memberships', membershipId(rootId, uid)));
}
