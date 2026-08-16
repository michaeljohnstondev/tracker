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
import ShareListModal from '../components/ShareListModal';
import { useTrackers } from '../store/TrackerContext';
import { resolveColor } from '../lib/format';

export default function ListDetailScreen({ tracker, onBack }) {
  // These operations dispatch to AsyncStorage or Firestore depending on
  // whether the list is shared — the screen doesn't need to know which.
  const { addItemTo, toggleItemIn, removeItemFrom, clearDoneIn, deleteTracker } =
    useTrackers();
  const [text, setText] = useState('');
  const [sharing, setSharing] = useState(false);

  const color = resolveColor(tracker.color);
  const items = tracker.items || [];
  const doneCount = items.filter((i) => i.done).length;

  const addItem = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    // Clear the field immediately rather than awaiting the write: on a shared
    // list that write may be queued offline, and the item still shows up
    // locally from Firestore's own cache.
    setText('');
    addItemTo(tracker, trimmed);
  }, [text, tracker, addItemTo]);

  const toggle = useCallback(
    (itemId) => toggleItemIn(tracker, itemId),
    [tracker, toggleItemIn]
  );

  const removeItem = useCallback(
    (itemId) => removeItemFrom(tracker, itemId),
    [tracker, removeItemFrom]
  );

  const clearDone = useCallback(() => clearDoneIn(tracker), [tracker, clearDoneIn]);

  const confirmDelete = useCallback(() => {
    // Leaving someone else's list is not the same as deleting it, and the
    // wording has to make that unmistakable before the tap.
    const leaving = tracker.shared && !tracker.isOwner;
    VibeAlert(
      leaving ? 'Leave list' : 'Delete tracker',
      leaving
        ? `Leave "${tracker.name}"? It stays on everyone else's phone.`
        : tracker.shared
          ? `Delete "${tracker.name}" for everyone sharing it?`
          : `Delete "${tracker.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: leaving ? 'Leave' : 'Delete',
          style: 'destructive',
          onPress: () => {
            onBack();
            deleteTracker(tracker);
          },
        },
      ]
    );
  }, [tracker, deleteTracker, onBack]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScreenHeader
        title={tracker.name}
        color={color}
        onBack={onBack}
        onShare={() => setSharing(true)}
        onDelete={confirmDelete}
      />

      {tracker.shared && (
        <Text style={styles.sharedNote}>
          Shared · changes sync live
        </Text>
      )}

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

      <ShareListModal
        visible={sharing}
        tracker={tracker}
        onClose={() => setSharing(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  sharedNote: {
    color: theme.colors.vibeCyan,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: -4,
    marginBottom: 4,
    fontFamily: theme.fonts.main,
  },
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
