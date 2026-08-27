import React, { useState, useCallback, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  Share,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import VibeButton from './ui/VibeButton';
import VibeAlert from './ui/VibeAlert';
import { useAuth } from '../store/AuthContext';
import { useNodes } from '../store/NodeContext';
import VibeInput from './ui/VibeInput';
import { createInvite, shareWithEmail } from '../services/nodes';
import { ensurePushPermission } from '../services/fcm';

// Sign in, publish, hand over a code — one flow, one sheet. Splitting them
// into separate screens would make a two-tap job feel like a setup wizard.
export default function ShareNodeModal({ visible, node, onClose, onPublished }) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { user, signIn, busy } = useAuth();
  const { shareNode } = useNodes();

  const [working, setWorking] = useState(false);
  const [code, setCode] = useState(null);
  // Set once this sheet publishes. The `node` prop still points at the local
  // copy at that moment — the shared one only exists once the subscription
  // delivers it — so the sheet tracks the new id itself.
  const [publishedRoot, setPublishedRoot] = useState(null);
  const [email, setEmail] = useState('');
  const [invited, setInvited] = useState(null);

  useEffect(() => {
    if (!visible) {
      setCode(null);
      setPublishedRoot(null);
      setEmail('');
      setInvited(null);
    }
  }, [visible]);

  const isShared = !!node?.shared || !!publishedRoot;
  const rootId = node?.rootId ?? publishedRoot;

  const handleSignIn = useCallback(async () => {
    try {
      await signIn();
    } catch (e) {
      VibeAlert('Sign-in failed', e?.message ?? 'Please try again.', [], 'error');
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
      VibeAlert('Could not share', e?.message ?? 'Please try again.', [], 'error');
    }
  }, [shareNode, node, user, onPublished]);

  const handleEmailInvite = useCallback(async () => {
    if (!rootId || !user?.uid) {
      VibeAlert('Not shared yet', 'Share this first, then invite someone.');
      return;
    }
    setWorking(true);
    try {
      await shareWithEmail({
        rootId,
        email,
        fromUid: user.uid,
        treeName: node?.name ?? '',
      });
      setInvited(email.trim());
      setEmail('');
    } catch (e) {
      VibeAlert('Could not invite', e?.message ?? 'Please try again.', [], 'error');
    } finally {
      setWorking(false);
    }
  }, [email, rootId, user, node]);

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
      VibeAlert('Could not create invite', e?.message ?? 'Please try again.', [], 'error');
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
        {/* The sheet sits on the bottom edge, which is exactly where the
            keyboard opens — without this the email field is typed into blind. */}
        <KeyboardAvoidingView behavior="padding">
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
                {invited
                  ? `Sent to ${invited}. It’ll appear in their Tracker as soon ` +
                    `as they sign in with that address — no code to type.`
                  : 'Invite someone by their email address. It just shows up ' +
                    'in their app.'}
              </Text>

              <VibeInput
                placeholder="their@email.com"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (invited) setInvited(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                style={styles.email}
                onSubmitEditing={handleEmailInvite}
                returnKeyType="send"
              />

              <View style={styles.actions}>
                <VibeButton
                  label="Send invite"
                  variant="green"
                  onPress={handleEmailInvite}
                  disabled={spinner || !email.trim()}
                />
              </View>

              {/* Still here for anyone whose address you don't have — read out
                  over the phone, or sent however you like. */}
              {code ? (
                <>
                  <Text style={styles.code}>{code}</Text>
                  <Pressable onPress={handleInvite} hitSlop={8} disabled={spinner}>
                    <Text style={styles.link}>Send code again</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable onPress={handleInvite} hitSlop={8} disabled={spinner}>
                  <Text style={styles.link}>Or use an invite code</Text>
                </Pressable>
              )}
            </>
          )}

          {spinner && (
            <ActivityIndicator color={theme.colors.vibeCyan} style={styles.spinner} />
          )}

          <Pressable onPress={handleClose} hitSlop={8}>
            <Text style={styles.cancel}>Done</Text>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (t) => ({
  overlay: { flex: 1, backgroundColor: t.semantic.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: t.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: t.colors.inputBorder,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 34,
  },
  title: {
    color: t.colors.vibeCyan,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: t.fonts.main,
    marginBottom: 12,
  },
  body: {
    color: t.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: t.fonts.main,
  },
  code: {
    color: t.colors.textPrimary,
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
    marginTop: 20,
    fontVariant: ['tabular-nums'],
    fontFamily: t.fonts.main,
  },
  email: { marginTop: 18 },
  link: {
    color: t.colors.vibeCyan,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
    fontFamily: t.fonts.main,
  },
  actions: { marginTop: 22, alignItems: 'stretch' },
  spinner: { marginTop: 14 },
  cancel: {
    color: t.colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 14,
    fontFamily: t.fonts.main,
  },
});
