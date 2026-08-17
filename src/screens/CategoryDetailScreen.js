import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import theme from '../theme/themes';
import VibeButton from '../components/ui/VibeButton';
import VibeAlert from '../components/ui/VibeAlert';
import TrackerList from '../components/TrackerList';
import AddTrackerModal from '../components/AddTrackerModal';
import ScreenHeader from '../components/ScreenHeader';
import RenameModal from '../components/RenameModal';
import MoveTrackerModal from '../components/MoveTrackerModal';
import VibeInput from '../components/ui/VibeInput';
import { useTrackers } from '../store/TrackerContext';
import { resolveColor } from '../lib/format';

// The inside of a category: the trackers filed within it.
//
// Deliberately the same shape as the home screen — same cards, same
// drag-to-reorder — because a category is just another place trackers live,
// not a different kind of screen.
export default function CategoryDetailScreen({ tracker, onBack, onOpen }) {
  const {
    trackers,
    addTracker,
    setTrackerParent,
    renameTracker,
    deleteTracker,
    reorderTrackers,
    addItemTo,
    toggleItemIn,
    removeItemFrom,
  } = useTrackers();
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [moving, setMoving] = useState(null);
  const [text, setText] = useState('');

  // A category can hold loose items as well as trackers — a "Do Daily" folder
  // wants a couple of one-off tasks in it without each becoming its own list.
  const items = tracker.items || [];

  const addItem = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    addItemTo(tracker, trimmed);
  }, [text, tracker, addItemTo]);

  const color = resolveColor(tracker.color);

  const children = useMemo(
    () => trackers.filter((t) => t.parentId === tracker.id),
    [trackers, tracker.id]
  );

  // Anything created here belongs here — that's the whole reason to be on
  // this screen rather than the home one.
  const handleCreate = useCallback(
    (created) => {
      addTracker(created);
      setTrackerParent(created.id, tracker.id);
      setAdding(false);
      onOpen(created.id);
    },
    [addTracker, setTrackerParent, tracker.id, onOpen]
  );

  const confirmDelete = useCallback(() => {
    VibeAlert(
      'Delete category',
      children.length
        ? `Delete "${tracker.name}"? The ${children.length} tracker${
            children.length === 1 ? '' : 's'
          } inside will move up a level, not be deleted.`
        : `Delete "${tracker.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onBack();
            deleteTracker(tracker);
          },
        },
      ]
    );
  }, [tracker, children.length, deleteTracker, onBack]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScreenHeader
        title={tracker.name}
        color={color}
        onBack={onBack}
        onRename={() => setRenaming(true)}
        onDelete={confirmDelete}
      />

      <TrackerList
        data={children}
        onOpen={onOpen}
        onHold={setMoving}
        // Indices are positions among this category's children, so the ids go
        // along for mapping back onto the full order.
        onReorder={(from, to) =>
          reorderTrackers(from, to, children.map((t) => t.id))
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Nothing in here yet.{'\n'}Add a tracker below, or tick things into
            this category from its ✎ edit sheet.
          </Text>
        }
        // Items live below the trackers rather than in the reorderable list,
        // which can only hold one kind of thing. They're not draggable as a
        // result — for an ordered list of many items, a list tracker is still
        // the right tool.
        ListFooterComponent={
          <View style={styles.itemsSection}>
            <Text style={styles.itemsLabel}>Items</Text>

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

            {items.map((item) => (
              <View key={item.id} style={styles.item}>
                <Pressable
                  onPress={() => toggleItemIn(tracker, item.id)}
                  hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                  style={[
                    styles.checkbox,
                    { borderColor: color },
                    item.done && { backgroundColor: color },
                  ]}
                >
                  {item.done ? <Text style={styles.check}>✓</Text> : null}
                </Pressable>
                <Text
                  style={[styles.itemText, item.done && styles.itemTextDone]}
                >
                  {item.text}
                </Text>
                <Pressable
                  onPress={() => removeItemFrom(tracker, item.id)}
                  hitSlop={8}
                >
                  <Text style={styles.removeX}>✕</Text>
                </Pressable>
              </View>
            ))}
          </View>
        }
      />

      <View style={styles.footer}>
        <VibeButton label="+ Add Tracker" onPress={() => setAdding(true)} />
      </View>

      <AddTrackerModal
        visible={adding}
        onClose={() => setAdding(false)}
        onCreate={handleCreate}
      />

      <RenameModal
        visible={renaming}
        tracker={tracker}
        initialName={tracker.name}
        initialParentId={tracker.parentId}
        onClose={() => setRenaming(false)}
        onSubmit={(name, parentId) => renameTracker(tracker, name, parentId)}
      />

      <MoveTrackerModal
        visible={!!moving}
        tracker={moving}
        onClose={() => setMoving(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  list: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    flexGrow: 1,
  },
  empty: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 60,
    lineHeight: 24,
    fontFamily: theme.fonts.main,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  itemsSection: {
    marginTop: 18,
  },
  itemsLabel: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10,
    fontFamily: theme.fonts.main,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  input: { flex: 1 },
  addBtn: { marginVertical: 0 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: theme.sizes.borderRadius,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    color: theme.colors.black,
    fontSize: 14,
    fontWeight: '900',
  },
  itemText: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontFamily: theme.fonts.main,
  },
  itemTextDone: {
    color: theme.colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  removeX: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    paddingLeft: 10,
  },
});
