import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';

// Checks for an EAS over-the-air update on launch, and again whenever the app
// returns to the foreground. An available update is downloaded silently, then
// `isUpdateReady` flips so the UI can offer a restart — applying it is always
// the user's choice, since yanking the bundle out from under someone
// mid-edit would lose whatever they were typing.
//
// Ported from the same hook in snapple-park so both apps behave identically.
export function useAppUpdate() {
  const [isUpdateReady, setIsUpdateReady] = useState(false);
  const checkingRef = useRef(false);

  // One full check -> fetch cycle. Guarded so concurrent triggers (mount and
  // a foreground event in the same instant) collapse into a single call.
  const checkAndFetch = useCallback(async () => {
    if (checkingRef.current) return;
    // Updates is disabled in dev and every call throws — skip cleanly so dev
    // sessions aren't noisy.
    if (!Updates.isEnabled || __DEV__) return;

    checkingRef.current = true;
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result?.isAvailable) {
        await Updates.fetchUpdateAsync();
        setIsUpdateReady(true);
      }
    } catch (err) {
      // Network blip, no update, or updates disabled — all non-fatal. The
      // next foreground transition retries.
      console.log('[useAppUpdate] check skipped:', err?.message || err);
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    checkAndFetch();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkAndFetch();
    });
    return () => sub.remove();
  }, [checkAndFetch]);

  const applyUpdate = useCallback(async () => {
    try {
      await Updates.reloadAsync();
    } catch (err) {
      console.error('[useAppUpdate] reload failed:', err);
    }
  }, []);

  return { isUpdateReady, applyUpdate };
}

export default useAppUpdate;
