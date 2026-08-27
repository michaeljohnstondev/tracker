import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useThemedStyles } from '../theme/ThemeContext';

// Detail-screen top bar: a back chevron, a centered title tinted with the
// tracker's color, and optional share / trash actions on the right.
export default function ScreenHeader({ title, color, onBack, onRename, onMenu }) {
  const styles = useThemedStyles(makeStyles);
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
      {/* One menu rather than a row of icons — share, move and delete all live
          behind it. The slot is reserved either way so the title stays
          optically centred against the back chevron. */}
      <View style={styles.actions}>
        {onMenu ? (
          <Pressable onPress={onMenu} hitSlop={12} style={styles.action}>
            <Text style={styles.menuIcon}>☰</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (t) => ({
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
  menuIcon: {
    color: t.colors.textPrimary,
    fontSize: 22,
    lineHeight: 26,
  },
  back: {
    color: t.colors.textPrimary,
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
    color: t.colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    flexShrink: 1,
    fontFamily: t.fonts.main,
  },
  pencil: {
    color: t.colors.textSecondary,
    fontSize: 13,
    marginLeft: 7,
  },
  trash: {
    fontSize: 20,
  },
});
