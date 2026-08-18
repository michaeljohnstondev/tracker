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
  makeNode,
  descendantsOf,
  childrenOf,
} from '../lib/nodes';
import { loadFiling, saveFiling } from '../lib/filing';
import { useAuth } from './AuthContext';
import * as remote from '../services/nodes';
import VibeAlert from '../components/ui/VibeAlert';

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

  useEffect(() => {
    (async () => {
      const [nodes, savedFiling] = await Promise.all([loadNodes(), loadFiling()]);
      setLocalNodes(nodes);
      setFiling(savedFiling);
      setLoaded(true);
    })();
  }, []);

  const commitLocal = useCallback((next) => {
    setLocalNodes(next);
    localRef.current = next;
    saveNodes(next);
  }, []);

  // ---- Shared trees -------------------------------------------------------

  useEffect(() => {
    if (!uid) {
      setSharedTrees({});
      return undefined;
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

        Array.from(perTree.keys()).forEach((rootId) => {
          if (!ids.has(rootId)) drop(rootId);
        });

        ids.forEach((rootId) => {
          if (perTree.has(rootId)) return;
          perTree.set(
            rootId,
            remote.subscribeToTree(
              rootId,
              (nodes) => setSharedTrees((prev) => ({ ...prev, [rootId]: nodes })),
              // A tree can stop being readable while you're watching it —
              // someone deletes it, or drops you from it. Without a handler
              // that surfaces as an uncaught error rather than one dead
              // subscription, and takes everything else with it.
              (err) => {
                reportRemote('shared list', err);
                drop(rootId);
              }
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

  const deleteNode = useCallback(
    async (node) => {
      if (!node) return;

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
    [commitLocal, uid, setFiledUnder]
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
    (node) =>
      updateNode(node, {
        done: !node.done,
        doneAt: !node.done ? Date.now() : null,
        doneBy: !node.done ? uid ?? null : null,
      }),
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
