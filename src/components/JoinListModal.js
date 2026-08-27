import React, { useState, useCallback, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { useKeyboardHeight } from '../lib/useKeyboardHeight';
import VibeInput from './ui/VibeInput';
import VibeButton from './ui/VibeButton';
import VibeAlert from './ui/VibeAlert';
import { useAuth } from '../store/AuthContext';
import { redeemInvite } from '../services/nodes';
import { ensurePushPermission } from '../services/fcm';

// Redeem an invite code. On success the list arrives on its own via the
// membership subscription, so there's nothing to hand back to the caller.
export default function JoinListModal({ visible, onClose }) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { user, signIn, busy } = useAuth();
  const [code, setCode] = useState('');
  const [working, setWorking] = useState(false);
  const keyboardHeight = useKeyboardHeight();

  useEffect(() => {
    if (!visible) setCode('');
  }, [visible]);

  const handleSignIn = useCallback(async () => {
    try {
      await signIn();
    } catch (e) {
      VibeAlert('Sign-in failed', e?.message ?? 'Please try again.', [], 'error');
    }
  }, [signIn]);

  const handleJoin = useCallback(async () => {
    setWorking(true);
    try {
      await redeemInvite(code, user.uid);
      // Joining someone else's list is the clearest signal yet that changes
      // by other people are worth being told about.
      ensurePushPermission(user.uid);
      onClose();
    } catch (e) {
      VibeAlert(
        'Could not join',
        e?.message ?? 'Check the code and try again.',
        [],
        'error'
      );
    } finally {
      setWorking(false);
    }
  }, [code, user, onClose]);

  const spinner = working || busy;
  const canJoin = code.trim().length >= 4 && !spinner;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: 34 + keyboardHeight }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.title}>Join a list</Text>

            {!user ? (
              <>
                <Text style={styles.body}>
                  Sign in first so the list can sync to this phone.
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
            ) : (
              <>
                <Text style={styles.body}>
                  Enter the code you were sent — or a list's own id, to get
                  back one of yours.
                </Text>
                <VibeInput
                  placeholder="ABC123"
                  value={code}
                  // Left exactly as typed. Codes are matched case-insensitively
                  // anyway, and forcing uppercase here made it impossible to
                  // enter a list id, which is lower case.
                  onChangeText={setCode}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={32}
                  autoFocus
                  onSubmitEditing={canJoin ? handleJoin : undefined}
                  returnKeyType="go"
                  style={styles.input}
                />
                <View style={styles.actions}>
                  <VibeButton
                    label="Join"
                    variant="green"
                    onPress={handleJoin}
                    disabled={!canJoin}
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

          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (t) => ({
  overlay: {
    flex: 1,
    backgroundColor: t.semantic.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: t.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: t.colors.inputBorder,
    paddingHorizontal: 24,
    paddingTop: 22,
    // paddingBottom is applied inline from the measured keyboard height.
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
  input: {
    marginTop: 16,
    textAlign: 'center',
    // Loose enough to read a six-character code back to someone, tight enough
    // that a full list id still fits on one line.
    letterSpacing: 3,
    fontSize: 20,
  },
  actions: {
    marginTop: 20,
    alignItems: 'stretch',
  },
  spinner: { marginTop: 14 },
  cancel: {
    color: t.colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 14,
    fontFamily: t.fonts.main,
  },
});
