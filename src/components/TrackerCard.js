import React, { useCallback } from 'react';
import { runOnJS } from 'react-native-reanimated';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import theme from '../theme/themes';
import { fmtElapsedShort, resolveColor } from '../lib/format';
import { useNow } from '../lib/useNow';
import {
  useReorderableDrag,
  useReorderableDragEnd,
} from 'react-native-reorderable-list';

/**
 * The card itself, with no drag behaviour.
 *
 * Split out because the drag hooks only work inside a reorderable list's
 * cells. Rendering the full card in a list header — where nested containers
 * are shown — made those hooks blow up and the screen came out blank.
 */
export function TrackerCardView({ tracker, onPress, onLongPress }) {
  const color = resolveColor(tracker.color);
  const active = tracker.type === 'timer' && tracker.startMs != null;
  const now = useNow(active);

  let summary;
  let accent = theme.colors.textSecondary;

  if (tracker.type === 'timer') {
    if (active) {
      const elapsed = now - tracker.startMs;
      const goalMs = (tracker.goalHours || 0) * 3600 * 1000;
      const reached = goalMs > 0 && elapsed >= goalMs;
      summary = `${fmtElapsedShort(elapsed)}${
        tracker.goalHours ? ` / ${tracker.goalHours}h` : ''
      }`;
      accent = reached ? theme.colors.vibeGreen : color;
    } else {
      summary = 'Not started';
    }
  } else if (tracker.type === 'category') {
    // Counting children needs the whole tracker list, which this card doesn't
    // have — and a count is not what you're scanning for on a folder anyway.
    summary = 'Category';
  } else {
    // A shared list's items arrive on a separate subscription to its
    // metadata, so the card can render for a beat before items exist.
    const items = tracker.items || [];
    const total = items.length;
    const done = items.filter((i) => i.done).length;
    summary = total === 0 ? 'Empty' : `${done} / ${total} done`;
    if (total > 0 && done === total) accent = theme.colors.vibeGreen;
  }

  const icon =
    tracker.type === 'timer' ? '⏱' : tracker.type === 'category' ? '🗂' : '☰';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      // Below the default 500ms: a long-press should feel like it catches,
      // not like the app hesitated.
      delayLongPress={220}
      style={({ pressed }) => [
        styles.card,
        { borderLeftColor: color },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.left}>
        <Text style={[styles.icon, { color }]}>{icon}</Text>
        <View style={styles.text}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {tracker.name}
            </Text>
            {tracker.shared ? <Text style={styles.sharedBadge}>👥</Text> : null}
          </View>
          <Text style={[styles.summary, { color: accent }]} numberOfLines={1}>
            {summary}
          </Text>
        </View>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

/**
 * A draggable card, for use inside a ReorderableList.
 *
 * Long-press starts a drag; a drag that ends where it began means the card was
 * held and released, which opens the move sheet instead.
 */
export default function TrackerCard({ tracker, index, onPress, onHold }) {
  // Provided by the enclosing list's cell; starts a drag when called.
  const drag = useReorderableDrag();

  const hold = useCallback(() => onHold?.(), [onHold]);

  // Runs as a worklet on the UI thread: the library keeps these handlers in a
  // reanimated shared value and calls them there. Touching React state from it
  // crashes, so the hop back to JS is required rather than decorative. The
  // index guard matters because every cell is called, not just the one moved.
  const onDragEnd = useCallback(
    (from, to) => {
      'worklet';
      if (from === to && from === index) {
        runOnJS(hold)();
      }
    },
    [index, hold]
  );

  useReorderableDragEnd(onDragEnd);

  return (
    <TrackerCardView tracker={tracker} onPress={onPress} onLongPress={drag} />
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderLeftWidth: 5,
    borderRadius: theme.sizes.borderRadius,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  pressed: {
    opacity: 0.7,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    fontSize: 22,
    marginRight: 14,
    width: 26,
    textAlign: 'center',
  },
  text: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontWeight: '600',
    flexShrink: 1,
    fontFamily: theme.fonts.main,
  },
  sharedBadge: {
    fontSize: 12,
    marginLeft: 7,
  },
  summary: {
    fontSize: 14,
    marginTop: 3,
    fontVariant: ['tabular-nums'],
    fontFamily: theme.fonts.main,
  },
  chevron: {
    color: theme.colors.textSecondary,
    fontSize: 26,
    marginLeft: 8,
  },
});
