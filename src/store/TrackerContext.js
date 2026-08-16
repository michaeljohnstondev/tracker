import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';
import { loadTrackers, saveTrackers, newId } from '../lib/trackers';
import { useAuth } from './AuthContext';
import * as remote from '../services/lists';

const TrackerContext = createContext(null);

// Shared lists get a prefixed id so a remote list and a local tracker can
// never collide in the router or in a React key.
const remoteKey = (listId) => `remote:${listId}`;

export function TrackerProvider({ children }) {
  const { uid } = useAuth();

  const [localTrackers, setLocalTrackers] = useState([]);
  const [loaded, setLoaded] = useState(false);
  // listId -> { meta, items }, built up from two live subscriptions per list.
  const [sharedById, setSharedById] = useState({});

  const localRef = useRef([]);
  localRef.current = localTrackers;

  useEffect(() => {
    (async () => {
      const initial = await loadTrackers();
      setLocalTrackers(initial);
      setLoaded(true);
    })();
  }, []);

  // Local mutations: compute next array, set state, persist. Persistence is
  // fire-and-forget — in-memory state is the source of truth for the UI.
  const commit = useCallback((next) => {
    setLocalTrackers(next);
    localRef.current = next;
    saveTrackers(next);
  }, []);

  const addTracker = useCallback(
    (tracker) => commit([...localRef.current, tracker]),
    [commit]
  );

  const updateTracker = useCallback(
    (id, patch) => {
      commit(
        localRef.current.map((t) =>
          t.id === id
            ? { ...t, ...(typeof patch === 'function' ? patch(t) : patch) }
            : t
        )
      );
    },
    [commit]
  );

  const deleteLocalTracker = useCallback(
    (id) => commit(localRef.current.filter((t) => t.id !== id)),
    [commit]
  );

  // Subscribe to every list this user belongs to. Memberships drive the set,
  // and each list gets its own metadata + items listeners which are torn down
  // as soon as the membership disappears (left, removed, or list deleted).
  useEffect(() => {
    if (!uid) {
      setSharedById({});
      return undefined;
    }

    const perList = new Map();

    const dropList = (listId) => {
      const unsubs = perList.get(listId);
      if (unsubs) unsubs.forEach((u) => u());
      perList.delete(listId);
      setSharedById((prev) => {
        if (!(listId in prev)) return prev;
        const next = { ...prev };
        delete next[listId];
        return next;
      });
    };

    const unsubMemberships = remote.subscribeToMyLists(uid, (memberships) => {
      const ids = new Set(memberships.map((m) => m.listId).filter(Boolean));

      Array.from(perList.keys()).forEach((listId) => {
        if (!ids.has(listId)) dropList(listId);
      });

      ids.forEach((listId) => {
        if (perList.has(listId)) return;
        const unsubMeta = remote.subscribeToList(listId, (meta) => {
          if (!meta) {
            dropList(listId);
            return;
          }
          setSharedById((prev) => ({
            ...prev,
            [listId]: { items: [], ...prev[listId], meta },
          }));
        });
        const unsubItems = remote.subscribeToItems(listId, (items) => {
          setSharedById((prev) => ({
            ...prev,
            [listId]: { ...prev[listId], items },
          }));
        });
        perList.set(listId, [unsubMeta, unsubItems]);
      });
    });

    return () => {
      unsubMemberships();
      perList.forEach((unsubs) => unsubs.forEach((u) => u()));
      perList.clear();
    };
  }, [uid]);

  // Shaped to look exactly like a local list tracker, so screens don't have to
  // branch on where a list came from.
  const sharedTrackers = useMemo(
    () =>
      Object.entries(sharedById)
        .filter(([, entry]) => entry?.meta)
        .map(([listId, entry]) => ({
          id: remoteKey(listId),
          remoteId: listId,
          shared: true,
          type: 'list',
          name: entry.meta.name,
          color: entry.meta.color,
          ownerUid: entry.meta.ownerUid,
          isOwner: entry.meta.ownerUid === uid,
          createdAt: entry.meta.createdAt ?? 0,
          items: entry.items ?? [],
        })),
    [sharedById, uid]
  );

  const trackers = useMemo(
    () =>
      [...localTrackers, ...sharedTrackers].sort(
        (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)
      ),
    [localTrackers, sharedTrackers]
  );

  const allRef = useRef([]);
  allRef.current = trackers;

  const getTracker = useCallback(
    (id) => allRef.current.find((t) => t.id === id) || null,
    []
  );

  // ---- Unified item operations -------------------------------------------
  // Screens call these and stay oblivious to local-vs-shared storage.

  const addItemTo = useCallback(
    (tracker, text) => {
      if (tracker.shared) return remote.addItem(tracker.remoteId, text, uid);
      const item = { id: newId(), text, done: false, createdAt: Date.now() };
      updateTracker(tracker.id, (t) => ({ items: [...(t.items || []), item] }));
      return Promise.resolve();
    },
    [uid, updateTracker]
  );

  const toggleItemIn = useCallback(
    (tracker, itemId) => {
      if (tracker.shared) {
        const item = (tracker.items || []).find((i) => i.id === itemId);
        return remote.setItemDone(tracker.remoteId, itemId, !item?.done, uid);
      }
      updateTracker(tracker.id, (t) => ({
        items: t.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)),
      }));
      return Promise.resolve();
    },
    [uid, updateTracker]
  );

  const removeItemFrom = useCallback(
    (tracker, itemId) => {
      if (tracker.shared) return remote.removeItem(tracker.remoteId, itemId);
      updateTracker(tracker.id, (t) => ({
        items: t.items.filter((i) => i.id !== itemId),
      }));
      return Promise.resolve();
    },
    [updateTracker]
  );

  const clearDoneIn = useCallback(
    (tracker) => {
      if (tracker.shared) return remote.clearDoneItems(tracker.remoteId);
      updateTracker(tracker.id, (t) => ({
        items: t.items.filter((i) => !i.done),
      }));
      return Promise.resolve();
    },
    [updateTracker]
  );

  // ---- Sharing ------------------------------------------------------------

  // Publish a local list, then drop the local copy — the subscription above
  // brings it straight back as a shared tracker, so the user sees it move
  // rather than duplicate.
  const shareTracker = useCallback(
    async (tracker) => {
      if (!uid) throw new Error('Sign in to share a list.');
      if (tracker.shared) return tracker.remoteId;
      const listId = await remote.shareList(tracker, uid);
      deleteLocalTracker(tracker.id);
      return listId;
    },
    [uid, deleteLocalTracker]
  );

  const deleteTracker = useCallback(
    (idOrTracker) => {
      const tracker =
        typeof idOrTracker === 'string' ? getTracker(idOrTracker) : idOrTracker;
      if (!tracker) return Promise.resolve();
      if (!tracker.shared) {
        deleteLocalTracker(tracker.id);
        return Promise.resolve();
      }
      // Owners destroy the list for everyone; members just leave it.
      return tracker.isOwner
        ? remote.deleteSharedList(tracker.remoteId, uid)
        : remote.leaveList(tracker.remoteId, uid);
    },
    [uid, getTracker, deleteLocalTracker]
  );

  const value = {
    trackers,
    loaded,
    addTracker,
    updateTracker,
    deleteTracker,
    getTracker,
    addItemTo,
    toggleItemIn,
    removeItemFrom,
    clearDoneIn,
    shareTracker,
  };

  return (
    <TrackerContext.Provider value={value}>{children}</TrackerContext.Provider>
  );
}

export function useTrackers() {
  const ctx = useContext(TrackerContext);
  if (!ctx) throw new Error('useTrackers must be used within TrackerProvider');
  return ctx;
}
