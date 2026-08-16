import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import theme from '../theme/themes';
import VibeInput from '../components/ui/VibeInput';
import VibeButton from '../components/ui/VibeButton';
import VibeAlert from '../components/ui/VibeAlert';
import ScreenHeader from '../components/ScreenHeader';
import { useTrackers } from '../store/TrackerContext';
import { newId } from '../lib/trackers';
import { resolveColor } from '../lib/format';

export default function ListDetailScreen({ tracker, onBack }) {
  const { updateTracker, deleteTracker } = useTrackers();
  const [text, setText] = useState('');

  const color = resolveColor(tracker.color);
  const items = tracker.items || [];
  const doneCount = items.filter((i) => i.done).length;

  const addItem = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const item = { id: newId(), text: trimmed, done: false };
    updateTracker(tracker.id, (t) => ({ items: [...t.items, item] }));
    setText('');
  }, [text, tracker.id, updateTracker]);

  const toggle = useCallback(
    (itemId) => {
      updateTracker(tracker.id, (t) => ({
        items: t.items.map((i) =>
          i.id === itemId ? { ...i, done: !i.done } : i
        ),
      }));
    },
    [tracker.id, updateTracker]
  );

  const removeItem = useCallback(
    (itemId) => {
      updateTracker(tracker.id, (t) => ({
        items: t.items.filter((i) => i.id !== itemId),
      }));
    },
    [tracker.id, updateTracker]
  );

  const clearDone = useCallback(() => {
    updateTracker(tracker.id, (t) => ({
      items: t.items.filter((i) => !i.done),
    }));
  }, [tracker.id, updateTracker]);

  const confirmDelete = useCallback(() => {
    VibeAlert('Delete tracker', `Delete "${tracker.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { onBack(); deleteTracker(tracker.id); } },
    ]);
  }, [tracker.id, tracker.name, deleteTracker, onBack]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScreenHeader
        title={tracker.name}
        color={color}
        onBack={onBack}
        onDelete={confirmDelete}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <View style={styles.addRow}>
          <VibeInput
            placeholder="Add an item…"
            value={text}
            onChangeText={setText}
            onSubmitEditing={addItem}
            returnKeyType="done"
            blurOnSubmit={false}
            maxLength={80}
            style={styles.input}
          />
          <VibeButton
            label="Add"
            variant="green"
            onPress={addItem}
            disabled={text.trim().length === 0}
            style={styles.addBtn}
          />
        </View>

        <ScrollView
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {items.length === 0 && (
            <Text style={styles.empty}>Nothing here yet.</Text>
          )}

          {items.map((item) => (
            <View key={item.id} style={styles.item}>
              <Pressable
                onPress={() => toggle(item.id)}
                style={styles.itemMain}
                hitSlop={4}
              >
                <View
                  style={[
                    styles.checkbox,
                    { borderColor: color },
                    item.done && { backgroundColor: color },
                  ]}
                >
                  {item.done && <Text style={styles.check}>✓</Text>}
                </View>
                <Text
                  style={[styles.itemText, item.done && styles.itemTextDone]}
                >
                  {item.text}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => removeItem(item.id)}
                hitSlop={8}
                style={styles.remove}
              >
                <Text style={styles.removeX}>✕</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>

        {doneCount > 0 && (
          <View style={styles.footer}>
            <Pressable onPress={clearDone} hitSlop={8}>
              <Text style={styles.clearDone}>Clear {doneCount} completed</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 10,
  },
  input: { flex: 1 },
  addBtn: { marginVertical: 0 },
  list: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    flexGrow: 1,
  },
  empty: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 60,
    fontFamily: theme.fonts.main,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: theme.sizes.borderRadius,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  itemMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    color: theme.colors.black,
    fontSize: 15,
    fontWeight: '900',
  },
  itemText: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: theme.fonts.main,
  },
  itemTextDone: {
    color: theme.colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  remove: {
    paddingLeft: 12,
  },
  removeX: {
    color: theme.colors.textSecondary,
    fontSize: 18,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    paddingTop: 4,
    alignItems: 'center',
  },
  clearDone: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    textDecorationLine: 'underline',
    fontFamily: theme.fonts.main,
  },
});
