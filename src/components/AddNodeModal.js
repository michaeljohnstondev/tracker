import React, { useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView } from 'react-native';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import VibeInput from './ui/VibeInput';
import VibeButton from './ui/VibeButton';
import { NODE_COLORS } from '../lib/nodes';
import { resolveColor } from '../lib/format';
import { useKeyboardHeight } from '../lib/useKeyboardHeight';

// Adding anything at all. There is only one kind of thing now, so this asks
// for a name and a colour and nothing else — whether it ends up holding a
// timer, a list of children or a reminder is decided afterwards, on the thing
// itself.
export default function AddNodeModal({ visible, onClose, onCreate }) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [name, setName] = useState('');
  const [color, setColor] = useState(NODE_COLORS[0]);
  const [kind, setKind] = useState('item');
  const keyboardHeight = useKeyboardHeight();

  const reset = () => {
    setName('');
    setColor(NODE_COLORS[0]);
    setKind('item');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate({ name: trimmed, color, kind });
    reset();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: 34 + keyboardHeight }]}
          onPress={(e) => e.stopPropagation()}
        >
          <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
            <Text style={styles.title}>Add</Text>

            <Text style={styles.label}>Name</Text>
            <VibeInput
              placeholder="Name"
              value={name}
              onChangeText={setName}
              autoFocus
              maxLength={60}
              autoCapitalize="sentences"
              onSubmitEditing={handleCreate}
              returnKeyType="done"
            />

            <Text style={styles.label}>What is it</Text>
            <View style={styles.chips}>
              <VibeButton
                label="✓ Item"
                variant="toggle"
                color={kind === 'item' ? 'green' : 'gray'}
                onPress={() => setKind('item')}
                style={styles.chip}
              />
              <VibeButton
                label="🗂 Category"
                variant="toggle"
                color={kind === 'category' ? 'green' : 'gray'}
                onPress={() => setKind('category')}
                style={styles.chip}
              />
            </View>
            <Text style={styles.label}>Color</Text>
            <View style={styles.colors}>
              {NODE_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  style={[
                    styles.swatch,
                    { backgroundColor: resolveColor(c, theme) },
                    c === color && styles.swatchSelected,
                  ]}
                />
              ))}
            </View>

            <View style={styles.actions}>
              <VibeButton
                label="Create"
                variant="green"
                onPress={handleCreate}
                disabled={name.trim().length === 0}
              />
              <Pressable onPress={handleClose} hitSlop={8}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
            </View>
          </ScrollView>
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
    maxHeight: '88%',
  },
  title: {
    color: t.colors.vibeCyan,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: t.fonts.main,
    marginBottom: 8,
  },
  label: {
    color: t.colors.textSecondary,
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
    fontFamily: t.fonts.main,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14 },
  colors: { flexDirection: 'row', gap: 12 },
  swatch: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  // Border only, no scale. Scaling pushed the selected swatch outside its own
  // box, and the first one in the row had its ring clipped by the sheet edge.
  swatchSelected: {
    borderColor: t.colors.white,
  },
  actions: { marginTop: 26, alignItems: 'stretch' },
  cancel: {
    color: t.colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 6,
    fontFamily: t.fonts.main,
  },
});
