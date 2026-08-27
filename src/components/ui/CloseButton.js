import React from 'react';
import { Pressable, Text } from 'react-native';
import { useThemedStyles } from '../../theme/ThemeContext';

/**
 * The ✕ that removes something. Ported from bvs-app so it feels the same here.
 *
 * `delayPressIn={0}` is the reason it's a component rather than a styled
 * Pressable: without it a quick tap can be swallowed while the press state
 * settles, which on a small target reads as the button not working.
 */
export default function CloseButton({ onPress, style, textStyle, children = '✕' }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      delayPressIn={0}
      delayPressOut={0}
      hitSlop={10}
      style={({ pressed }) => [
        styles.button,
        { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] },
        style,
      ]}
    >
      <Text style={[styles.text, textStyle]}>{children}</Text>
    </Pressable>
  );
}

const makeStyles = (t) => ({
  button: { padding: 8, justifyContent: 'center', alignItems: 'center' },
  text: {
    color: t.colors.vibeBlue,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 22,
  },
});
