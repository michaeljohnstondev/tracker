const {
  onDocumentCreated,
  onDocumentUpdated,
} = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

// Push notifications for shared lists.
//
// FCM via the Admin SDK, matching the other apps — deliberately not Expo's
// push service. Same shape as snapple-park's deliverNotification: one place
// that sends, every trigger funnels through it.
//
// These run as Cloud Functions rather than sending from the client because a
// client can only send to people it can see — and push tokens live in
// users/{uid}/private, which no other user is allowed to read. The Admin SDK
// bypasses rules, so the token never has to be exposed to do this.

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

const REGION = 'us-central1';

/** Display name for a uid, falling back to something non-empty. */
async function actorName(uid) {
  if (!uid) return 'Someone';
  const snap = await db.collection('users').doc(uid).get();
  const data = snap.exists ? snap.data() : null;
  return data?.displayName || data?.email || 'Someone';
}

/** Everyone currently on a list. */
async function listMemberUids(listId) {
  const snap = await db
    .collection('memberships')
    .where('listId', '==', listId)
    .get();
  return snap.docs.map((d) => d.data().uid).filter(Boolean);
}

/** Every member of a list except the one who triggered the event. */
async function otherMemberUids(listId, actorUid) {
  const uids = await listMemberUids(listId);
  return uids.filter((uid) => uid !== actorUid);
}

/**
 * Send to every device belonging to the given users. Tokens that FCM reports
 * as dead are deleted — otherwise a reinstalled phone leaves a stale token
 * that fails on every future send, forever.
 */
async function pushToUsers(uids, { title, body, data = {} }) {
  if (!uids.length) return { sent: 0 };

  const tokenDocs = await Promise.all(
    uids.map(async (uid) => {
      const snap = await db
        .collection('users')
        .doc(uid)
        .collection('private')
        .doc('push')
        .get();
      return snap.exists ? { uid, token: snap.data().token } : null;
    })
  );

  const targets = tokenDocs.filter((t) => t?.token);
  if (!targets.length) return { sent: 0 };

  const response = await messaging.sendEachForMulticast({
    tokens: targets.map((t) => t.token),
    notification: { title, body },
    // Strings only — FCM rejects other types in the data payload.
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ),
    android: { priority: 'high' },
  });

  const dead = [];
  response.responses.forEach((r, i) => {
    const code = r.error?.code || '';
    if (
      code.includes('registration-token-not-registered') ||
      code.includes('invalid-registration-token') ||
      code.includes('invalid-argument')
    ) {
      dead.push(targets[i].uid);
    }
  });

  await Promise.all(
    dead.map((uid) =>
      db.collection('users').doc(uid).collection('private').doc('push').delete()
    )
  );

  return { sent: response.successCount, pruned: dead.length };
}

// "Michael added Milk" — sent to everyone on the list but the person who
// added it.
exports.onItemAdded = onDocumentCreated(
  { region: REGION, document: 'lists/{listId}/items/{itemId}' },
  async (event) => {
    const item = event.data?.data();
    if (!item) return;

    const { listId } = event.params;
    const actorUid = item.createdBy;

    const [listSnap, recipients, name] = await Promise.all([
      db.collection('lists').doc(listId).get(),
      otherMemberUids(listId, actorUid),
      actorName(actorUid),
    ]);

    // A list with one member is the common case — someone using a shared
    // list alone. Nothing to send, and no reason to read anything further.
    if (!recipients.length || !listSnap.exists) return;

    const listName = listSnap.data().name || 'a list';

    await pushToUsers(recipients, {
      title: listName,
      body: `${name} added ${item.text}`,
      data: { type: 'item_added', listId, itemId: event.params.itemId },
    });
  }
);

// "Michael shared Groceries with you" — sent when someone directs a list at a
// specific person, rather than handing out a code.
exports.onListShared = onDocumentCreated(
  { region: REGION, document: 'shares/{shareId}' },
  async (event) => {
    const share = event.data?.data();
    if (!share?.toUid || !share?.listId) return;

    const [listSnap, name] = await Promise.all([
      db.collection('lists').doc(share.listId).get(),
      actorName(share.fromUid),
    ]);
    if (!listSnap.exists) return;

    const listName = listSnap.data().name || 'a list';

    await pushToUsers([share.toUid], {
      title: 'Tracker',
      body: `${name} shared ${listName} with you`,
      data: { type: 'list_shared', listId: share.listId },
    });
  }
);

// "Michael got the milk" — the message that stops two people buying the same
// thing, which is most of the point of a shared shopping list.
//
// An update trigger sees every write to an item: notes, text edits, and every
// autosave. So this fires only on the specific transition from not-done to
// done. Un-ticking is silent, as is deleting, which has no trigger at all.
exports.onItemCompleted = onDocumentUpdated(
  { region: REGION, document: 'lists/{listId}/items/{itemId}' },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;
    if (before.done || !after.done) return;

    const { listId } = event.params;
    // Whoever ticked it off doesn't need telling they did.
    const actorUid = after.doneBy || null;

    const [listSnap, recipients, name] = await Promise.all([
      db.collection('lists').doc(listId).get(),
      otherMemberUids(listId, actorUid),
      actorName(actorUid),
    ]);
    if (!recipients.length || !listSnap.exists) return;

    await pushToUsers(recipients, {
      title: listSnap.data().name || 'a list',
      body: `${name} got ${after.text}`,
      data: { type: 'item_completed', listId, itemId: event.params.itemId },
    });
  }
);

// Fires due reminders. Runs on a schedule rather than a trigger because
// nothing happens in the database at the moment a reminder comes due.
//
// Reminder docs are deleted once sent, so "fireAt has passed" is the entire
// query — one auto-indexed field, no status flag, and a failed send simply
// leaves the doc in place to be retried on the next pass.
exports.sweepReminders = onSchedule(
  { region: REGION, schedule: 'every 5 minutes' },
  async () => {
    const snap = await db
      .collection('reminders')
      .where('fireAt', '<=', Date.now())
      .limit(200)
      .get();

    if (snap.empty) return;

    for (const docSnap of snap.docs) {
      const reminder = docSnap.data();
      try {
        const label = reminder.trackerName
          ? `${reminder.trackerName}`
          : 'Reminder';

        // Membership is read now rather than trusted from when the reminder
        // was saved. Someone who joined the list since would otherwise never
        // be told, and someone who left would still be. Unlike the activity
        // notifications there's no actor to exclude — whoever set the
        // reminder wants it too.
        const recipients = reminder.listId
          ? await listMemberUids(reminder.listId)
          : reminder.targetUids || [];

        const result = await pushToUsers(recipients, {
          title: label,
          body: reminder.itemText || 'Reminder',
          data: {
            type: 'reminder',
            itemId: reminder.itemId || '',
            listId: reminder.listId || '',
          },
        });

        if (!result.sent && recipients.length) {
          // Nobody had a usable token — most likely notification permission
          // was never granted. Logged rather than retried: a reminder is
          // tied to a moment, and re-attempting it every five minutes
          // forever helps no one.
          console.log('[sweepReminders] no recipients for', docSnap.id);
        }
        await docSnap.ref.delete();
      } catch (err) {
        console.error('[sweepReminders] failed for', docSnap.id, err);
      }
    }
  }
);

// "Sarah joined Groceries" — the other half of code-based invites, so the
// person who handed out a code learns it was used.
exports.onMemberJoined = onDocumentCreated(
  { region: REGION, document: 'memberships/{membershipId}' },
  async (event) => {
    const membership = event.data?.data();
    if (!membership?.listId || membership.role === 'owner') return;

    const { listId, uid } = membership;

    const [listSnap, recipients, name] = await Promise.all([
      db.collection('lists').doc(listId).get(),
      otherMemberUids(listId, uid),
      actorName(uid),
    ]);
    if (!recipients.length || !listSnap.exists) return;

    const listName = listSnap.data().name || 'a list';

    await pushToUsers(recipients, {
      title: listName,
      body: `${name} joined ${listName}`,
      data: { type: 'member_joined', listId },
    });
  }
);
