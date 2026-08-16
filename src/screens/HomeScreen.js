import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import theme from '../theme/themes';
import VibeButton from '../components/ui/VibeButton';
import TrackerCard from '../components/TrackerCard';
import AddTrackerModal from '../components/AddTrackerModal';
import { useTrackers } from '../store/TrackerContext';

export default function HomeScreen({ onOpen }) {
  const { trackers, loaded, addTracker } = useTrackers();
  const [adding, setAdding] = useState(false);

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

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {loaded && trackers.length === 0 && (
          <Text style={styles.empty}>
            No trackers yet.{'\n'}Add one to get started.
          </Text>
        )}

        {trackers.map((t) => (
          <TrackerCard key={t.id} tracker={t} onPress={() => onOpen(t.id)} />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <VibeButton label="+ Add Tracker" onPress={() => setAdding(true)} />
      </View>

      <AddTrackerModal
        visible={adding}
        onClose={() => setAdding(false)}
        onCreate={handleCreate}
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
});
