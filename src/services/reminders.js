import {
  collection,
  doc,
  deleteDoc,
  getDocs,
  query,
  setDoc,
  where,
} from '@react-native-firebase/firestore';
import { db } from './firebase';
import { getMemberUids } from './lists';
import { remindAt } from '../components/ItemReminders';

// Pending reminders live in one flat collection, deliberately self-contained:
// each doc carries the text to show and the people to notify, so the sweep
// never reads the item it came from.
//
// That's what lets reminders work on a device-local tracker. The item itself
// was never uploaded — only the reminder is, and only once you ask for one.
//
// Docs are deleted once sent, so "exists and fireAt has passed" is the whole
// query. No status field, and therefore no composite index.

const remindersRef = () => collection(db, 'reminders');

// Deterministic, so re-saving an item replaces its reminders instead of
// accumulating duplicates.
const reminderId = (itemId, offsetId) => `${itemId}__${offsetId}`;

async function existingForItem(itemId) {
  const snap = await getDocs(
    query(remindersRef(), where('itemId', '==', itemId))
  );
  return snap.docs;
}

/** Remove every pending reminder for an item — deleted, completed, cleared. */
export async function clearItemReminders(itemId) {
  if (!itemId) return;
  try {
    const docs = await existingForItem(itemId);
    await Promise.all(docs.map((d) => deleteDoc(d.ref)));
  } catch (err) {
    console.log('[reminders] clear skipped:', err?.message || err);
  }
}

/**
 * Bring the stored reminders for one item in line with what the user chose.
 *
 * Writes are not awaited against the server anywhere here — like sharing, this
 * has to work with no signal and reconcile later.
 */
export async function syncItemReminders({ tracker, item, uid, dueAt, reminders }) {
  if (!uid || !item?.id) return;

  try {
    // A completed item shouldn't nag, and neither should one with no date.
    const wanted =
      !dueAt || item.done ? [] : (reminders || []).filter((id) => remindAt(dueAt, id) > Date.now());

    const existing = await existingForItem(item.id);
    const wantedIds = new Set(wanted.map((id) => reminderId(item.id, id)));

    // Drop anything no longer wanted, including offsets that have since
    // become unreachable because the date moved.
    await Promise.all(
      existing.filter((d) => !wantedIds.has(d.id)).map((d) => deleteDoc(d.ref))
    );

    if (!wanted.length) return;

    // Everyone on a shared list gets told; a private tracker tells only its
    // owner. Resolved now rather than at send time so the sweep stays a dumb
    // dispatcher with no knowledge of lists.
    const targetUids = tracker?.shared
      ? await getMemberUids(tracker.remoteId)
      : [uid];
    if (!targetUids.length) return;

    await Promise.all(
      wanted.map((offsetId) =>
        setDoc(doc(remindersRef(), reminderId(item.id, offsetId)), {
          itemId: item.id,
          listId: tracker?.shared ? tracker.remoteId : null,
          trackerName: tracker?.name ?? '',
          itemText: item.text ?? '',
          targetUids,
          fireAt: remindAt(dueAt, offsetId),
          createdBy: uid,
        })
      )
    );
  } catch (err) {
    // Never let reminder bookkeeping break saving the item itself.
    console.log('[reminders] sync skipped:', err?.message || err);
  }
}
