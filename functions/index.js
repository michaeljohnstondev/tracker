const { onDocumentCreated } = require('firebase-functions/v2/firestore');
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

/** Every member of a list except the one who triggered the event. */
async function otherMemberUids(listId, actorUid) {
  const snap = await db
    .collection('memberships')
    .where('listId', '==', listId)
    .get();
  return snap.docs
    .map((d) => d.data().uid)
    .filter((uid) => uid && uid !== actorUid);
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
