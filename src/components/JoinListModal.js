import React, { useState, useCallback, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import theme from '../theme/themes';
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
      VibeAlert('Sign-in failed', e?.message ?? 'Please try again.');
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
      VibeAlert('Could not join', e?.message ?? 'Check the code and try again.');
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
                  Enter the code you were sent.
                </Text>
                <VibeInput
                  placeholder="ABC123"
                  value={code}
                  // Codes are stored uppercase; normalising as they type avoids
                  // a "that code isn't valid" for a purely cosmetic mismatch.
                  onChangeText={(t) => setCode(t.toUpperCase())}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={8}
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
    // paddingBottom is applied inline from the measured keyboard height.
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
  input: {
    marginTop: 16,
    textAlign: 'center',
    letterSpacing: 6,
    fontSize: 22,
  },
  actions: {
    marginTop: 20,
    alignItems: 'stretch',
  },
  spinner: { marginTop: 14 },
  cancel: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 14,
    fontFamily: theme.fonts.main,
  },
});
