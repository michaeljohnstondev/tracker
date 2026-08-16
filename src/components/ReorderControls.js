import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import theme from '../theme/themes';

// A stacked up/down pair, used for both home-screen cards and list items.
//
// Both arrows are always rendered — greyed out at the ends rather than hidden
// — so rows don't change width as things move and the buttons stay under the
// same thumb position through a run of taps.
export default function ReorderControls({ onUp, onDown, canUp, canDown }) {
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onUp}
        disabled={!canUp}
        hitSlop={{ top: 6, bottom: 2, left: 10, right: 10 }}
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
      >
        <Text style={[styles.arrow, !canUp && styles.disabled]}>▲</Text>
      </Pressable>
      <Pressable
        onPress={onDown}
        disabled={!canDown}
        hitSlop={{ top: 2, bottom: 6, left: 10, right: 10 }}
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
      >
        <Text style={[styles.arrow, !canDown && styles.disabled]}>▼</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 6,
  },
  btn: {
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  pressed: {
    opacity: 0.5,
  },
  arrow: {
    color: theme.colors.vibeCyan,
    fontSize: 15,
    lineHeight: 17,
  },
  disabled: {
    color: theme.colors.inputBorder,
  },
});
