import React, { useState, useEffect, useCallback } from 'react';
import { Modal, View, Text, Pressable } from 'react-native';
import { useThemedStyles } from '../theme/ThemeContext';
import VibeInput from './ui/VibeInput';
import VibeButton from './ui/VibeButton';
import { useKeyboardHeight } from '../lib/useKeyboardHeight';

// Renaming, and nothing else. Moving lives in the header menu, where it can be
// expressed relatively — out a level, or into something alongside — rather
// than as a picker listing everything in the app.
export default function RenameModal({ visible, initialName, onClose, onSubmit }) {
  const styles = useThemedStyles(makeStyles);
  const [name, setName] = useState(initialName ?? '');
  const keyboardHeight = useKeyboardHeight();

  // Re-seeded on open rather than on every prop change, so a rename arriving
  // from someone else's phone mid-edit doesn't yank the text out from under
  // you.
  useEffect(() => {
    if (visible) setName(initialName ?? '');
  }, [visible, initialName]);

  const save = useCallback(() => {
    onSubmit(name);
    onClose();
  }, [name, onSubmit, onClose]);

  const canSave = name.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: 34 + keyboardHeight }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.title}>Edit title</Text>

          <VibeInput
            value={name}
            onChangeText={setName}
            placeholder="Name"
            autoFocus
            selectTextOnFocus
            maxLength={60}
            autoCapitalize="sentences"
            onSubmitEditing={canSave ? save : undefined}
            returnKeyType="done"
          />

          <View style={styles.actions}>
            <VibeButton label="Save" variant="green" onPress={save} disabled={!canSave} />
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
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
  },
  title: {
    color: t.colors.vibeCyan,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: t.fonts.main,
    marginBottom: 14,
  },
  actions: { marginTop: 22, alignItems: 'stretch' },
  cancel: {
    color: t.colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    fontFamily: t.fonts.main,
  },
});
