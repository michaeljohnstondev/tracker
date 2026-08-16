import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import theme from '../theme/themes';
import VibeButton from '../components/ui/VibeButton';
import TrackerCard from '../components/TrackerCard';
import AddTrackerModal from '../components/AddTrackerModal';
import JoinListModal from '../components/JoinListModal';
import { useTrackers } from '../store/TrackerContext';
import { useAuth } from '../store/AuthContext';

export default function HomeScreen({ onOpen }) {
  const { trackers, loaded, addTracker } = useTrackers();
  const { user } = useAuth();
  const [adding, setAdding] = useState(false);
  const [joining, setJoining] = useState(false);

  const handleCreate = (tracker) => {
    addTracker(tracker);
    setAdding(false);
    onOpen(tracker.id); // jump straight into the new tracker
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Trackers</Text>
        {/* Only surfaced once signed in — an account is optional here, and
            advertising one before it's needed just adds friction. */}
        {user ? (
          <Text style={styles.account} numberOfLines={1}>
            {user.displayName || user.email}
          </Text>
        ) : null}
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
  account: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
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
