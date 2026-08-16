import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { loadTrackers, saveTrackers } from '../lib/trackers';

const TrackerContext = createContext(null);

export function TrackerProvider({ children }) {
  const [trackers, setTrackers] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Hold the latest array in a ref so mutations always compute from the
  // freshest state without needing it in every callback's deps.
  const ref = useRef([]);
  ref.current = trackers;

  useEffect(() => {
    (async () => {
      const initial = await loadTrackers();
      setTrackers(initial);
      setLoaded(true);
    })();
  }, []);

  // Every mutation goes through here: compute next array, set state, and
  // persist. Persistence is fire-and-forget — the in-memory state is the
  // source of truth for the UI.
  const commit = useCallback((next) => {
    setTrackers(next);
    ref.current = next;
    saveTrackers(next);
  }, []);

  const addTracker = useCallback(
    (tracker) => {
      commit([...ref.current, tracker]);
    },
    [commit]
  );

  const updateTracker = useCallback(
    (id, patch) => {
      const next = ref.current.map((t) =>
        t.id === id
          ? { ...t, ...(typeof patch === 'function' ? patch(t) : patch) }
          : t
      );
      commit(next);
    },
    [commit]
  );

  const deleteTracker = useCallback(
    (id) => {
      commit(ref.current.filter((t) => t.id !== id));
    },
    [commit]
  );

  const getTracker = useCallback(
    (id) => ref.current.find((t) => t.id === id) || null,
    []
  );

  const value = {
    trackers,
    loaded,
    addTracker,
    updateTracker,
    deleteTracker,
    getTracker,
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
