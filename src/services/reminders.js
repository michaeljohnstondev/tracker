import {
  collection,
  doc,
  deleteDoc,
  setDoc,
} from '@react-native-firebase/firestore';
import { db } from './firebase';
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
// accumulating duplicates — and so nothing here ever has to run a query.
//
// That last part is load-bearing. The read rule requires the caller to be in
// targetUids, and Firestore rejects any query it cannot prove satisfies the
// rule from the query's own constraints. A `where('itemId', '==', ...)` lookup
// proves nothing about targetUids, so it is denied outright. Addressing docs
// by id sidesteps that, and avoids a composite index too.
const reminderId = (itemId, offsetId) => `${itemId}__${offsetId}`;

const deleteReminder = (itemId, offsetId) =>
  deleteDoc(doc(remindersRef(), reminderId(itemId, offsetId)));

/**
 * Remove pending reminders for an item — deleted, completed, or cleared.
 * `offsetIds` is what the item last had stored, which is the only record of
 * what exists.
 */
export async function clearItemReminders(itemId, offsetIds = []) {
  if (!itemId || !offsetIds.length) return;
  try {
    await Promise.all(offsetIds.map((id) => deleteReminder(itemId, id)));
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
export async function syncItemReminders({
  tracker,
  item,
  uid,
  dueAt,
  previous = [],
  reminders = [],
}) {
  if (!uid || !item?.id) return;

  try {
    // A completed item shouldn't nag, and neither should one with no date.
    const wanted =
      !dueAt || item.done
        ? []
        : reminders.filter((id) => remindAt(dueAt, id) > Date.now());

    const keep = new Set(wanted);

    // Drop anything no longer wanted, including offsets that became
    // unreachable because the date moved nearer.
    await Promise.all(
      previous.filter((id) => !keep.has(id)).map((id) => deleteReminder(item.id, id))
    );

    if (!wanted.length) return;

    // Only ever the author here. Resolving a shared list's members would mean
    // querying memberships by listId, and that query is denied — its read rule
    // depends on fields the filter doesn't constrain, which Firestore refuses
    // to allow. The sweep expands this to every current member at send time
    // using the Admin SDK, which is both permitted and more correct, since
    // membership can change after a reminder is set.
    const targetUids = [uid];

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
    // Never let reminder bookkeeping break saving the item itself — but log
    // loudly. Swallowing this quietly is exactly how a denied query went
    // unnoticed and reminders silently never got written.
    console.error('[reminders] sync FAILED:', err?.message || err);
  }
}
