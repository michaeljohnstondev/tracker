import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useReorderableDrag } from 'react-native-reorderable-list';
import theme from '../theme/themes';

// One row of a list. Split out of ListDetailScreen because the drag hook has
// to be called inside the item component the reorderable list renders.
//
// The checkbox and the label are separate targets on purpose: the row now
// opens a detail screen, so ticking something off has to be its own hit area
// rather than "anywhere on the row".
export default function ListItemRow({ item, color, onToggle, onOpen }) {
  const drag = useReorderableDrag();

  return (
    <View style={styles.item}>
      <Pressable
        onPress={onToggle}
        hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
        style={[
          styles.checkbox,
          { borderColor: color },
          item.done && { backgroundColor: color },
        ]}
      >
        {item.done ? <Text style={styles.check}>✓</Text> : null}
      </Pressable>

      <Pressable
        onPress={onOpen}
        onLongPress={drag}
        delayLongPress={220}
        style={({ pressed }) => [styles.main, pressed && { opacity: 0.6 }]}
      >
        <Text style={[styles.itemText, item.done && styles.itemTextDone]}>
          {item.text}
        </Text>
        {/* A note is the reason you'd open the row, so signal it exists
            without spending a line on it. */}
        {item.note ? <Text style={styles.noteHint}>📝</Text> : null}
      </Pressable>

      <Text style={styles.chevron}>›</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: theme.sizes.borderRadius,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
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
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemText: {
    flexShrink: 1,
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: theme.fonts.main,
  },
  itemTextDone: {
    color: theme.colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  noteHint: {
    fontSize: 11,
    marginLeft: 8,
  },
  chevron: {
    color: theme.colors.textSecondary,
    fontSize: 22,
    marginLeft: 8,
  },
});
