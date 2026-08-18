import { collection, doc, deleteDoc, setDoc } from '@react-native-firebase/firestore';
import { db } from './firebase';
import VibeAlert from '../components/ui/VibeAlert';

// Pending alarms live in one flat collection, deliberately self-contained:
// each doc carries its own copy of the text and the list it belongs to, so the
// sweep never reads the item it came from. That's what lets an alarm work on a
// device-local tracker, whose item was never uploaded.
//
// Docs are deleted once sent, so "fireAt has passed" is the whole query — one
// auto-indexed field, no status flag, and a failed send simply leaves the doc
// for the next pass.

const remindersRef = () => collection(db, 'reminders');

// Goals can be fractional, so "0.5h reached" would read badly.
function fmtGoalLabel(hours) {
  const whole = Math.floor(hours);
  const mins = Math.round((hours - whole) * 60);
  if (!whole) return `${mins}m`;
  return mins ? `${whole}h ${mins}m` : `${whole}h`;
}

// Deterministic, so re-saving an item replaces its alarms rather than
// accumulating duplicates — and so nothing here needs a query.
//
// That matters: the read rule requires the caller to be in targetUids, and
// Firestore rejects any query it can't prove satisfies the rule from the
// query's own filters. Addressing docs by id sidesteps that entirely.
const reminderId = (itemId, at) => `${itemId}__${at}`;

const deleteReminder = (itemId, at) =>
  deleteDoc(doc(remindersRef(), reminderId(itemId, at)));

// A timer's goal is just an alarm at a known future moment, so it reuses the
// same collection and the same sweep. One per timer, replaced whenever the
// start time or goal changes, deleted when the timer stops.
//
// `key` distinguishes a tracker's own timer from a timer attached to one of
// its items, which would otherwise share an id and overwrite each other.
const goalId = (key) => `goal__${key}`;

export async function syncGoalReminder({
  tracker,
  uid,
  startMs,
  goalHours,
  key,
  label,
}) {
  if (!uid || !tracker?.id) return;

  const ref = doc(remindersRef(), goalId(key ?? tracker.remoteId ?? tracker.id));
  const fireAt =
    startMs != null && goalHours ? startMs + goalHours * 3600 * 1000 : null;

  try {
    // No running timer, no goal, or a goal already passed — nothing to fire.
    if (fireAt == null || fireAt <= Date.now()) {
      await deleteDoc(ref);
      return;
    }

    await setDoc(ref, {
      itemId: key ?? tracker.remoteId ?? tracker.id,
      listId: tracker?.shared ? tracker.remoteId : null,
      trackerName: label ?? tracker.name ?? '',
      itemText: `${fmtGoalLabel(goalHours)} reached`,
      targetUids: [uid],
      fireAt,
      createdBy: uid,
    });
  } catch (err) {
    console.error('[reminders] goal sync failed:', err?.message || err);
  }
}

/**
 * Alarms for a node, in the unified model.
 *
 * `previous` is what the node last had stored — the only record of which
 * documents exist, which is what lets this reconcile without a query. Queries
 * here are denied anyway: the read rule requires the caller to be in
 * targetUids, and Firestore rejects any query it can't prove satisfies the
 * rule from the query's own filters.
 */
export async function syncNodeReminders({ node, uid, previous = [], reminders = [] }) {
  if (!uid || !node?.id) return;

  try {
    const wanted = node.done ? [] : reminders.filter((at) => at > Date.now());
    const keep = new Set(wanted);

    await Promise.all(
      previous.filter((at) => !keep.has(at)).map((at) => deleteReminder(node.id, at))
    );

    if (!wanted.length) return;

    await Promise.all(
      wanted.map((at) =>
        setDoc(doc(remindersRef(), reminderId(node.id, at)), {
          itemId: node.id,
          // Shared nodes address the whole tree, so everyone on it is told.
          listId: node.shared ? node.rootId : null,
          trackerName: node.name ?? '',
          itemText: node.name ?? '',
          targetUids: [uid],
          fireAt: at,
          createdBy: uid,
        })
      )
    );
  } catch (err) {
    console.error('[reminders] node sync FAILED:', err?.message || err);
    VibeAlert(
      'Reminder not scheduled',
      `Saved, but the reminder could not be stored.\n\n${err?.message || err}`
    );
  }
}

/**
 * Remove pending alarms for an item — deleted, completed, or cleared.
 * `times` is what the item last had stored, the only record of what exists.
 */
export async function clearItemReminders(itemId, times = []) {
  if (!itemId || !times.length) return;
  try {
    await Promise.all(times.map((at) => deleteReminder(itemId, at)));
  } catch (err) {
    console.error('[reminders] clear failed:', err?.message || err);
  }
}

/**
 * Bring stored alarms in line with what the user chose. Reconciled on every
 * save rather than only on change: alarms listed on an item are not evidence
 * that the matching documents exist, and an item carrying alarms with nothing
 * scheduled could otherwise never repair itself.
 */
export async function syncItemReminders({ tracker, item, uid, previous = [], reminders = [] }) {
  if (!uid || !item?.id) return;

  try {
    // A completed item shouldn't nag, and an alarm already in the past can
    // never fire.
    const wanted = item.done ? [] : reminders.filter((at) => at > Date.now());
    const keep = new Set(wanted);

    await Promise.all(
      previous.filter((at) => !keep.has(at)).map((at) => deleteReminder(item.id, at))
    );

    if (!wanted.length) return;

    // Only the author. Resolving a shared list's members would need a query on
    // memberships that the rules can't permit; the sweep expands this to every
    // current member at send time via the Admin SDK, which is also more
    // correct since membership can change after an alarm is set.
    const targetUids = [uid];

    await Promise.all(
      wanted.map((at) =>
        setDoc(doc(remindersRef(), reminderId(item.id, at)), {
          itemId: item.id,
          listId: tracker?.shared ? tracker.remoteId : null,
          trackerName: tracker?.name ?? '',
          itemText: item.text ?? '',
          targetUids,
          fireAt: at,
          createdBy: uid,
        })
      )
    );
  } catch (err) {
    // Saving the item still succeeds, but say so. An alarm that silently
    // fails to schedule is worse than one that admits it.
    console.error('[reminders] sync FAILED:', err?.message || err);
    VibeAlert(
      'Reminder not scheduled',
      `The item saved, but its reminder could not be stored.\n\n${err?.message || err}`
    );
  }
}
