import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import theme from '../theme/themes';
import VibeInput from './ui/VibeInput';
import VibeButton from './ui/VibeButton';
import VibeSegmentedControl from './ui/VibeSegmentedControl';
import {
  TRACKER_COLORS,
  makeTimerTracker,
  makeListTracker,
} from '../lib/trackers';
import { resolveColor } from '../lib/format';

const TYPE_OPTIONS = [
  { value: 'timer', label: 'Timer', icon: '⏱' },
  { value: 'list', label: 'List', icon: '☰' },
];

const GOAL_PRESETS = [13, 16, 18, 20, 24];

// A Vibe-styled form for creating a tracker. Slides up from the bottom;
// tapping the dimmed backdrop cancels. Resets its fields each time it
// opens so a cancelled draft doesn't linger.
export default function AddTrackerModal({ visible, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('timer');
  const [color, setColor] = useState(TRACKER_COLORS[0]);
  const [goalHours, setGoalHours] = useState(16);

  const reset = () => {
    setName('');
    setType('timer');
    setColor(TRACKER_COLORS[0]);
    setGoalHours(16);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const tracker =
      type === 'timer'
        ? makeTimerTracker({ name: trimmed, color, goalHours })
        : makeListTracker({ name: trimmed, color });
    onCreate(tracker);
    reset();
  };

  const canCreate = name.trim().length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kav}
        >
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>New Tracker</Text>

            <Text style={styles.label}>Name</Text>
            <VibeInput
              placeholder="e.g. Fast, Shopping, Water plants"
              value={name}
              onChangeText={setName}
              autoFocus
              maxLength={40}
              autoCapitalize="sentences"
            />

            <Text style={styles.label}>Type</Text>
            <VibeSegmentedControl
              options={TYPE_OPTIONS}
              selectedValue={type}
              onSelect={setType}
            />

            {type === 'timer' && (
              <>
                <Text style={styles.label}>Goal</Text>
                <View style={styles.chips}>
                  {GOAL_PRESETS.map((h) => (
                    <VibeButton
                      key={h}
                      label={`${h}h`}
                      variant="toggle"
                      color={h === goalHours ? 'green' : 'gray'}
                      onPress={() => setGoalHours(h)}
                      style={styles.goalChip}
                    />
                  ))}
                </View>
              </>
            )}

            <Text style={styles.label}>Color</Text>
            <View style={styles.colors}>
              {TRACKER_COLORS.map((c) => {
                const selected = c === color;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    style={[
                      styles.swatch,
                      { backgroundColor: resolveColor(c) },
                      selected && styles.swatchSelected,
                    ]}
                  />
                );
              })}
            </View>

            <View style={styles.actions}>
              <VibeButton
                label="Create"
                variant="green"
                onPress={handleCreate}
                disabled={!canCreate}
              />
              <Pressable onPress={handleClose} hitSlop={8}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  kav: {
    width: '100%',
  },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: theme.colors.inputBorder,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 34,
  },
  title: {
    color: theme.colors.vibeCyan,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: theme.fonts.main,
    marginBottom: 8,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
    fontFamily: theme.fonts.main,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  goalChip: {
    minWidth: 56,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  colors: {
    flexDirection: 'row',
    gap: 12,
  },
  swatch: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: {
    borderColor: theme.colors.white,
    transform: [{ scale: 1.12 }],
  },
  actions: {
    marginTop: 26,
    alignItems: 'stretch',
  },
  cancel: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 6,
    fontFamily: theme.fonts.main,
  },
});
