import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import theme from '../theme/themes';
import VibeInput from './ui/VibeInput';
import VibeButton from './ui/VibeButton';
import { useKeyboardHeight } from '../lib/useKeyboardHeight';
import { useTrackers } from '../store/TrackerContext';
import { filingTargets } from '../lib/trackers';

// Edit sheet for a tracker's name and which category it sits in.
export default function RenameModal({
  visible,
  tracker,
  initialName,
  initialParentId,
  onClose,
  onSubmit,
}) {
  const { trackers } = useTrackers();
  const [name, setName] = useState(initialName ?? '');
  const [parentId, setParentId] = useState(initialParentId ?? null);
  const keyboardHeight = useKeyboardHeight();

  const categories = useMemo(
    () => (tracker ? filingTargets(trackers, tracker) : []),
    [trackers, tracker]
  );

  // Re-seed on open rather than on every prop change, so a rename landing from
  // someone else's phone mid-edit doesn't yank the text out from under you.
  useEffect(() => {
    if (visible) {
      setName(initialName ?? '');
      setParentId(initialParentId ?? null);
    }
  }, [visible, initialName, initialParentId]);

  const save = useCallback(() => {
    onSubmit(name, parentId);
    onClose();
  }, [name, parentId, onSubmit, onClose]);

  const canSave = name.trim().length > 0;

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
          <Text style={styles.title}>Edit tracker</Text>

          <VibeInput
            value={name}
            onChangeText={setName}
            placeholder="Name"
            autoFocus
            selectTextOnFocus
            maxLength={40}
            autoCapitalize="sentences"
            onSubmitEditing={canSave ? save : undefined}
            returnKeyType="done"
          />

          {/* Hidden until there's somewhere to file it. */}
          {categories.length > 0 && (
            <>
              <Text style={styles.label}>Category</Text>
              <View style={styles.chips}>
                <VibeButton
                  label="None"
                  variant="toggle"
                  color={parentId ? 'gray' : 'green'}
                  onPress={() => setParentId(null)}
                  style={styles.chip}
                />
                {categories.map((c) => (
                  <VibeButton
                    key={c.id}
                    label={c.name}
                    variant="toggle"
                    color={c.id === parentId ? 'green' : 'gray'}
                    onPress={() => setParentId(c.id)}
                    style={styles.chip}
                  />
                ))}
              </View>
            </>
          )}

          <View style={styles.actions}>
            <VibeButton
              label="Save"
              variant="green"
              onPress={save}
              disabled={!canSave}
            />
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
    marginBottom: 14,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
    fontFamily: theme.fonts.main,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
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
