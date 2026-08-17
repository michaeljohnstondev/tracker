import React, { useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import theme from '../theme/themes';
import { useTrackers } from '../store/TrackerContext';

// Everything you can do to a tracker, in one sheet off the header.
//
// Moving is expressed relatively — out one level, or into one of the
// containers sitting alongside it — rather than as a picker listing every
// category in the app. Relative moves are the ones you actually want, and they
// stay short no matter how big the tree gets. Options that can't apply simply
// aren't shown: nothing to move out of, no siblings to move into, no menu
// entry.
export default function TrackerMenu({
  visible,
  tracker,
  onClose,
  onRename,
  onShare,
  onDelete,
}) {
  const { trackers, setTrackerParent } = useTrackers();
  const [choosing, setChoosing] = useState(false);

  const parent = useMemo(
    () => trackers.find((t) => t.id === tracker?.parentId) ?? null,
    [trackers, tracker]
  );

  // Containers at the same level, which this could be moved into.
  const siblings = useMemo(
    () =>
      trackers.filter(
        (t) =>
          t.id !== tracker?.id &&
          t.type !== 'timer' &&
          (t.parentId ?? null) === (tracker?.parentId ?? null)
      ),
    [trackers, tracker]
  );

  const close = () => {
    setChoosing(false);
    onClose();
  };

  const moveOut = () => {
    setTrackerParent(tracker.id, parent?.parentId ?? null);
    close();
  };

  const moveInto = (target) => {
    setTrackerParent(tracker.id, target.id);
    close();
  };

  const isContainer = tracker?.type !== 'timer';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={close}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title} numberOfLines={1}>
            {tracker?.name}
          </Text>

          {choosing ? (
            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.hint}>Move into…</Text>
              {siblings.map((s) => (
                <Pressable key={s.id} onPress={() => moveInto(s)} style={styles.row}>
                  <Text style={styles.rowIcon}>🗂</Text>
                  <Text style={styles.rowLabel} numberOfLines={1}>
                    {s.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <>
              <Pressable onPress={() => { onClose(); onRename?.(); }} style={styles.row}>
                <Text style={styles.rowIcon}>✎</Text>
                <Text style={styles.rowLabel}>Edit title</Text>
              </Pressable>

              {isContainer && onShare && (
                <Pressable onPress={() => { onClose(); onShare(); }} style={styles.row}>
                  <Text style={styles.rowIcon}>⤴</Text>
                  <Text style={styles.rowLabel}>Share</Text>
                </Pressable>
              )}

              {/* Only when there's somewhere to come out to. */}
              {tracker?.parentId && (
                <Pressable onPress={moveOut} style={styles.row}>
                  <Text style={styles.rowIcon}>↑</Text>
                  <Text style={styles.rowLabel}>
                    {parent?.parentId ? 'Move up a level' : 'Move to home'}
                  </Text>
                </Pressable>
              )}

              {/* Only when there's something alongside to go into. */}
              {siblings.length > 0 && (
                <Pressable onPress={() => setChoosing(true)} style={styles.row}>
                  <Text style={styles.rowIcon}>↓</Text>
                  <Text style={styles.rowLabel}>Move into…</Text>
                </Pressable>
              )}

              <Pressable onPress={() => { onClose(); onDelete?.(); }} style={styles.row}>
                <Text style={styles.rowIcon}>🗑</Text>
                <Text style={[styles.rowLabel, styles.destructive]}>Delete</Text>
              </Pressable>
            </>
          )}

          <Pressable onPress={close} hitSlop={8}>
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
    maxHeight: '80%',
  },
  title: {
    color: theme.colors.vibeCyan,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: theme.fonts.main,
    marginBottom: 10,
  },
  scroll: { flexGrow: 0 },
  hint: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 6,
    fontFamily: theme.fonts.main,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.inputBorder,
  },
  rowIcon: {
    fontSize: 17,
    width: 32,
    color: theme.colors.textPrimary,
  },
  rowLabel: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: theme.fonts.main,
  },
  destructive: {
    color: theme.colors.vibeRed,
  },
  cancel: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 16,
    fontFamily: theme.fonts.main,
  },
});
