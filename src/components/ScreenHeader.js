import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import theme from '../theme/themes';

// Detail-screen top bar: a back chevron, a centered title tinted with the
// tracker's color, and an optional trash action on the right.
export default function ScreenHeader({ title, color, onBack, onDelete }) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.side}>
        <Text style={styles.back}>‹</Text>
      </Pressable>
      <Text
        style={[styles.title, color && { color }]}
        numberOfLines={1}
      >
        {title}
      </Text>
      <Pressable
        onPress={onDelete}
        hitSlop={12}
        style={styles.side}
        disabled={!onDelete}
      >
        {onDelete ? <Text style={styles.trash}>🗑</Text> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  side: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: {
    color: theme.colors.textPrimary,
    fontSize: 40,
    lineHeight: 42,
    marginTop: -4,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: theme.fonts.main,
  },
  trash: {
    fontSize: 20,
  },
});
