import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReorderableList from 'react-native-reorderable-list';
import theme from '../theme/themes';
import VibeButton from '../components/ui/VibeButton';
import VibeAlert from '../components/ui/VibeAlert';
import TrackerCard from '../components/TrackerCard';
import AddTrackerModal from '../components/AddTrackerModal';
import ScreenHeader from '../components/ScreenHeader';
import RenameModal from '../components/RenameModal';
import MoveTrackerModal from '../components/MoveTrackerModal';
import { useTrackers } from '../store/TrackerContext';
import { resolveColor } from '../lib/format';

// The inside of a category: the trackers filed within it.
//
// Deliberately the same shape as the home screen — same cards, same
// drag-to-reorder — because a category is just another place trackers live,
// not a different kind of screen.
export default function CategoryDetailScreen({ tracker, onBack, onOpen }) {
  const { trackers, addTracker, setTrackerParent, renameTracker, deleteTracker, reorderTrackers } =
    useTrackers();
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [moving, setMoving] = useState(null);

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

      <ReorderableList
        data={children}
        keyExtractor={(t) => t.id}
        // Indices are positions among this category's children, so the ids go
        // along for mapping back onto the full order.
        onReorder={({ from, to }) =>
          reorderTrackers(from, to, children.map((t) => t.id))
        }
        renderItem={({ item, index }) => (
          <TrackerCard
            tracker={item}
            index={index}
            onPress={() => onOpen(item.id)}
            onHold={() => setMoving(item)}
          />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Nothing in here yet.{'\n'}Add a tracker, or move one in from its
            own edit screen.
          </Text>
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
});
