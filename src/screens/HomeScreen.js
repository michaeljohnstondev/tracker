import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReorderableList from 'react-native-reorderable-list';
import theme from '../theme/themes';
import VibeButton from '../components/ui/VibeButton';
import TrackerCard from '../components/TrackerCard';
import AddTrackerModal from '../components/AddTrackerModal';
import JoinListModal from '../components/JoinListModal';
import { useTrackers } from '../store/TrackerContext';
import { TRACKER_CATEGORIES } from '../lib/trackers';

const ALL = 'All';

export default function HomeScreen({ onOpen }) {
  const { trackers, loaded, addTracker, reorderTrackers } = useTrackers();
  const [adding, setAdding] = useState(false);
  const [joining, setJoining] = useState(false);
  const [filter, setFilter] = useState(ALL);

  // Only categories actually in use are offered. An empty "Health" tab before
  // any health tracker exists is just a dead end.
  const usedCategories = useMemo(() => {
    const present = new Set(trackers.map((t) => t.category));
    return TRACKER_CATEGORIES.filter((c) => present.has(c));
  }, [trackers]);

  const visible = useMemo(
    () => (filter === ALL ? trackers : trackers.filter((t) => t.category === filter)),
    [trackers, filter]
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

      {/* Hidden until there's more than one category in play — a lone "All"
          chip is just clutter. */}
      {usedCategories.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {[ALL, ...usedCategories].map((c) => (
            <Pressable
              key={c}
              onPress={() => setFilter(c)}
              style={[styles.filterChip, c === filter && styles.filterChipOn]}
            >
              <Text
                style={[styles.filterText, c === filter && styles.filterTextOn]}
              >
                {c}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <ReorderableList
        data={visible}
        keyExtractor={(t) => t.id}
        // Indices are positions within the filtered view, so the ids are
        // passed along for mapping back onto the full order.
        onReorder={({ from, to }) =>
          reorderTrackers(from, to, visible.map((t) => t.id))
        }
        renderItem={({ item }) => (
          <TrackerCard tracker={item} onPress={() => onOpen(item.id)} />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loaded ? (
            <Text style={styles.empty}>
              {filter === ALL
                ? 'No trackers yet.\nAdd one to get started.'
                : `Nothing in ${filter} yet.`}
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
  filters: {
    paddingHorizontal: 24,
    paddingBottom: 4,
    gap: 8,
  },
  filterChip: {
    borderWidth: 2,
    borderColor: theme.colors.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  filterChipOn: {
    borderColor: theme.colors.vibeBlue,
    backgroundColor: 'rgba(0, 198, 255, 0.1)',
  },
  filterText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: theme.fonts.main,
  },
  filterTextOn: {
    color: theme.colors.vibeBlue,
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
