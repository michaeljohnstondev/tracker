import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore } from '@react-native-firebase/firestore';

// Deliberately the *native* Firebase modules rather than the pure-JS SDK the
// other apps use. Only the native ones have real offline persistence in React
// Native (the JS SDK's cache needs IndexedDB, which RN doesn't have), and
// offline is the whole point here — a grocery list has to work in a shop with
// no signal, then reconcile later.
//
// There's no config object: connection details come from google-services.json
// at build time.
const app = getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);

// The OAuth "web" client Firebase minted for this project once the signing
// SHA-1 was registered. Google Sign-In needs it to hand back an idToken that
// Firebase Auth will accept — the Android client id alone won't do.
export const WEB_CLIENT_ID =
  '376549810751-4p0a4f03arjiqjfr1mj9icrl0oahcebc.apps.googleusercontent.com';
