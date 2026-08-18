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
import { useNodes } from '../store/NodeContext';
import { createInvite } from '../services/nodes';
import { ensurePushPermission } from '../services/fcm';

// Sign in, publish, hand over a code — one flow, one sheet. Splitting them
// into separate screens would make a two-tap job feel like a setup wizard.
export default function ShareNodeModal({ visible, node, onClose, onPublished }) {
  const { user, signIn, busy } = useAuth();
  const { shareNode } = useNodes();

  const [working, setWorking] = useState(false);
  const [code, setCode] = useState(null);
  // Set once this sheet publishes. The `node` prop still points at the local
  // copy at that moment — the shared one only exists once the subscription
  // delivers it — so the sheet tracks the new id itself.
  const [publishedRoot, setPublishedRoot] = useState(null);

  useEffect(() => {
    if (!visible) {
      setCode(null);
      setPublishedRoot(null);
    }
  }, [visible]);

  const isShared = !!node?.shared || !!publishedRoot;
  const rootId = node?.rootId ?? publishedRoot;

  const handleSignIn = useCallback(async () => {
    try {
      await signIn();
    } catch (e) {
      VibeAlert('Sign-in failed', e?.message ?? 'Please try again.');
    }
  }, [signIn]);

  const handlePublish = useCallback(() => {
    if (!node) return;
    try {
      // Returns immediately — the writes go to Firestore's queue rather than
      // being awaited, so this works offline and can't hang the sheet.
      const { rootId: newRoot } = shareNode(node);
      setPublishedRoot(newRoot);
      // Tell the screen straight away rather than waiting for this sheet to
      // close: the local copy is removed as soon as the upload is confirmed,
      // and the screen underneath has to have moved on by then.
      onPublished?.(newRoot);
      // A justified moment to ask: from here on someone else can change this,
      // which is exactly what a notification would tell you about.
      ensurePushPermission(user?.uid);
    } catch (e) {
      VibeAlert('Could not share', e?.message ?? 'Please try again.');
    }
  }, [shareNode, node, user, onPublished]);

  const handleInvite = useCallback(async () => {
    // Belt and braces: without a root there's nothing to invite anyone to, and
    // addressing a document by an undefined id throws rather than failing
    // quietly.
    if (!rootId || !user?.uid) {
      VibeAlert('Not shared yet', 'Share this first, then create a code.');
      return;
    }
    setWorking(true);
    try {
      const generated = await createInvite(rootId, user.uid);
      setCode(generated);
      await Share.share({
        message:
          `Join my "${node.name}" on Tracker.\n\n` +
          `Invite code: ${generated}\n\n` +
          `Open Tracker, tap "Join with code" and enter it.`,
      });
    } catch (e) {
      VibeAlert('Could not create invite', e?.message ?? 'Please try again.');
    } finally {
      setWorking(false);
    }
  }, [node, rootId, user]);

  // Hand the new root back on the way out, so the screen underneath can swap
  // to the shared copy and drop the local one — after this sheet has gone,
  // never while it's on screen. Unmounting a visible modal leaves a black
  // window on Android.
  const handleClose = useCallback(() => {
    onClose(publishedRoot ? { rootId: publishedRoot, localId: node?.id } : null);
  }, [onClose, publishedRoot, node]);

  const spinner = working || busy;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Share “{node?.name}”</Text>

          {!user && (
            <>
              <Text style={styles.body}>
                Sharing needs an account so this can sync between phones.
                Everything else stays on your device either way.
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
                This lives only on this phone. Sharing uploads it — and
                everything inside it — so someone else can see and edit it in
                real time.
              </Text>
              <View style={styles.actions}>
                <VibeButton
                  label="Share this"
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
                  : 'This is shared. Create a code to invite someone.'}
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
            <ActivityIndicator color={theme.colors.vibeCyan} style={styles.spinner} />
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
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
  actions: { marginTop: 22, alignItems: 'stretch' },
  spinner: { marginTop: 14 },
  cancel: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 14,
    fontFamily: theme.fonts.main,
  },
});
