import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signOut,
} from '@react-native-firebase/auth';
import { doc, setDoc, serverTimestamp } from '@react-native-firebase/firestore';
import { auth, db, WEB_CLIENT_ID } from '../services/firebase';
import { registerPushToken, unregisterPushToken } from '../services/fcm';

// Configure once at module load rather than per sign-in attempt.
GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Distinguishes "not signed in" from "haven't checked yet" — without it the
  // UI flashes a sign-in prompt on every cold start before auth restores.
  const [initializing, setInitializing] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setInitializing(false);
      // Re-register on every restore, not just at sign-in: FCM rotates tokens
      // and a stale one fails silently, which looks exactly like "push is
      // broken". The OS only prompts the first time, so this is quiet after.
      if (u) registerPushToken(u.uid);
    });
    return unsub;
  }, []);

  const signIn = useCallback(async () => {
    setBusy(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();

      // google-signin v13+ returns { type: 'success' | 'cancelled', data }.
      // Older shapes put idToken at the top level; accept either so a version
      // bump doesn't silently break sign-in.
      const idToken = result?.data?.idToken ?? result?.idToken ?? null;
      if (!idToken) return null; // cancelled — not an error worth surfacing

      const credential = GoogleAuthProvider.credential(idToken);
      const { user: signedIn } = await signInWithCredential(auth, credential);

      // Mirror the profile into Firestore so co-members of a list can see who
      // added or ticked off an item. Merged, so a later sign-in doesn't wipe
      // fields we might add here in future.
      await setDoc(
        doc(db, 'users', signedIn.uid),
        {
          displayName: signedIn.displayName ?? null,
          email: signedIn.email ?? null,
          photoURL: signedIn.photoURL ?? null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      return signedIn;
    } finally {
      setBusy(false);
    }
  }, []);

  const signOutCompletely = useCallback(async () => {
    // Drop the token first — once signed out the rules no longer permit
    // writing to this user's private doc, and the token would be stranded,
    // still receiving their notifications on this device.
    await unregisterPushToken(auth.currentUser?.uid);
    await signOut(auth);
    // Also clear the Google session, otherwise the next sign-in silently
    // reuses the same account with no account picker — confusing on a shared
    // device, and impossible to switch away from.
    try {
      await GoogleSignin.signOut();
    } catch {
      // Already signed out of Google; nothing to undo.
    }
  }, []);

  const value = {
    user,
    uid: user?.uid ?? null,
    initializing,
    busy,
    signIn,
    signOut: signOutCompletely,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
