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
import { newId } from '../lib/trackers';

// Ambiguous glyphs removed — these codes get read aloud and typed by hand.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function membershipId(listId, uid) {
  return `${listId}_${uid}`;
}

function randomCode(length = 6) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

// RNFirebase has moved `exists` between a property and a method across
// versions; accept either so a dependency bump can't silently break joining.
function snapExists(snap) {
  return typeof snap.exists === 'function' ? snap.exists() : !!snap.exists;
}

function snapData(snap) {
  return typeof snap.data === 'function' ? snap.data() : snap.data;
}

/**
 * Push a local list tracker up to Firestore and return its remote id.
 *
 * The list doc and the owner's membership are written *sequentially*, not in
 * a batch: the membership rule calls get() on the list to confirm ownership,
 * and a batch is evaluated against pre-batch state, so the list has to be
 * committed first or the membership write is rejected.
 */
export async function shareList(tracker, uid) {
  const listRef = doc(collection(db, 'lists'));
  const listId = listRef.id;

  await setDoc(listRef, {
    name: tracker.name,
    color: tracker.color,
    ownerUid: uid,
    createdAt: Date.now(),
  });

  await setDoc(doc(db, 'memberships', membershipId(listId, uid)), {
    listId,
    uid,
    role: 'owner',
    joinedAt: Date.now(),
  });

  // Carry existing items across so sharing never looks like it wiped the list.
  const items = tracker.items || [];
  await Promise.all(
    items.map((item, index) =>
      setDoc(doc(db, 'lists', listId, 'items', item.id || newId()), {
        text: item.text,
        done: !!item.done,
        createdAt: item.createdAt ?? Date.now(),
        // The local list's array order is its ordering; carry it across as
        // explicit ranks so sharing doesn't shuffle the list.
        order: index,
        createdBy: uid,
      })
    )
  );

  return listId;
}

/** Live view of every list this user belongs to. */
export function subscribeToMyLists(uid, onChange, onError) {
  const q = query(collection(db, 'memberships'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const memberships = snap.docs.map((d) => snapData(d));
      onChange(memberships);
    },
    onError
  );
}

/** Live view of one list's metadata. */
export function subscribeToList(listId, onChange, onError) {
  return onSnapshot(
    doc(db, 'lists', listId),
    (snap) => onChange(snapExists(snap) ? { id: listId, ...snapData(snap) } : null),
    onError
  );
}

/** Live view of a list's items, sorted client-side. */
export function subscribeToItems(listId, onChange, onError) {
  return onSnapshot(
    collection(db, 'lists', listId, 'items'),
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...snapData(d) }));
      // Sorted here rather than with orderBy: items created offline carry a
      // local timestamp and must still slot into place before they sync.
      //
      // `order` falls back to createdAt, and new items are stamped with
      // Date.now() as their order — so an unranked item always sorts after
      // reordered ones (which hold small integers) and lands at the bottom,
      // with no migration pass needed over existing lists.
      items.sort(
        (a, b) =>
          (a.order ?? a.createdAt ?? 0) - (b.order ?? b.createdAt ?? 0)
      );
      onChange(items);
    },
    onError
  );
}

// Any member can rename a shared list — it's a shared object, and needing to
// chase the owner to fix a typo would be worse than the rare surprise.
export function renameList(listId, name) {
  return updateDoc(doc(db, 'lists', listId), { name });
}

export function addItem(listId, text, uid) {
  const id = newId();
  const now = Date.now();
  return setDoc(doc(db, 'lists', listId, 'items', id), {
    text,
    done: false,
    createdAt: now,
    // Far larger than any rank assigned by reordering, so new items append.
    order: now,
    createdBy: uid,
  });
}

/**
 * Persist a new item sequence, writing only the docs whose rank actually
 * changed. The first reorder of a list rewrites every item (they still hold
 * timestamp-shaped ranks from when they were added); after that an adjacent
 * swap costs two writes instead of rewriting the list — which matters when
 * the queue is draining over a bad connection in a shop.
 */
export function reorderItems(listId, orderedItems) {
  const writes = [];
  orderedItems.forEach((item, index) => {
    if (item.order !== index) {
      writes.push(
        updateDoc(doc(db, 'lists', listId, 'items', item.id), { order: index })
      );
    }
  });
  return Promise.all(writes);
}

/** Partial update of one item — text, note, anything but its identity. */
export function updateItem(listId, itemId, patch) {
  return updateDoc(doc(db, 'lists', listId, 'items', itemId), patch);
}

export function setItemDone(listId, itemId, done, uid) {
  return updateDoc(doc(db, 'lists', listId, 'items', itemId), {
    done,
    doneBy: done ? uid : null,
    doneAt: done ? Date.now() : null,
  });
}

export function removeItem(listId, itemId) {
  return deleteDoc(doc(db, 'lists', listId, 'items', itemId));
}

export async function clearDoneItems(listId) {
  const snap = await getDocs(collection(db, 'lists', listId, 'items'));
  const done = snap.docs.filter((d) => snapData(d)?.done);
  await Promise.all(done.map((d) => deleteDoc(d.ref)));
}

/**
 * Mint an invite code pointing at a list. Retries on the (vanishingly rare)
 * chance of a collision rather than silently hijacking someone else's code.
 */
export async function createInvite(listId, uid, attempts = 5) {
  for (let i = 0; i < attempts; i += 1) {
    const code = randomCode();
    const ref = doc(db, 'invites', code);
    const existing = await getDoc(ref);
    if (snapExists(existing)) continue;
    await setDoc(ref, { listId, createdBy: uid, createdAt: Date.now() });
    return code;
  }
  throw new Error('Could not generate an invite code. Try again.');
}

/**
 * Join a list using a code. Creating the membership is the only write — the
 * rules re-read the invite server-side to confirm it really points at this
 * list, so a forged listId gets rejected.
 */
export async function redeemInvite(code, uid) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) throw new Error('Enter an invite code.');

  const inviteSnap = await getDoc(doc(db, 'invites', normalized));
  if (!snapExists(inviteSnap)) throw new Error('That code isn’t valid.');

  const { listId } = snapData(inviteSnap);
  await setDoc(doc(db, 'memberships', membershipId(listId, uid)), {
    listId,
    uid,
    role: 'member',
    joinedAt: Date.now(),
    usedInviteCode: normalized,
  });

  return listId;
}

/** Leave a shared list — deleting your own membership row. */
export function leaveList(listId, uid) {
  return deleteDoc(doc(db, 'memberships', membershipId(listId, uid)));
}

/** Owner-only: remove the list itself. */
export async function deleteSharedList(listId, uid) {
  const snap = await getDocs(collection(db, 'lists', listId, 'items'));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, 'memberships', membershipId(listId, uid)));
  await deleteDoc(doc(db, 'lists', listId));
}
