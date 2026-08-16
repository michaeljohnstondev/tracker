import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

// Returns a `now` timestamp that ticks every second while `active`, and
// also refreshes whenever the app returns to the foreground (JS timers
// can be throttled in the background — since timers are computed from an
// absolute start time, a refresh on focus keeps everything accurate).
export function useNow(active) {
  const [now, setNow] = useState(Date.now());
  const intervalRef = useRef(null);

  useEffect(() => {
    const clear = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    if (active) {
      setNow(Date.now());
      intervalRef.current = setInterval(() => setNow(Date.now()), 1000);
    } else {
      clear();
    }
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setNow(Date.now());
    });
    return () => {
      clear();
      sub.remove();
    };
  }, [active]);

  return now;
}
