import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ScrollViewContainer,
  NestedReorderableList,
} from 'react-native-reorderable-list';
import theme from '../theme/themes';
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
import { resolveColor, isStale } from '../lib/format';

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
    updateItemIn,
    clearDoneIn,
    renameTracker,
    reorderItemsIn,
    reorderTrackers,
    finalizeShare,
    deleteTracker,
  } = useTrackers();
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

  // Repeating items un-tick themselves once their period has passed. Done on
  // view rather than on a schedule: there's no background process to rely on,
  // and the only moment it has to be right is when you're looking at it.
  //
  // On a shared list both people may run this; the write is idempotent, so a
  // double-clear is harmless.
  useEffect(() => {
    items.filter(isStale).forEach((item) => {
      updateItemIn(tracker, item.id, { done: false, doneAt: null, doneBy: null });
    });
  }, [items, tracker, updateItemIn]);

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
        {/* Two draggable lists in one scroll view: what's filed in here, then
            the items. Nesting them this way is what makes both reorderable —
            a single list can only hold one kind of thing, and putting the
            containers in a header left them stubbornly undraggable while the
            items beside them moved fine. */}
        <ScrollViewContainer
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children.length > 0 && (
            <NestedReorderableList
              data={children}
              scrollable={false}
              keyExtractor={(t) => t.id}
              onReorder={({ from, to }) =>
                reorderTrackers(from, to, children.map((t) => t.id))
              }
              renderItem={({ item: child, index }) => (
                <TrackerCard
                  tracker={child}
                  index={index}
                  onPress={() => onOpenChild?.(child.id)}
                  onHold={() => setMovingChild(child)}
                />
              )}
            />
          )}

          <NestedReorderableList
            data={items}
            scrollable={false}
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
          />

          {children.length === 0 && items.length === 0 && (
            <Text style={styles.empty}>Nothing here yet.</Text>
          )}
        </ScrollViewContainer>

        {/* Same Add button as the home screen, in the same place — a container
            is a container wherever you're standing. */}
        <View style={styles.footer}>
          {doneCount > 0 && (
            <Pressable onPress={clearDone} hitSlop={8}>
              <Text style={styles.clearDone}>Clear {doneCount} completed</Text>
            </Pressable>
          )}
          <VibeButton label="Add" onPress={() => setAddingChild(true)} />
        </View>
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
        // Items belong to this container, so they're offered here and not at
        // the top level, where there'd be nothing to attach them to.
        allowItem
        onCreateItem={(itemText) => {
          addItemTo(tracker, itemText);
          setAddingChild(false);
        }}
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
  // Matches the home screen's footer, so the Add button sits identically
  // wherever you are.
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    paddingTop: 4,
  },
  clearDone: {
    textAlign: 'center',
    marginBottom: 10,
    color: theme.colors.textSecondary,
    fontSize: 14,
    textDecorationLine: 'underline',
    fontFamily: theme.fonts.main,
  },
});
