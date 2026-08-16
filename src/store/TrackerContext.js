import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';
import {
  loadTrackers,
  saveTrackers,
  loadTrackerOrder,
  saveTrackerOrder,
  newId,
} from '../lib/trackers';
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

  // Explicit home-screen ordering, as a list of tracker ids. Anything not in
  // it (a brand-new tracker, a list someone just shared with you) falls to the
  // bottom rather than jumping into the middle unannounced.
  const [order, setOrder] = useState([]);

  useEffect(() => {
    (async () => {
      const [initial, savedOrder] = await Promise.all([
        loadTrackers(),
        loadTrackerOrder(),
      ]);
      setLocalTrackers(initial);
      setOrder(savedOrder);
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

  const trackers = useMemo(() => {
    const rank = new Map(order.map((id, index) => [id, index]));
    return [...localTrackers, ...sharedTrackers].sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id) : Infinity;
      const rb = rank.has(b.id) ? rank.get(b.id) : Infinity;
      // Unranked trackers keep their old creation ordering among themselves.
      if (ra !== rb) return ra - rb;
      return (a.createdAt ?? 0) - (b.createdAt ?? 0);
    });
  }, [localTrackers, sharedTrackers, order]);

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

  // direction is -1 (up) or +1 (down). The saved order is rebuilt from what's
  // currently on screen, so the first move also pins down every other
  // tracker's position instead of leaving them implicitly ranked.
  const moveTracker = useCallback((id, direction) => {
    const ids = allRef.current.map((t) => t.id);
    const from = ids.indexOf(id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= ids.length) return;

    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    setOrder(next);
    saveTrackerOrder(next);
  }, []);

  const moveItemIn = useCallback(
    (tracker, itemId, direction) => {
      const items = [...(tracker.items || [])];
      const from = items.findIndex((i) => i.id === itemId);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= items.length) return Promise.resolve();

      const [moved] = items.splice(from, 1);
      items.splice(to, 0, moved);

      if (tracker.shared) return remote.reorderItems(tracker.remoteId, items);
      updateTracker(tracker.id, { items });
      return Promise.resolve();
    },
    [updateTracker]
  );

  const renameTracker = useCallback(
    (tracker, name) => {
      const trimmed = name.trim();
      // Silently ignoring an empty name is friendlier than an error dialog:
      // the modal simply closes and nothing changes.
      if (!trimmed || trimmed === tracker.name) return Promise.resolve();
      if (tracker.shared) return remote.renameList(tracker.remoteId, trimmed);
      updateTracker(tracker.id, { name: trimmed });
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
    renameTracker,
    moveTracker,
    moveItemIn,
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
