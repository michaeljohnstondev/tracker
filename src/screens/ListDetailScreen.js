import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReorderableList from 'react-native-reorderable-list';
import theme from '../theme/themes';
import VibeInput from '../components/ui/VibeInput';
import VibeButton from '../components/ui/VibeButton';
import VibeAlert from '../components/ui/VibeAlert';
import ScreenHeader from '../components/ScreenHeader';
import ShareListModal from '../components/ShareListModal';
import RenameModal from '../components/RenameModal';
import ListItemRow from '../components/ListItemRow';
import TrackerCard from '../components/TrackerCard';
import AddTrackerModal from '../components/AddTrackerModal';
import MoveTrackerModal from '../components/MoveTrackerModal';
import TrackerMenu from '../components/TrackerMenu';
import { useTrackers } from '../store/TrackerContext';
import { resolveColor } from '../lib/format';

/**
 * A container: its items, and anything filed inside it.
 *
 * Categories and lists turned out to be the same thing — a container holding
 * items — so there is one screen for both. The only difference left is whether
 * a given container happens to have other containers inside it.
 */
export default function ListDetailScreen({
  tracker,
  onBack,
  onOpenItem,
  onOpenTracker,
  onOpenChild,
}) {
  // These operations dispatch to AsyncStorage or Firestore depending on
  // whether the list is shared — the screen doesn't need to know which.
  const {
    trackers,
    addTracker,
    setTrackerParent,
    addItemTo,
    toggleItemIn,
    clearDoneIn,
    renameTracker,
    reorderItemsIn,
    finalizeShare,
    deleteTracker,
  } = useTrackers();
  const [text, setText] = useState('');
  const [addingChild, setAddingChild] = useState(false);
  const [movingChild, setMovingChild] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Containers and timers filed inside this one.
  const children = useMemo(
    () => trackers.filter((t) => t.parentId === tracker.id),
    [trackers, tracker.id]
  );

  const handleCreateChild = useCallback(
    (created) => {
      addTracker(created);
      setTrackerParent(created.id, tracker.id);
      setAddingChild(false);
      onOpenChild?.(created.id);
    },
    [addTracker, setTrackerParent, tracker.id, onOpenChild]
  );
  const [sharing, setSharing] = useState(false);
  const [renaming, setRenaming] = useState(false);

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

  const clearDone = useCallback(() => clearDoneIn(tracker), [tracker, clearDoneIn]);

  // Everything that happens *after* sharing is deferred to here, once the
  // sheet has closed. Switching route and deleting the local copy while the
  // sheet was still mounted was what left a black screen: the modal went away
  // with the screen that owned it, instead of being dismissed first.
  const handleShareClose = useCallback(
    (result) => {
      setSharing(false);
      if (!result?.publishedId) return;
      // Move to the shared list first, so nothing is pointing at the local
      // copy by the time it's removed.
      onOpenTracker?.(`remote:${result.publishedId}`);
      finalizeShare(result.localId);
    },
    [onOpenTracker, finalizeShare]
  );

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
        onRename={() => setRenaming(true)}
        onMenu={() => setMenuOpen(true)}
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

        <ReorderableList
          data={items}
          keyExtractor={(item) => item.id}
          onReorder={({ from, to }) => reorderItemsIn(tracker, from, to)}
          renderItem={({ item }) => (
            <ListItemRow
              item={item}
              color={color}
              onToggle={() => toggle(item.id)}
              onOpen={() => onOpenItem?.(tracker.id, item.id)}
            />
          )}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.empty}>Nothing here yet.</Text>
          }
          // Anything filed inside sits above the items. Not draggable — the
          // reorderable list holds the items, and it can only hold one kind
          // of thing. Ordering items matters more than ordering the handful
          // of containers inside one.
          ListHeaderComponent={
            children.length > 0 ? (
              <View style={styles.children}>
                {children.map((child) => (
                  <TrackerCard
                    key={child.id}
                    tracker={child}
                    onPress={() => onOpenChild?.(child.id)}
                    onHold={() => setMovingChild(child)}
                  />
                ))}
              </View>
            ) : null
          }
          ListFooterComponent={
            <Pressable onPress={() => setAddingChild(true)} hitSlop={8}>
              <Text style={styles.addChild}>+ Add a category or timer here</Text>
            </Pressable>
          }
        />

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
        onClose={handleShareClose}
      />

      <RenameModal
        visible={renaming}
        tracker={tracker}
        initialName={tracker.name}
        initialParentId={tracker.parentId}
        onClose={() => setRenaming(false)}
        onSubmit={(name, parentId) => renameTracker(tracker, name, parentId)}
      />

      <AddTrackerModal
        visible={addingChild}
        onClose={() => setAddingChild(false)}
        onCreate={handleCreateChild}
      />

      <MoveTrackerModal
        visible={!!movingChild}
        tracker={movingChild}
        onClose={() => setMovingChild(null)}
      />

      <TrackerMenu
        visible={menuOpen}
        tracker={tracker}
        onClose={() => setMenuOpen(false)}
        onRename={() => setRenaming(true)}
        onShare={() => setSharing(true)}
        onDelete={confirmDelete}
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
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  reorderToggle: {
    color: theme.colors.vibeCyan,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: theme.fonts.main,
  },
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
  children: {
    marginBottom: 6,
  },
  addChild: {
    color: theme.colors.vibeBlue,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 14,
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
