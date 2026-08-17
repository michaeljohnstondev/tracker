import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReorderableList from 'react-native-reorderable-list';
import theme from '../theme/themes';
import VibeButton from '../components/ui/VibeButton';
import TrackerCard from '../components/TrackerCard';
import AddTrackerModal from '../components/AddTrackerModal';
import JoinListModal from '../components/JoinListModal';
import MoveTrackerModal from '../components/MoveTrackerModal';
import { useTrackers } from '../store/TrackerContext';

export default function HomeScreen({ onOpen }) {
  const { trackers, loaded, addTracker, reorderTrackers } = useTrackers();
  const [adding, setAdding] = useState(false);
  const [joining, setJoining] = useState(false);
  const [moving, setMoving] = useState(null);
  // Only the top level. Anything filed inside a category appears on that
  // category's own screen instead.
  const visible = useMemo(
    () => trackers.filter((t) => !t.parentId),
    [trackers]
  );

  const handleCreate = (tracker) => {
    addTracker(tracker);
    setAdding(false);
    onOpen(tracker.id); // jump straight into the new tracker
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Trackers</Text>
      </View>

      <ReorderableList
        data={visible}
        keyExtractor={(t) => t.id}
        // Indices are positions within the filtered view, so the ids are
        // passed along for mapping back onto the full order.
        onReorder={({ from, to }) =>
          reorderTrackers(from, to, visible.map((t) => t.id))
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
          loaded ? (
            <Text style={styles.empty}>
              No trackers yet.{'\n'}Add one to get started.
            </Text>
          ) : null
        }
      />

      <View style={styles.footer}>
        <VibeButton label="+ Add Tracker" onPress={() => setAdding(true)} />
        <Pressable onPress={() => setJoining(true)} hitSlop={8}>
          <Text style={styles.joinLink}>Join with code</Text>
        </Pressable>
      </View>

      <AddTrackerModal
        visible={adding}
        onClose={() => setAdding(false)}
        onCreate={handleCreate}
      />

      <JoinListModal visible={joining} onClose={() => setJoining(false)} />

      <MoveTrackerModal
        visible={!!moving}
        tracker={moving}
        onClose={() => setMoving(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: {
    color: theme.colors.vibeCyan,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
    fontFamily: theme.fonts.main,
  },
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
    marginTop: 80,
    lineHeight: 24,
    fontFamily: theme.fonts.main,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  joinLink: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    textDecorationLine: 'underline',
    fontFamily: theme.fonts.main,
  },
});
