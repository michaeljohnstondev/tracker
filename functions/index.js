const {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentWritten,
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
//
// Everything here speaks the node model: a shared list is a tree, its nodes
// live at trees/{rootId}/nodes/{nodeId}, and the root node carries the name.
// The earlier version watched lists/{listId}/items and filtered memberships on
// listId, neither of which has existed since the rebuild — so none of these
// had fired in weeks, and reminders on shared items were being sent to nobody.

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

const REGION = 'us-central1';

const nodeRef = (rootId, nodeId) =>
  db.collection('trees').doc(rootId).collection('nodes').doc(nodeId);

/** Display name for a uid, falling back to something non-empty. */
async function actorName(uid) {
  if (!uid) return 'Someone';
  const snap = await db.collection('users').doc(uid).get();
  const data = snap.exists ? snap.data() : null;
  return data?.displayName || data?.email || 'Someone';
}

/** What a tree is called: the name of the node that was shared. */
async function treeName(rootId) {
  const snap = await nodeRef(rootId, rootId).get();
  return (snap.exists && snap.data().name) || 'a list';
}

/** Everyone currently on a tree. */
async function treeMemberUids(rootId) {
  const snap = await db
    .collection('memberships')
    .where('rootId', '==', rootId)
    .get();
  return snap.docs.map((d) => d.data().uid).filter(Boolean);
}

/** Every member of a tree except the one who triggered the event. */
async function otherMemberUids(rootId, actorUid) {
  const uids = await treeMemberUids(rootId);
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
exports.onNodeAdded = onDocumentCreated(
  { region: REGION, document: 'trees/{rootId}/nodes/{nodeId}' },
  async (event) => {
    const node = event.data?.data();
    if (!node) return;

    const { rootId, nodeId } = event.params;
    // The root is the list itself coming into existence, not something added
    // to it. Sharing writes it first, so without this every share would
    // announce itself as an item.
    if (nodeId === rootId) return;

    const actorUid = node.ownerUid;

    const [name, recipients, actor] = await Promise.all([
      treeName(rootId),
      otherMemberUids(rootId, actorUid),
      actorName(actorUid),
    ]);

    // A list with one member is the common case — someone using a shared
    // list alone. Nothing to send.
    if (!recipients.length) return;

    await pushToUsers(recipients, {
      title: name,
      body: `${actor} added ${node.name}`,
      data: { type: 'item_added', rootId, nodeId },
    });
  }
);

// "Michael ticked off Milk" — the message that stops two people buying the
// same thing, which is most of the point of a shared list.
//
// An update trigger sees every write to a node: notes, renames, and every
// autosave. So this fires only on the specific transition from not-done to
// done. Un-ticking is silent, as is deleting, which has no trigger at all —
// asked for directly: being told something was crossed out is useful, being
// told it was removed is not.
exports.onNodeCompleted = onDocumentUpdated(
  { region: REGION, document: 'trees/{rootId}/nodes/{nodeId}' },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;
    if (before.done || !after.done) return;

    const { rootId, nodeId } = event.params;
    // Whoever ticked it off doesn't need telling they did.
    const actorUid = after.doneBy || null;

    const [name, recipients, actor] = await Promise.all([
      treeName(rootId),
      otherMemberUids(rootId, actorUid),
      actorName(actorUid),
    ]);
    if (!recipients.length) return;

    await pushToUsers(recipients, {
      title: name,
      body: `${actor} ticked off ${after.name}`,
      data: { type: 'item_completed', rootId, nodeId },
    });
  }
);

// "Michael shared “Home Stuff” with you" — sent when someone invites a
// specific person by email, rather than handing out a code.
//
// The list's name is quoted because it sits mid-sentence, where a name of more
// than one word runs straight into the words either side of it. An item's name
// ends its sentence and needs no such help.
//
// The invitation is addressed to an email, which is the whole point: it works
// whether or not that person has an account yet. So the uid has to be looked
// up, and not finding one is an ordinary outcome — they'll see the list the
// moment they sign in, and a notification to someone with no account has
// nowhere to go anyway.
// Written rather than created: inviting someone who already has an unclaimed
// invitation overwrites it rather than making a new one, and that second
// attempt is usually the one that matters — it's what you do when the first
// didn't appear to arrive.
exports.onListShared = onDocumentWritten(
  { region: REGION, document: 'shares/{shareId}' },
  async (event) => {
    const share = event.data?.after?.data();
    // Deleting one is the recipient accepting it. Nothing to announce.
    if (!share?.rootId || !share?.email) return;

    const invitees = await db
      .collection('users')
      .where('email', '==', share.email)
      .limit(1)
      .get();
    if (invitees.empty) return;

    const [name, actor] = await Promise.all([
      treeName(share.rootId),
      actorName(share.fromUid),
    ]);

    await pushToUsers([invitees.docs[0].id], {
      title: 'Tracker',
      body: `${actor} shared “${name}” with you`,
      data: { type: 'list_shared', rootId: share.rootId },
    });
  }
);

// "Sarah joined Groceries" — so whoever invited someone learns it worked.
//
// Owners are skipped: that row is written by the person who shared the list in
// the first place, and again by the recovery that puts a missing membership
// back.
exports.onMemberJoined = onDocumentCreated(
  { region: REGION, document: 'memberships/{membershipId}' },
  async (event) => {
    const membership = event.data?.data();
    if (!membership?.rootId || membership.role === 'owner') return;

    const { rootId, uid } = membership;

    const [name, recipients, actor] = await Promise.all([
      treeName(rootId),
      otherMemberUids(rootId, uid),
      actorName(uid),
    ]);
    if (!recipients.length) return;

    await pushToUsers(recipients, {
      title: name,
      body: `${actor} joined “${name}”`,
      data: { type: 'member_joined', rootId },
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

        // The client still calls this listId; it has held a rootId since the
        // rebuild. Both are read, so reminders saved either side of this
        // change still find their people.
        const treeId = reminder.rootId || reminder.listId || null;

        // Membership is read now rather than trusted from when the reminder
        // was saved. Someone who joined the list since would otherwise never
        // be told, and someone who left would still be. Unlike the activity
        // notifications there's no actor to exclude — whoever set the
        // reminder wants it too.
        const recipients = treeId
          ? await treeMemberUids(treeId)
          : reminder.targetUids || [];

        const result = await pushToUsers(recipients, {
          title: label,
          body: reminder.itemText || 'Reminder',
          data: {
            type: 'reminder',
            itemId: reminder.itemId || '',
            rootId: treeId || '',
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
