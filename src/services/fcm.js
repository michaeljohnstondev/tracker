import { Platform } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import {
  getMessaging,
  getToken,
  deleteToken,
  requestPermission,
  hasPermission,
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

function isGranted(status) {
  return (
    status === AuthorizationStatus.AUTHORIZED ||
    status === AuthorizationStatus.PROVISIONAL
  );
}

/** Current permission, without ever showing the OS dialog. */
export async function hasPushPermission() {
  try {
    return isGranted(await hasPermission(messaging));
  } catch {
    return false;
  }
}

/** Shows the OS dialog if permission hasn't been decided yet. */
export async function requestPushPermission() {
  return isGranted(await requestPermission(messaging));
}

/**
 * Store this device's token against the user.
 *
 * Two paths on purpose. The silent one (the default) refreshes an existing
 * registration and never shows a dialog — FCM rotates tokens, and a stale one
 * fails silently in a way that looks exactly like "push is broken". The
 * prompting one is reserved for moments where the user has just done
 * something that implies they want notifying.
 *
 * Asking at cold start, before the user has done anything needing it, is the
 * reliable way to earn a permanent denial — and Android only offers the
 * dialog once. bvs-app's own fcmService carries the same warning.
 */
export async function registerPushToken(uid, { prompt = false } = {}) {
  if (!uid) return null;
  try {
    if (!(await hasPushPermission())) {
      if (!prompt) return null;
      if (!(await requestPushPermission())) return null;
    }

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

/**
 * Call at a moment that justifies the ask — setting a reminder, sharing a
 * list, joining one. Safe to call repeatedly: once permission exists this is
 * just a token refresh, and once refused Android won't re-prompt anyway.
 */
export function ensurePushPermission(uid) {
  return registerPushToken(uid, { prompt: true });
}

/** Foreground messages don't hit the tray; surface them via the callback. */
export function onForegroundMessage(handler) {
  return onMessage(messaging, handler);
}
