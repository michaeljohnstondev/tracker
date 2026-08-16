import { Platform } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import {
  getMessaging,
  getToken,
  deleteToken,
  requestPermission,
  onMessage,
  setBackgroundMessageHandler,
  AuthorizationStatus,
  registerDeviceForRemoteMessages,
} from '@react-native-firebase/messaging';
import { doc, setDoc, deleteDoc } from '@react-native-firebase/firestore';
import { db } from './firebase';

// FCM via @react-native-firebase/messaging — the same transport as the other
// apps. Deliberately NOT expo-notifications, per the standing rule in
// snapple-park's fcmService.
//
// This is a trimmed version of that service: tracker has no in-app toast
// system and only one screen worth of routing, so there's no navigation
// dispatch here — tapping a notification just opens the app.
const messaging = getMessaging(getApp());

// Must be registered at module scope, before the app finishes starting, or
// pushes that arrive while the app is quit are dropped.
try {
  setBackgroundMessageHandler(messaging, async () => {
    // Nothing to do: these are notification messages, so the OS renders them
    // in the tray on its own. The handler only has to exist.
  });
} catch (err) {
  console.warn('[fcm] background handler registration failed:', err?.message);
}

// The push token lives in a private subcollection rather than on the profile
// doc, because profiles are readable by anyone you share a list with and a
// push token isn't theirs to see. Cloud Functions use the Admin SDK, which
// bypasses rules, so they can still read it.
const tokenRef = (uid) => doc(db, 'users', uid, 'private', 'push');

export async function requestPushPermission() {
  const status = await requestPermission(messaging);
  return (
    status === AuthorizationStatus.AUTHORIZED ||
    status === AuthorizationStatus.PROVISIONAL
  );
}

/**
 * Ask for permission, fetch the token, and store it against the user.
 * Returns the token, or null if permission was refused or unavailable.
 */
export async function registerPushToken(uid) {
  if (!uid) return null;
  try {
    const granted = await requestPushPermission();
    if (!granted) return null;

    if (Platform.OS === 'ios') {
      await registerDeviceForRemoteMessages(messaging);
    }

    const token = await getToken(messaging);
    if (!token) return null;

    await setDoc(
      tokenRef(uid),
      { token, platform: Platform.OS, updatedAt: Date.now() },
      { merge: true }
    );
    return token;
  } catch (err) {
    // Never let a push failure block sign-in — the app is fully usable
    // without notifications.
    console.log('[fcm] registerPushToken skipped:', err?.message || err);
    return null;
  }
}

/**
 * Drop the token on sign-out, so a device that signs out — or signs in as
 * someone else — stops receiving the previous account's notifications.
 */
export async function unregisterPushToken(uid) {
  if (!uid) return;
  try {
    await deleteDoc(tokenRef(uid));
    await deleteToken(messaging);
  } catch (err) {
    console.log('[fcm] unregisterPushToken skipped:', err?.message || err);
  }
}

/** Foreground messages don't hit the tray; surface them via the callback. */
export function onForegroundMessage(handler) {
  return onMessage(messaging, handler);
}
