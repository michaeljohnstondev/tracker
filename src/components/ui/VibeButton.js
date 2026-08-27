import React from 'react';
import { Pressable, View, Text } from 'react-native';
import { useTheme, useThemedStyles } from '../../theme/ThemeContext';

/**
 * VibeButton with variants:
 * - default: accent button — neon-bordered on dark, solid-filled on light
 * - toggle: toggle-style button with color parameter
 * - red: destructive action
 * - green: positive action
 * Usage:
 * <VibeButton label="Click Me" onPress={...} />
 * <VibeButton onPress={...}>Click Me</VibeButton>
 * <VibeButton label="Toggle" onPress={...} variant="toggle" color="purple" />
 * <VibeButton label="Delete" onPress={...} variant="red" />
 * <VibeButton label="Join" onPress={...} variant="green" />
 *
 * The chunky asymmetric border (heavier on the bottom) is the brand signature
 * and survives in both themes. What changes is what fills it: on dark the fill
 * stays dim and the neon edge carries the button, on light the fill carries it
 * and the edge drops to a darker shade of the same hue.
 */

// Each toggle colour resolves to a hue plus its matching low-emphasis
// background. Naming both halves here is what lets the light theme swap an
// invisible 10%-alpha wash for an opaque tint without the component caring.
const TOGGLE_COLORS = {
  blue: ['vibeBlue', 'vibeBackgroundBlue'],
  green: ['vibeGreen', 'vibeBackgroundGreen'],
  orange: ['vibeOrange', 'vibeBackgroundOrange'],
  purple: ['vibePurple', 'vibeBackgroundPurple'],
  yellow: ['vibeYellow', 'vibeBackgroundYellow'],
  pink: ['vibePink', 'vibeBackgroundPink'],
  red: ['vibeRed', 'vibeBackgroundRed'],
  cyan: ['vibeCyan', 'vibeBackgroundCyan'],
  turquoise: ['vibeTurquoise', 'vibeBackgroundTurquoise'],
  aqua: ['vibeAqua', 'vibeBackgroundAqua'],
  teal: ['vibeTeal', 'vibeBackgroundTeal'],
  electricBlue: ['vibeElectricBlue', 'vibeBackgroundElectricBlue'],
  royalBlue: ['vibeRoyalBlue', 'vibeBackgroundRoyalBlue'],
  gray: ['gray', 'vibeBackgroundGray'],
};

export default function VibeButton({
  label,
  children,
  onPress,
  style,
  textStyle,
  variant = 'default',
  color = 'blue',
  disabled = false,
}) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const buttonText = label || children;

  const getToggleColors = (colorName) => {
    const [hueKey, bgKey] = TOGGLE_COLORS[colorName] || TOGGLE_COLORS.blue;
    return {
      hue: theme.colors[hueKey],
      // On dark the translucent black recedes behind the neon edge; on light
      // it would just be grey, so the hue's own tint takes over.
      background: theme.isDark ? theme.semantic.fieldFill : theme.colors[bgKey],
    };
  };

  const pressableState = ({ pressed }) => [
    {
      opacity: pressed ? 0.7 : disabled ? 0.5 : 1,
      transform: [{ scale: pressed ? 0.98 : 1 }],
    },
    style,
  ];

  if (variant === 'toggle') {
    const { hue, background } = getToggleColors(color);
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        delayPressIn={0}
        delayPressOut={0}
        hitSlop={4}
        style={({ pressed }) => [
          styles.toggleButton,
          { borderColor: hue, backgroundColor: background },
          { opacity: pressed ? 0.7 : disabled ? 0.5 : 1 },
          { transform: [{ scale: pressed ? 0.98 : 1 }] },
          style,
        ]}
      >
        <Text style={[styles.toggleText, { color: hue }, textStyle]}>
          {buttonText}
        </Text>
      </Pressable>
    );
  }

  if (variant === 'red') {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        delayPressIn={0}
        delayPressOut={0}
        hitSlop={4}
        style={pressableState}
      >
        <View style={styles.redOuterBorder}>
          <View style={styles.redSolidFill}>
            <View style={styles.buttonContent}>
              <Text style={[styles.text, styles.onDangerText, textStyle]}>
                {buttonText}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  }

  if (variant === 'green') {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        delayPressIn={0}
        delayPressOut={0}
        hitSlop={4}
        style={pressableState}
      >
        <View style={styles.greenOuterBorder}>
          <View style={styles.greenSolidFill}>
            <View style={styles.buttonContent}>
              <Text style={[styles.text, styles.onSuccessText, textStyle]}>
                {buttonText}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  }

  // Default variant
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      delayPressIn={0}
      delayPressOut={0}
      hitSlop={4}
      style={({ pressed }) => [
        {
          opacity: pressed && !disabled ? 0.7 : 1,
          transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      <View style={styles.outerBorder}>
        <View style={styles.gradientBorder}>
          <View style={styles.buttonContent}>
            <Text style={[styles.text, textStyle]}>{buttonText}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const makeStyles = (t) => ({
  // Default variant styles
  outerBorder: {
    borderBottomWidth: 4,
    borderLeftWidth: 3,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: t.semantic.accentBorder,
    borderRadius: t.sizes.buttonRadius,
    marginVertical: 10,
  },
  gradientBorder: {
    borderRadius: t.sizes.buttonRadius - 4,
    padding: 3,
    marginBottom: -0.5,
    marginLeft: -0.5,
    backgroundColor: t.semantic.accentInnerFill,
    overflow: 'hidden',
  },
  buttonContent: {
    backgroundColor: 'transparent',
    borderRadius: t.sizes.buttonRadius - 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    overflow: 'hidden',
  },
  text: {
    color: t.semantic.onAccent,
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: t.fonts.main,
  },
  onDangerText: { color: t.semantic.onDanger },
  onSuccessText: { color: t.semantic.onSuccess },

  // Toggle variant styles — borderColor and backgroundColor are applied
  // inline, since they depend on the `color` prop.
  toggleButton: {
    borderWidth: 3,
    borderRadius: t.sizes.buttonRadius,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginVertical: 0,
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: t.fonts.main,
    textAlign: 'center',
  },

  // Red variant styles
  redOuterBorder: {
    borderBottomWidth: 4,
    borderLeftWidth: 3,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: t.semantic.dangerBorder,
    borderRadius: t.sizes.buttonRadius,
    marginVertical: 10,
  },
  redSolidFill: {
    backgroundColor: t.semantic.dangerFill,
    borderRadius: t.sizes.buttonRadius - 4,
    padding: 2,
    marginBottom: -0.5,
    marginLeft: -0.5,
    overflow: 'hidden',
  },

  // Green variant styles
  greenOuterBorder: {
    borderBottomWidth: 4,
    borderLeftWidth: 3,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: t.semantic.successBorder,
    borderRadius: t.sizes.buttonRadius,
    marginVertical: 10,
  },
  greenSolidFill: {
    backgroundColor: t.semantic.successFill,
    borderRadius: t.sizes.buttonRadius - 4,
    padding: 2,
    marginBottom: -0.5,
    marginLeft: -0.5,
    overflow: 'hidden',
  },
});
