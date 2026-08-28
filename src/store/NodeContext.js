import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  loadNodes,
  saveNodes,
  loadSharedMirror,
  saveSharedMirror,
  makeNode,
  descendantsOf,
  duplicateSubtree,
  childrenOf,
} from '../lib/nodes';
import { loadFiling, saveFiling } from '../lib/filing';
import { recoverLegacyTrackers, markLegacyRecovered } from '../lib/legacy';
import { useAuth } from './AuthContext';
import * as remote from '../services/nodes';
import VibeAlert from '../components/ui/VibeAlert';
import {
  syncNodeReminders,
  syncGoalReminder,
  clearItemReminders,
} from '../services/reminders';

const NodeContext = createContext(null);

// Say it out loud, once per distinct problem.
//
// These all used to go to console.error, which production strips — so a
// subscription that failed on someone else's phone reported precisely nothing
// and the app just seemed to misbehave. Repeats are swallowed because a
// listener can fail on every retry.
const reported = new Set();
function reportRemote(what, err) {
  const message = err?.message || String(err);
  console.error(`[nodes] ${what}:`, message);
  if (reported.has(what)) return;
  reported.add(what);
  VibeAlert(`Sync problem: ${what}`, message, [], 'error');
}

export function NodeProvider({ children }) {
  const { uid, user } = useAuth();

  const [localNodes, setLocalNodes] = useState([]);
  const [loaded, setLoaded] = useState(false);
  // rootId -> the nodes of that shared tree, straight from Firestore.
  const [sharedTrees, setSharedTrees] = useState({});
  // Where a shared tree's root sits on *this* device. Filing is personal, so
  // two people can keep the same shared list in different places.
  const [filing, setFiling] = useState({});

  const localRef = useRef([]);
  localRef.current = localNodes;

  // Set when the device's own lists could not be read. While it is true the
  // app still works, but nothing is written back — an edit made on top of a
  // failed read would otherwise persist the gap and destroy the real data.
  const readFailed = useRef(false);
  const loadedRef = useRef(false);

  // The device's own copy of the shared trees, and whether the server has said
  // anything yet this session.
  const mirrorRef = useRef(null);
  const answered = useRef(false);
  const sharedRef = useRef({});
  sharedRef.current = sharedTrees;
  const healed = useRef(false);

  useEffect(() => {
    (async () => {
      const [savedFiling, mirror] = await Promise.all([
        loadFiling(),
        loadSharedMirror(),
      ]);

      // Kept apart from the other two: a failure here is the one that can cost
      // you data, and it must not be confused with having none.
      let nodes = [];
      try {
        nodes = await loadNodes();
      } catch (err) {
        readFailed.current = true;
        VibeAlert(
          'Could not read your lists',
          `They are still on the phone — this is a failure to read them, not a deletion. Nothing will be saved over them until the app can read them again.

${
            err?.message || err
          }`,
          [],
          'error'
        );
      }

      // A phone that used the app before the node rewrite still has its lists
      // under the old keys, never brought across. Attempted once per device,
      // and never when the read failed — an unreadable store is not an empty
      // one, and merging into it would write a subset back over the whole.
      if (!readFailed.current) {
        try {
          const recovered = await recoverLegacyTrackers(nodes);
          if (recovered?.length) {
            const merged = [...nodes, ...recovered];
            await saveNodes(merged);
            await markLegacyRecovered();
            nodes = merged;
            VibeAlert(
              'Your lists are back',
              `${recovered.length} things were still stored the way an older version of the app kept them, and had stopped being read. They have been brought across.`,
              [],
              'success'
            );
          }
        } catch (err) {
          reportRemote('recovering lists from an older version', err);
        }
      }

      setLocalNodes(nodes);
      setFiling(savedFiling);
      mirrorRef.current = mirror;
      loadedRef.current = true;
      setLoaded(true);
    })();
  }, []);

  /**
   * Mirrored on every change, so the device always holds the last thing it saw.
   *
   * Not written until the server has actually answered. State is empty for the
   * moment between signing in and the first snapshot, and saving then would
   * overwrite the backup with nothing — precisely when it's most needed. An
   * empty answer, on the other hand, is a real answer: it means every list has
   * been left, and the mirror should say so.
   */
  useEffect(() => {
    if (!loaded || !uid) return;
    if (!answered.current && !Object.keys(sharedTrees).length) return;
    saveSharedMirror(uid, sharedTrees);
  }, [sharedTrees, loaded, uid]);

  const commitLocal = useCallback((next) => {
    setLocalNodes(next);
    localRef.current = next;
    // Two ways an edit can be built on top of lists we do not actually have:
    // the read failed, or it has not finished yet. Writing in either case
    // saves a subset over the whole, so the change stays on screen for this
    // session and the stored copy is left intact.
    if (readFailed.current || !loadedRef.current) return;
    saveNodes(next);
  }, []);

  // ---- Shared trees -------------------------------------------------------

  useEffect(() => {
    if (!uid) {
      // Cleared from view only. The mirror on disk is left alone, so signing
      // back in — including from the crash screen's escape hatch — brings
      // everything back rather than starting from nothing.
      answered.current = false;
      healed.current = false;
      setSharedTrees({});
      return undefined;
    }

    // Show this account's last known lists straight away, before Firestore has
    // been asked anything.
    if (mirrorRef.current?.uid === uid) {
      setSharedTrees((live) =>
        Object.keys(live).length ? live : mirrorRef.current.trees
      );
    }

    const perTree = new Map();

    const drop = (rootId) => {
      const unsub = perTree.get(rootId);
      if (unsub) unsub();
      perTree.delete(rootId);
      setSharedTrees((prev) => {
        if (!(rootId in prev)) return prev;
        const next = { ...prev };
        delete next[rootId];
        return next;
      });
    };

    const unsubMemberships = remote.subscribeToMemberships(
      uid,
      (memberships) => {
        const ids = new Set(memberships.map((m) => m.rootId).filter(Boolean));
        answered.current = true;

        // Anything you made but no longer have a membership for gets its
        // membership put back. Runs once a session, and normally finds
        // nothing — it exists because the memberships collection is the only
        // record of which lists are yours, and losing it hid every shared
        // list while the lists themselves sat there intact.
        if (!healed.current) {
          healed.current = true;

          // Trees you own but have no membership for get one back. Trees you
          // own and can still see are written into the list, so anything made
          // before this existed is covered from now on. Only your own — a
          // list someone shared with you is theirs to recover.
          memberships
            .filter((m) => m.role === 'owner' && m.rootId)
            .forEach((m) => {
              remote
                .rememberOwnTree(uid, m.rootId)
                .catch((err) => reportRemote('remembering your lists', err));
            });

          remote
            .findOwnedRootIds(uid)
            .then((owned) =>
              Promise.all(
                owned
                  .filter((rootId) => !ids.has(rootId))
                  .map((rootId) => remote.claimOwnTree(rootId, uid))
              )
            )
            .catch((err) => reportRemote('recovering your lists', err));
        }

        // Dropped only when the membership itself is gone — you left, or were
        // removed. That is the one signal that genuinely means "this is not
        // your list any more", as opposed to "this could not be read just now".
        Object.keys(sharedRef.current).forEach((rootId) => {
          if (!ids.has(rootId)) drop(rootId);
        });

        ids.forEach((rootId) => {
          if (perTree.has(rootId)) return;
          perTree.set(
            rootId,
            remote.subscribeToTree(
              rootId,
              (nodes) => setSharedTrees((prev) => ({ ...prev, [rootId]: nodes })),
              // Report it and leave the list exactly where it is.
              //
              // This used to drop the tree, which is how a momentary permission
              // error read as "my shared list has vanished" — the list was
              // never gone, only unreadable for a second, and dropping it
              // also killed the subscription so it stayed gone until a
              // restart. A failure to read is a failure to refresh. What's on
              // screen is the last thing we saw, which is still true.
              (err) => reportRemote('shared list', err)
            )
          );
        });
      },
      (err) => reportRemote('memberships', err)
    );

    return () => {
      unsubMemberships();
      perTree.forEach((unsub) => unsub());
      perTree.clear();
    };
  }, [uid]);

  // Invitations sent to this address are taken up on sight.
  //
  // No accept step: someone put a shared list in front of you by name, and
  // making you confirm it adds a decision without adding a choice — you can
  // always leave. It also means it simply appears, which is the point.
  const accepting = useRef(new Set());

  useEffect(() => {
    const email = user?.email;
    if (!uid || !email) return undefined;

    // Wrapped because this is the newest thing to run at sign-in, and sign-in
    // is where the app started dying. Nothing about waiting for an invitation
    // is worth taking the app down for.
    try {
      return remote.subscribeToInvitations(
        email,
        (invitations) => {
          invitations.forEach(({ rootId }) => {
            // The snapshot fires again the moment the membership lands, before
            // the invitation has been cleared — so without this the same one
            // is taken up twice.
            if (accepting.current.has(rootId)) return;
            accepting.current.add(rootId);

            remote.acceptInvitation({ rootId, email, uid }).catch((err) => {
              accepting.current.delete(rootId);
              reportRemote('accepting an invitation', err);
            });
          });
        },
        (err) => reportRemote('invitations', err)
      );
    } catch (err) {
      reportRemote('watching for invitations', err);
      return undefined;
    }
  }, [uid, user?.email]);

  const setFiledUnder = useCallback((nodeId, parentId) => {
    setFiling((prev) => {
      const next = { ...prev };
      if (parentId) next[nodeId] = parentId;
      else delete next[nodeId];
      saveFiling(next);
      return next;
    });
  }, []);

  // ---- The merged tree ----------------------------------------------------

  const nodes = useMemo(() => {
    const shared = Object.entries(sharedTrees).flatMap(([rootId, treeNodes]) =>
      treeNodes.map((n) => ({
        ...n,
        shared: true,
        rootId,
        // A shared root has no parent on the server — where it sits is a
        // personal, on-device decision.
        parentId: n.id === rootId ? filing[n.id] ?? null : n.parentId ?? null,
        isRoot: n.id === rootId,
      }))
    );
    return [...localNodes, ...shared];
  }, [localNodes, sharedTrees, filing]);

  const allRef = useRef([]);
  allRef.current = nodes;

  const getNode = useCallback(
    (id) => allRef.current.find((n) => n.id === id) || null,
    []
  );

  const childrenFor = useCallback(
    (parentId) => childrenOf(allRef.current, parentId),
    // Recomputed whenever the tree changes; `nodes` is the real dependency.
    [nodes] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ---- Mutations ----------------------------------------------------------

  const addNode = useCallback(
    (fields, parent = null) => {
      const node = makeNode({ ...fields, parentId: parent?.id ?? null });

      // Added inside a shared tree, so it belongs to that tree.
      if (parent?.shared) {
        remote.createNode({ ...node, parentId: parent.id }, parent.rootId, uid);
        return node.id;
      }

      commitLocal([...localRef.current, node]);
      return node.id;
    },
    [commitLocal, uid]
  );

  const updateNode = useCallback(
    (node, patch) => {
      if (node.shared) return remote.updateNode(node.rootId, node.id, patch);
      commitLocal(
        localRef.current.map((n) => (n.id === node.id ? { ...n, ...patch } : n))
      );
      return Promise.resolve();
    },
    [commitLocal]
  );

  /** Drop the pending alarms for a node and everything under it. */
  const forgetReminders = useCallback((node) => {
    const doomed = [node, ...descendantsOf(allRef.current, node.id)];
    doomed.forEach((n) => {
      if (n.reminders?.length) clearItemReminders(n.id, n.reminders);
      // A timer's goal alarm is keyed separately from the item's own alarms,
      // so clearing one would otherwise leave the other to fire.
      syncGoalReminder({
        tracker: n,
        uid,
        key: `node_${n.id}`,
        label: n.name,
        startMs: null,
        goalHours: null,
      });
    });
  }, [uid]);

  const deleteNode = useCallback(
    async (node) => {
      if (!node) return;

      // Alarms for something that no longer exists can only ever be wrong, and
      // nothing else would remove them — the reminder documents outlive the
      // node, deliberately, so that an alarm on a device-local node still
      // works. The subtree goes too: deleting a category takes its children
      // with it, and their alarms are just as orphaned.
      forgetReminders(node);

      if (node.shared) {
        // Deleting the root of a shared tree ends it for everyone; deleting a
        // node inside one just removes that branch.
        if (node.isRoot) {
          await remote.deleteNode(node.id, node.rootId);
          await remote.leaveTree(node.rootId, uid);
          setFiledUnder(node.id, null);
        } else {
          await remote.deleteNode(node.id, node.rootId);
        }
        return;
      }

      const doomed = new Set([
        node.id,
        ...descendantsOf(localRef.current, node.id).map((n) => n.id),
      ]);
      commitLocal(localRef.current.filter((n) => !doomed.has(n.id)));
    },
    [commitLocal, uid, setFiledUnder, forgetReminders]
  );

  const moveNode = useCallback(
    (node, parentId) => {
      const target = parentId ? allRef.current.find((n) => n.id === parentId) : null;

      // Dropping something of your own into a shared tree publishes it there,
      // along with everything under it. That's the obvious reading of the
      // gesture: put it in the shared list and it becomes shared.
      if (!node.shared && target?.shared) {
        const descendants = descendantsOf(localRef.current, node.id);
        const doomed = new Set([node.id, ...descendants.map((n) => n.id)]);

        // Awaited before removing anything. The same mistake as sharing —
        // deleting first and trusting the upload — is how a folder vanished
        // when the write turned out to be refused.
        return remote
          .publishInto({
            node,
            descendants,
            parentId: target.id,
            rootId: target.rootId,
            uid,
          })
          .then(() => {
            commitLocal(localRef.current.filter((n) => !doomed.has(n.id)));
          })
          .catch((err) => {
            console.error('[nodes] publish failed:', err?.message || err);
            VibeAlert(
              'Could not move',
              `Nothing was uploaded, and your copy is untouched.\n\n${err?.message || err}`,
              [],
              'error'
            );
          });
      }

      // A shared tree's root is filed personally rather than actually moved,
      // so the same list can sit in different places for different people.
      if (node.shared && node.isRoot) {
        setFiledUnder(node.id, parentId);
        return Promise.resolve();
      }

      return updateNode(node, { parentId: parentId ?? null });
    },
    [setFiledUnder, updateNode, commitLocal, uid]
  );

  /**
   * Move several nodes at once.
   *
   * Sequential rather than parallel: moving into a shared tree publishes the
   * node and then deletes the local copy, and two of those racing can have one
   * read the local list while the other is midway through rewriting it.
   */
  const moveNodes = useCallback(
    async (list, parentId) => {
      for (const node of list) {
        // Re-read it each time. A move can rewrite the ones after it — moving
        // a category takes its children — so the copy captured when the
        // selection was made may already be stale.
        const current = allRef.current.find((n) => n.id === node.id);
        if (current) await moveNode(current, parentId);
      }
    },
    [moveNode]
  );

  /**
   * Copy several nodes, and everything under them, into somewhere else.
   *
   * Where they land decides what they become: dropped into a shared list the
   * copies are written to that tree and are shared from birth; anywhere else
   * they're ordinary local nodes. That's the same rule moving already follows,
   * so a copy doesn't need its own idea of what sharing means.
   */
  const copyNodes = useCallback(
    async (list, parentId) => {
      const target = parentId ? allRef.current.find((n) => n.id === parentId) : null;

      const copies = list.flatMap((node) =>
        duplicateSubtree(allRef.current, node, parentId ?? null)
      );
      if (!copies.length) return;

      if (target?.shared) {
        await Promise.all(
          copies.map((copy) => remote.createNode(copy, target.rootId, uid))
        );
        return;
      }

      commitLocal([...localRef.current, ...copies]);
    },
    [commitLocal, uid]
  );

  /** Reorder siblings by writing new positions to the ones that moved. */
  const reorderChildren = useCallback(
    (parentId, from, to) => {
      const siblings = childrenOf(allRef.current, parentId);
      if (from === to || from < 0 || to < 0 || to >= siblings.length) return;

      const next = [...siblings];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);

      next.forEach((node, index) => {
        if (node.order !== index) updateNode(node, { order: index });
      });
    },
    [updateNode]
  );

  const toggleDone = useCallback(
    (node) => {
      const done = !node.done;
      const result = updateNode(node, {
        done,
        doneAt: done ? Date.now() : null,
        doneBy: done ? uid ?? null : null,
      });

      // Crossing something off has to take its alarms with it. Nothing was
      // going to: the sync already refuses to schedule anything for a done
      // node, but the only thing calling it was the item's own screen — so
      // ticking a box in a list left the alarm to go off for something already
      // dealt with.
      //
      // Un-ticking puts them back, which is the same call: what's wanted is
      // derived from the node's state, so both directions are one path rather
      // than two that can disagree.
      syncNodeReminders({
        node: { ...node, done },
        uid,
        previous: node.reminders ?? [],
        reminders: node.reminders ?? [],
      });

      return result;
    },
    [updateNode, uid]
  );

  // ---- Sharing ------------------------------------------------------------

  // Shares awaiting proof that the upload actually landed: rootId -> localId.
  const pendingShares = useRef(new Map());

  const shareNode = useCallback(
    (node) => {
      if (!uid) throw new Error('Sign in to share.');
      if (node.shared) return { rootId: node.rootId };

      const descendants = descendantsOf(localRef.current, node.id);
      const { rootId, settled } = remote.shareSubtree({ node, descendants, uid });

      // The local copy is NOT deleted here. It was, once, and when the upload
      // was refused it took the original with it — the thing being shared
      // simply vanished. Nothing is removed until the shared copy has been
      // seen coming back down.
      pendingShares.current.set(rootId, node.id);

      settled.catch((err) => {
        pendingShares.current.delete(rootId);
        console.error('[nodes] share failed:', err?.message || err);
        VibeAlert(
          'Could not share',
          `Nothing was uploaded, and your copy is untouched.\n\n${err?.message || err}`,
          [],
          'error'
        );
      });

      // Remember where it was filed, so the shared copy reappears in the same
      // place rather than jumping to the top level.
      if (node.parentId) setFiledUnder(rootId, node.parentId);

      return { rootId, localId: node.id };
    },
    [uid, setFiledUnder]
  );

  // Drop a local copy only once its shared twin has arrived from the server.
  useEffect(() => {
    if (!pendingShares.current.size) return;

    const landed = [];
    pendingShares.current.forEach((localId, rootId) => {
      const tree = sharedTrees[rootId];
      if (tree?.some((n) => n.id === rootId)) landed.push([rootId, localId]);
    });
    if (!landed.length) return;

    const doomed = new Set();
    landed.forEach(([rootId, localId]) => {
      pendingShares.current.delete(rootId);
      doomed.add(localId);
      descendantsOf(localRef.current, localId).forEach((n) => doomed.add(n.id));
    });

    commitLocal(localRef.current.filter((n) => !doomed.has(n.id)));
  }, [sharedTrees, commitLocal]);


  const value = {
    nodes,
    loaded,
    getNode,
    childrenFor,
    addNode,
    updateNode,
    deleteNode,
    moveNode,
    moveNodes,
    copyNodes,
    reorderChildren,
    toggleDone,
    shareNode,
  };

  return <NodeContext.Provider value={value}>{children}</NodeContext.Provider>;
}

export function useNodes() {
  const ctx = useContext(NodeContext);
  if (!ctx) throw new Error('useNodes must be used within NodeProvider');
  return ctx;
}
