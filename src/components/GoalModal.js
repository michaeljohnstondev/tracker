import React, { useState, useEffect, useCallback } from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import theme from '../theme/themes';
import VibeInput from './ui/VibeInput';
import VibeButton from './ui/VibeButton';
import VibeAlert from './ui/VibeAlert';
import { useKeyboardHeight } from '../lib/useKeyboardHeight';

// Type any goal length, because presets can't cover every use.
//
// The original presets were fasting lengths — 13 to 24 hours — which quietly
// made the app unable to express a 6-hour feeding window, or a 20-minute
// meditation. Hours are accepted as a decimal so "1.5" works without needing
// a separate minutes field.
export default function GoalModal({ visible, initialHours, onClose, onSubmit }) {
  const [text, setText] = useState('');
  const keyboardHeight = useKeyboardHeight();

  useEffect(() => {
    if (visible) setText(initialHours ? String(initialHours) : '');
  }, [visible, initialHours]);

  const save = useCallback(() => {
    const hours = parseFloat(text);
    if (!Number.isFinite(hours) || hours <= 0) {
      VibeAlert(
        'Invalid goal',
        'Enter a number of hours greater than 0.',
        [],
        'warning'
      );
      return;
    }
    if (hours > 168) {
      VibeAlert(
        'That is a long goal',
        'Enter something under a week (168 hours).',
        [],
        'warning'
      );
      return;
    }
    // Rounded to the minute, so 0.333 doesn't become an unreadable timestamp.
    onSubmit(Math.round(hours * 60) / 60);
    onClose();
  }, [text, onSubmit, onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: 34 + keyboardHeight }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.title}>Custom goal</Text>
          <Text style={styles.body}>
            How many hours? Decimals are fine — 0.5 is thirty minutes.
          </Text>

          <VibeInput
            value={text}
            onChangeText={(t) => setText(t.replace(/[^0-9.]/g, ''))}
            placeholder="6"
            keyboardType="decimal-pad"
            maxLength={6}
            autoFocus
            onSubmitEditing={save}
            returnKeyType="done"
            style={styles.input}
          />

          <View style={styles.actions}>
            <VibeButton label="Set goal" variant="green" onPress={save} />
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          </View>
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
  },
  title: {
    color: theme.colors.vibeCyan,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: theme.fonts.main,
    marginBottom: 8,
  },
  body: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 14,
    fontFamily: theme.fonts.main,
  },
  input: {
    textAlign: 'center',
    fontSize: 22,
  },
  actions: {
    marginTop: 22,
    alignItems: 'stretch',
  },
  cancel: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    fontFamily: theme.fonts.main,
  },
});
