import React, { useMemo } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import theme from '../theme/themes';
import { useTrackers } from '../store/TrackerContext';
import { filingTargets } from '../lib/trackers';
import { resolveColor } from '../lib/format';

// Where a tracker lives, reachable by holding its card.
//
// Long-press already starts a drag, so this opens only when the press ends
// without the card having moved — hold and drag to reorder, hold and let go
// to file. One gesture, disambiguated by whether you actually dragged.
export default function MoveTrackerModal({ visible, tracker, onClose }) {
  const { trackers, setTrackerParent } = useTrackers();

  const targets = useMemo(
    () => (tracker ? filingTargets(trackers, tracker) : []),
    [trackers, tracker]
  );

  const move = (parentId) => {
    setTrackerParent(tracker.id, parentId);
    onClose();
  };

  const currentParent = tracker?.parentId ?? null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Move “{tracker?.name}”</Text>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <Pressable
              onPress={() => move(null)}
              style={[styles.row, styles.rowBorder]}
            >
              <Text style={styles.rowIcon}>🏠</Text>
              <Text style={styles.rowLabel}>Home</Text>
              {!currentParent && <Text style={styles.check}>✓</Text>}
            </Pressable>

            {targets.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => move(c.id)}
                style={[styles.row, styles.rowBorder]}
              >
                <Text style={[styles.rowIcon, { color: resolveColor(c.color) }]}>
                  🗂
                </Text>
                <Text style={styles.rowLabel} numberOfLines={1}>
                  {c.name}
                </Text>
                {currentParent === c.id && <Text style={styles.check}>✓</Text>}
              </Pressable>
            ))}

            {targets.length === 0 && (
              <Text style={styles.empty}>
                No categories yet. Create one from the home screen and it'll
                show up here.
              </Text>
            )}
          </ScrollView>

          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: theme.colors.inputBorder,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 34,
    maxHeight: '75%',
  },
  title: {
    color: theme.colors.vibeCyan,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: theme.fonts.main,
    marginBottom: 12,
  },
  scroll: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.inputBorder,
  },
  rowIcon: {
    fontSize: 18,
    width: 30,
  },
  rowLabel: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: theme.fonts.main,
  },
  check: {
    color: theme.colors.vibeGreen,
    fontSize: 16,
    fontWeight: '700',
  },
  empty: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: 18,
    fontFamily: theme.fonts.main,
  },
  cancel: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 14,
    fontFamily: theme.fonts.main,
  },
});
