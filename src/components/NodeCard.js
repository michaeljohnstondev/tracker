import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { runOnJS } from 'react-native-reanimated';
import {
  useReorderableDrag,
  useReorderableDragEnd,
} from 'react-native-reorderable-list';
import theme from '../theme/themes';
import { fmtElapsedShort, fmtDue, resolveColor } from '../lib/format';
import { useNow } from '../lib/useNow';

const REPEAT_LABELS = { daily: 'Daily', weekly: 'Weekly', always: 'Always' };

/**
 * One row. Since every node is the same kind of thing, the row shows whatever
 * that particular node happens to carry — a running clock, a child count, a
 * tick box — rather than branching on a type.
 */
export function NodeCardView({
  node,
  childCount = 0,
  onPress,
  onLongPress,
  onToggle,
  selectable = false,
  selected = false,
}) {
  const color = resolveColor(node.color);
  const running = node.startMs != null;
  const now = useNow(running);

  const goalMs = (node.goalHours || 0) * 3600 * 1000;
  const elapsed = running ? now - node.startMs : 0;
  const reached = goalMs > 0 && elapsed >= goalMs;

  // Only the facts this node actually has, in order of what you'd scan for.
  const bits = [];
  if (running) bits.push(fmtElapsedShort(elapsed));
  else if (node.goalHours) bits.push(`${node.goalHours}h goal`);
  const due = fmtDue(node.dueAt);
  if (due) bits.push(due);
  if (node.count != null) bits.push(`Count ${node.count}`);
  if (childCount) bits.push(`${childCount} inside`);
  if (node.repeat) bits.push(REPEAT_LABELS[node.repeat] ?? 'Repeats');

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      // Below the default 500ms so a long press feels like it catches rather
      // than like the app hesitated.
      delayLongPress={220}
      style={({ pressed }) => [
        styles.card,
        { borderLeftColor: color },
        pressed && styles.pressed,
        selected && [styles.selected, { borderColor: color }],
      ]}
    >
      {/* While selecting, the left slot says whether this is picked. Leaving
          the tick box live there would put two different meanings on the same
          spot — one that marks a thing done, one that marks it chosen. */}
      {selectable ? (
        <View
          style={[
            styles.checkbox,
            { borderColor: color },
            selected && { backgroundColor: color },
          ]}
        >
          {selected ? <Text style={styles.check}>✓</Text> : null}
        </View>
      ) : node.kind === 'category' ? (
        <Text style={[styles.folder, { color }]}>🗂</Text>
      ) : (
        <Pressable
          onPress={onToggle}
          hitSlop={{ top: 12, bottom: 12, left: 10, right: 6 }}
          style={[
            styles.checkbox,
            { borderColor: color },
            node.done && { backgroundColor: color },
          ]}
        >
          {node.done ? <Text style={styles.check}>✓</Text> : null}
        </Pressable>
      )}

      <View style={styles.text}>
        <View style={styles.nameRow}>
          <Text
            style={[styles.name, node.done && styles.nameDone]}
            numberOfLines={1}
          >
            {node.name}
          </Text>
          {node.shared ? <Text style={styles.badge}>👥</Text> : null}
          {node.note ? <Text style={styles.badge}>📝</Text> : null}
          {node.reminders?.length ? <Text style={styles.badge}>🔔</Text> : null}
        </View>
        {bits.length > 0 && (
          <Text
            style={[styles.summary, reached && { color: theme.colors.vibeGreen }]}
            numberOfLines={1}
          >
            {bits.join(' · ')}
          </Text>
        )}
      </View>

      {selectable ? null : <Text style={styles.chevron}>›</Text>}
    </Pressable>
  );
}

/**
 * The draggable version, for use inside a reorderable list.
 *
 * A drag that ends where it began means the card was held and released, which
 * opens the move sheet instead of reordering.
 */
export default function NodeCard({
  node,
  index,
  childCount,
  onPress,
  onHold,
  onToggle,
  selectable = false,
  selected = false,
}) {
  const drag = useReorderableDrag();
  const hold = useCallback(() => onHold?.(), [onHold]);

  // Runs as a worklet on the UI thread — the library keeps these handlers in a
  // reanimated shared value and calls them there, so touching React state
  // directly would crash. The index guard matters because every cell is
  // called, not just the one that moved.
  const onDragEnd = useCallback(
    (from, to) => {
      'worklet';
      if (from === to && from === index) runOnJS(hold)();
    },
    [index, hold]
  );

  useReorderableDragEnd(onDragEnd);

  return (
    <NodeCardView
      node={node}
      childCount={childCount}
      onPress={onPress}
      onLongPress={drag}
      onToggle={onToggle}
      selectable={selectable}
      selected={selected}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderLeftWidth: 5,
    borderRadius: theme.sizes.borderRadius,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  pressed: { opacity: 0.7 },
  selected: {
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.09)',
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
  folder: {
    fontSize: 20,
    width: 24,
    marginRight: 14,
    textAlign: 'center',
  },
  text: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
    fontFamily: theme.fonts.main,
  },
  nameDone: {
    color: theme.colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  badge: { fontSize: 11, marginLeft: 7 },
  summary: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginTop: 3,
    fontVariant: ['tabular-nums'],
    fontFamily: theme.fonts.main,
  },
  chevron: {
    color: theme.colors.textSecondary,
    fontSize: 24,
    marginLeft: 8,
  },
});
