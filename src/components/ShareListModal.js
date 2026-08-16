import React, { useState, useCallback, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Share,
  ActivityIndicator,
} from 'react-native';
import theme from '../theme/themes';
import VibeButton from './ui/VibeButton';
import VibeAlert from './ui/VibeAlert';
import { useAuth } from '../store/AuthContext';
import { useTrackers } from '../store/TrackerContext';
import { createInvite } from '../services/lists';
import { ensurePushPermission } from '../services/fcm';

// Three states in one sheet, because they're really one flow: sign in ->
// publish the list -> hand someone a code. Showing them as separate screens
// would make a two-tap job feel like a setup wizard.
export default function ShareListModal({ visible, tracker, onClose }) {
  const { user, signIn, busy } = useAuth();
  const { shareTracker } = useTrackers();

  const [working, setWorking] = useState(false);
  const [code, setCode] = useState(null);
  // Set once this sheet publishes the list. The `tracker` prop still points at
  // the local copy at that moment — the shared one only exists after the
  // subscription delivers it — so the sheet tracks the new id itself rather
  // than waiting for a prop that would arrive a render or two later.
  const [publishedId, setPublishedId] = useState(null);

  // A code belongs to one sharing session; don't leak it across opens.
  useEffect(() => {
    if (!visible) {
      setCode(null);
      setPublishedId(null);
    }
  }, [visible]);

  const isShared = !!tracker?.shared || !!publishedId;
  const remoteId = tracker?.remoteId ?? publishedId;

  const handleSignIn = useCallback(async () => {
    try {
      await signIn();
    } catch (e) {
      VibeAlert('Sign-in failed', e?.message ?? 'Please try again.');
    }
  }, [signIn]);

  const handlePublish = useCallback(() => {
    try {
      // Returns immediately — the writes go to Firestore's queue rather than
      // being awaited, so this works offline and can't hang the sheet.
      const { remoteId: newId } = shareTracker(tracker);
      setPublishedId(newId);
      // A justified moment to ask: from here on, someone else can change this
      // list, which is precisely what a notification would tell you about.
      ensurePushPermission(user?.uid);
    } catch (e) {
      VibeAlert('Could not share', e?.message ?? 'Please try again.');
    }
  }, [shareTracker, tracker, user]);

  const handleInvite = useCallback(async () => {
    setWorking(true);
    try {
      const generated = await createInvite(remoteId, user.uid);
      setCode(generated);
      await Share.share({
        message:
          `Join my "${tracker.name}" list on Tracker.\n\n` +
          `Invite code: ${generated}\n\n` +
          `Open Tracker, tap "Join with code" and enter it.`,
      });
    } catch (e) {
      VibeAlert('Could not create invite', e?.message ?? 'Please try again.');
    } finally {
      setWorking(false);
    }
  }, [tracker, remoteId, user]);

  // Hand the newly-published id back on the way out, so the screen underneath
  // can switch to the shared list and drop the local copy — after this sheet
  // is gone, never while it's on screen.
  const handleClose = useCallback(() => {
    onClose(publishedId ? { publishedId, localId: tracker?.id } : null);
  }, [onClose, publishedId, tracker]);

  const spinner = working || busy;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Share “{tracker?.name}”</Text>

          {!user && (
            <>
              <Text style={styles.body}>
                Sharing needs an account so the list can sync between phones.
                Your existing trackers stay on this device either way.
              </Text>
              <View style={styles.actions}>
                <VibeButton
                  label="Sign in with Google"
                  variant="green"
                  onPress={handleSignIn}
                  disabled={spinner}
                />
              </View>
            </>
          )}

          {user && !isShared && (
            <>
              <Text style={styles.body}>
                This list lives only on this phone. Sharing uploads it so
                someone else can see and edit it in real time.
              </Text>
              <View style={styles.actions}>
                <VibeButton
                  label="Share this list"
                  variant="green"
                  onPress={handlePublish}
                  disabled={spinner}
                />
              </View>
            </>
          )}

          {user && isShared && (
            <>
              <Text style={styles.body}>
                {code
                  ? 'Give them this code — it works once they enter it in Tracker.'
                  : 'This list is shared. Create a code to invite someone.'}
              </Text>

              {code && <Text style={styles.code}>{code}</Text>}

              <View style={styles.actions}>
                <VibeButton
                  label={code ? 'Send code again' : 'Create invite code'}
                  variant="green"
                  onPress={handleInvite}
                  disabled={spinner}
                />
              </View>
            </>
          )}

          {spinner && (
            <ActivityIndicator
              color={theme.colors.vibeCyan}
              style={styles.spinner}
            />
          )}

          <Pressable onPress={handleClose} hitSlop={8}>
            <Text style={styles.cancel}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: theme.colors.inputBorder,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 34,
  },
  title: {
    color: theme.colors.vibeCyan,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: theme.fonts.main,
    marginBottom: 12,
  },
  body: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: theme.fonts.main,
  },
  code: {
    color: theme.colors.textPrimary,
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
    marginTop: 20,
    fontVariant: ['tabular-nums'],
    fontFamily: theme.fonts.main,
  },
  actions: {
    marginTop: 22,
    alignItems: 'stretch',
  },
  spinner: {
    marginTop: 14,
  },
  cancel: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 14,
    fontFamily: theme.fonts.main,
  },
});
