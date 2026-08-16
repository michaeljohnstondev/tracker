import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import theme from '../theme/themes';
import { fmtElapsedShort, resolveColor } from '../lib/format';
import { useNow } from '../lib/useNow';

// One row on the home screen. Shows a live summary depending on type:
//  - timer:  running elapsed + goal, or "Not started"
//  - list:   "3 / 7 done"
export default function TrackerCard({ tracker, onPress }) {
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
  } else {
    const total = tracker.items.length;
    const done = tracker.items.filter((i) => i.done).length;
    summary = total === 0 ? 'Empty' : `${done} / ${total} done`;
    if (total > 0 && done === total) accent = theme.colors.vibeGreen;
  }

  const icon = tracker.type === 'timer' ? '⏱' : '☰';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { borderLeftColor: color },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.left}>
        <Text style={[styles.icon, { color }]}>{icon}</Text>
        <View style={styles.text}>
          <Text style={styles.name} numberOfLines={1}>
            {tracker.name}
          </Text>
          <Text style={[styles.summary, { color: accent }]} numberOfLines={1}>
            {summary}
          </Text>
        </View>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
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
  name: {
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontWeight: '600',
    fontFamily: theme.fonts.main,
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
