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
  loadTrackerCategories,
  saveTrackerCategories,
  categoryOf,
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
  // trackerId -> category. Personal, device-local, covers shared lists too.
  const [categories, setCategories] = useState({});

  useEffect(() => {
    (async () => {
      const [initial, savedOrder, savedCategories] = await Promise.all([
        loadTrackers(),
        loadTrackerOrder(),
        loadTrackerCategories(),
      ]);
      setLocalTrackers(initial);
      setOrder(savedOrder);
      setCategories(savedCategories);
      setLoaded(true);
    })();
  }, []);

  const setTrackerCategory = useCallback((trackerId, category) => {
    setCategories((prev) => {
      const next = { ...prev, [trackerId]: category };
      saveTrackerCategories(next);
      return next;
    });
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
          // Timers share this collection too; older docs predate the field
          // and are all lists.
          type: entry.meta.type === 'timer' ? 'timer' : 'list',
          name: entry.meta.name,
          color: entry.meta.color,
          ownerUid: entry.meta.ownerUid,
          isOwner: entry.meta.ownerUid === uid,
          createdAt: entry.meta.createdAt ?? 0,
          startMs: entry.meta.startMs ?? null,
          goalHours: entry.meta.goalHours ?? null,
          items: entry.items ?? [],
        })),
    [sharedById, uid]
  );

  const trackers = useMemo(() => {
    const rank = new Map(order.map((id, index) => [id, index]));
    return [...localTrackers, ...sharedTrackers]
      .map((t) => ({
        ...t,
        // The local override wins over whatever the record carries, so a
        // shared list can be filed without touching the shared document.
        category: categories[t.id] ?? categoryOf(t),
      }))
      .sort((a, b) => {
        const ra = rank.has(a.id) ? rank.get(a.id) : Infinity;
        const rb = rank.has(b.id) ? rank.get(b.id) : Infinity;
        // Unranked trackers keep their creation ordering among themselves.
        if (ra !== rb) return ra - rb;
        return (a.createdAt ?? 0) - (b.createdAt ?? 0);
      });
  }, [localTrackers, sharedTrackers, order, categories]);

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

  // Field updates on the tracker itself — a timer's start time and goal.
  // Dispatches the same way item operations do, so the timer screen doesn't
  // need to know whether it's looking at a shared tracker.
  const updateTrackerFields = useCallback(
    (tracker, patch) => {
      if (tracker.shared) return remote.updateList(tracker.remoteId, patch);
      updateTracker(tracker.id, patch);
      return Promise.resolve();
    },
    [updateTracker]
  );

  const updateItemIn = useCallback(
    (tracker, itemId, patch) => {
      if (tracker.shared) return remote.updateItem(tracker.remoteId, itemId, patch);
      updateTracker(tracker.id, (t) => ({
        items: t.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
      }));
      return Promise.resolve();
    },
    [updateTracker]
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
    [updateTracker, setTrackerCategory]
  );

  /**
   * Reorder within whatever subset the home screen is currently showing.
   *
   * The indices from a filtered list are positions in that filter, not in the
   * full order, so they're mapped back: the subset's slots in the master order
   * stay put and the ids are rewritten into them. Reordering Shopping can't
   * disturb where Health sits.
   */
  const reorderTrackers = useCallback((from, to, subsetIds) => {
    if (from === to) return;

    const ids = allRef.current.map((t) => t.id);
    const subset = subsetIds?.length ? subsetIds : ids;
    if (from < 0 || to < 0 || to >= subset.length) return;

    const reordered = [...subset];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);

    const slots = ids
      .map((id, index) => (subset.includes(id) ? index : -1))
      .filter((index) => index !== -1);

    const next = [...ids];
    slots.forEach((slot, i) => {
      next[slot] = reordered[i];
    });

    setOrder(next);
    saveTrackerOrder(next);
  }, []);

  const reorderItemsIn = useCallback(
    (tracker, from, to) => {
      const items = [...(tracker.items || [])];
      if (from === to || from < 0 || to < 0 || to >= items.length) {
        return Promise.resolve();
      }

      const [moved] = items.splice(from, 1);
      items.splice(to, 0, moved);

      if (tracker.shared) return remote.reorderItems(tracker.remoteId, items);
      updateTracker(tracker.id, { items });
      return Promise.resolve();
    },
    [updateTracker]
  );

  const renameTracker = useCallback(
    (tracker, name, category) => {
      const trimmed = (name ?? '').trim();
      const nextName = trimmed || tracker.name;
      const nameChanged = nextName !== tracker.name;
      const categoryChanged = category && category !== tracker.category;
      if (!nameChanged && !categoryChanged) return Promise.resolve();

      // Category is personal shelving, so it stays local even for a shared
      // list — you and your wife can file the same list differently.
      if (categoryChanged) setTrackerCategory(tracker.id, category);

      if (!nameChanged) return Promise.resolve();
      if (tracker.shared) return remote.renameList(tracker.remoteId, nextName);
      updateTracker(tracker.id, { name: nextName });
      return Promise.resolve();
    },
    [updateTracker]
  );

  // ---- Sharing ------------------------------------------------------------

  // Publish a local list and hand back the id it will appear under.
  //
  // The local copy is deliberately NOT deleted here. Deleting it unmounts
  // whatever screen is showing it — taking the still-open share sheet with it,
  // which on Android leaves a black window. The caller drops it via
  // finalizeShare once the sheet is closed.
  const shareTracker = useCallback(
    (tracker) => {
      if (!uid) throw new Error('Sign in to share a list.');
      if (tracker.shared) {
        return { remoteId: tracker.remoteId, trackerId: tracker.id };
      }

      const { listId, settled } = remote.shareList(tracker, uid);
      // Surface a genuine rejection (permissions, say) rather than letting it
      // become an unhandled promise. A pending write offline is not an error.
      settled.catch((err) =>
        console.log('[trackers] share writes failed:', err?.message || err)
      );

      return { remoteId: listId, trackerId: remoteKey(listId) };
    },
    [uid]
  );

  // Drop the now-duplicated local copy. Safe to call more than once.
  const finalizeShare = useCallback(
    (localId) => {
      if (!localId || localId.startsWith('remote:')) return;
      deleteLocalTracker(localId);
    },
    [deleteLocalTracker]
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
    updateTrackerFields,
    deleteTracker,
    getTracker,
    addItemTo,
    toggleItemIn,
    updateItemIn,
    removeItemFrom,
    clearDoneIn,
    renameTracker,
    reorderTrackers,
    reorderItemsIn,
    shareTracker,
    finalizeShare,
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
