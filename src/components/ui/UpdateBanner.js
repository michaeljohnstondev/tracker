import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedStyles } from '../../theme/ThemeContext';

// A banner that appears once an OTA update has been downloaded and is ready
// to apply. There's no dismiss: the whole point is to stop the app running a
// stale bundle. It floats over the screen rather than pushing layout down, so
// it can't reflow whatever the user is in the middle of.
//
// Ported from snapple-park's UpdateBanner, minus the vector-icon (tracker
// doesn't depend on @expo/vector-icons) and with a safe-area offset, since
// tracker's screens draw under the status bar.
export default function UpdateBanner({ visible, onRestart }) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  return (
    <View
      style={[styles.banner, { paddingTop: insets.top }]}
      pointerEvents="box-none"
    >
      <View style={styles.inner}>
        <Text style={styles.sparkle}>✨</Text>
        <Text style={styles.text} numberOfLines={1}>
          New version ready
        </Text>
        <Pressable
          onPress={onRestart}
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}
          hitSlop={6}
        >
          <Text style={styles.buttonText}>Restart</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (t) => ({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 1000,
  },
  inner: {
    marginHorizontal: 12,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: t.semantic.surface,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: t.colors.vibeYellow,
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 6,
  },
  sparkle: {
    fontSize: 14,
  },
  text: {
    flex: 1,
    color: t.colors.white,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: t.fonts.main,
  },
  button: {
    backgroundColor: t.colors.vibeYellow,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  buttonText: {
    color: t.colors.black,
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: t.fonts.main,
  },
});
