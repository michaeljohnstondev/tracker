import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import theme from '../theme/themes';

// Detail-screen top bar: a back chevron, a centered title tinted with the
// tracker's color, and optional share / trash actions on the right.
export default function ScreenHeader({
  title,
  color,
  onBack,
  onRename,
  onShare,
  onDelete,
}) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.side}>
        <Text style={styles.back}>‹</Text>
      </Pressable>
      {/* Tapping the title renames it. The pencil is what makes that
          discoverable — a bare title doesn't read as a control. */}
      <Pressable
        onPress={onRename}
        disabled={!onRename}
        hitSlop={8}
        style={({ pressed }) => [styles.titleWrap, pressed && { opacity: 0.6 }]}
      >
        <Text style={[styles.title, color && { color }]} numberOfLines={1}>
          {title}
        </Text>
        {onRename ? <Text style={styles.pencil}>✎</Text> : null}
      </Pressable>
      {/* Reserve the right slot even with no actions so the title stays
          optically centered against the back chevron. */}
      <View style={styles.actions}>
        {onShare ? (
          <Pressable onPress={onShare} hitSlop={12} style={styles.action}>
            <Text style={styles.icon}>👥</Text>
          </Pressable>
        ) : null}
        {onDelete ? (
          <Pressable onPress={onDelete} hitSlop={12} style={styles.action}>
            <Text style={styles.icon}>🗑</Text>
          </Pressable>
        ) : null}
      </View>
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
  actions: {
    minWidth: 44,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  action: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 19,
  },
  back: {
    color: theme.colors.textPrimary,
    fontSize: 40,
    lineHeight: 42,
    marginTop: -4,
  },
  titleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    flexShrink: 1,
    fontFamily: theme.fonts.main,
  },
  pencil: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginLeft: 7,
  },
  trash: {
    fontSize: 20,
  },
});
