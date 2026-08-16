import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import theme from '../theme/themes';
import VibeButton from '../components/ui/VibeButton';
import VibeTimePicker from '../components/ui/VibeTimePicker';
import VibeCalendar from '../components/ui/VibeCalendar';
import VibeAlert from '../components/ui/VibeAlert';
import ScreenHeader from '../components/ScreenHeader';
import RenameModal from '../components/RenameModal';
import { useTrackers } from '../store/TrackerContext';
import { useNow } from '../lib/useNow';
import {
  fmtElapsed,
  fmtStart,
  fmtRemaining,
  resolveColor,
} from '../lib/format';

const GOAL_PRESETS = [13, 16, 18, 20, 24];

export default function TimerDetailScreen({ tracker, onBack }) {
  const { updateTracker, renameTracker, deleteTracker } = useTrackers();
  // Setting a start time is two steps — date, then time — so that a fast
  // running longer than a day can still be corrected. null means closed.
  const [pickerStage, setPickerStage] = useState(null);
  const [pendingDate, setPendingDate] = useState(null);
  const [renaming, setRenaming] = useState(false);

  const active = tracker.startMs != null;
  const now = useNow(active);
  const color = resolveColor(tracker.color);

  // Must be a stable object. The picker re-seeds its selection whenever this
  // changes identity, and this screen re-renders every second while a fast is
  // running — so a fresh Date here wiped out whatever the user had scrolled
  // to, once per second, making the start time impossible to edit.
  const pickerInitialTime = useMemo(
    () => (tracker.startMs != null ? new Date(tracker.startMs) : null),
    [tracker.startMs]
  );

  const startNow = useCallback(() => {
    updateTracker(tracker.id, { startMs: Date.now() });
  }, [tracker.id, updateTracker]);

  const stopReset = useCallback(() => {
    updateTracker(tracker.id, { startMs: null });
  }, [tracker.id, updateTracker]);

  const pickGoal = useCallback(
    (h) => updateTracker(tracker.id, { goalHours: h }),
    [tracker.id, updateTracker]
  );

  const openStartPicker = useCallback(() => {
    setPendingDate(
      tracker.startMs != null ? new Date(tracker.startMs) : new Date()
    );
    setPickerStage('date');
  }, [tracker.startMs]);

  const onConfirmDate = useCallback((date) => {
    setPendingDate(date);
    setPickerStage('time');
  }, []);

  // The date carries the day and the picker carries the clock time; combine
  // them rather than trusting either alone. This replaces the old guess that
  // a future time must have meant yesterday — with an explicit date there's
  // nothing left to infer, and a multi-day fast is now expressible.
  const onConfirmTime = useCallback(
    (time) => {
      setPickerStage(null);
      const base = pendingDate ?? new Date();
      const combined = new Date(
        base.getFullYear(),
        base.getMonth(),
        base.getDate(),
        time.getHours(),
        time.getMinutes(),
        0,
        0
      );
      const ms = combined.getTime();
      if (ms > Date.now()) {
        VibeAlert(
          'That start is in the future',
          'A timer can only start at or before the present moment.'
        );
        return;
      }
      updateTracker(tracker.id, { startMs: ms });
    },
    [pendingDate, tracker.id, updateTracker]
  );

  const confirmDelete = useCallback(() => {
    VibeAlert('Delete tracker', `Delete "${tracker.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { onBack(); deleteTracker(tracker.id); } },
    ]);
  }, [tracker.id, tracker.name, deleteTracker, onBack]);

  const elapsedMs = active ? now - tracker.startMs : 0;
  const goalHours = tracker.goalHours || 0;
  const goalMs = goalHours * 3600 * 1000;
  const pct = goalMs > 0 ? Math.min(100, (elapsedMs / goalMs) * 100) : 0;
  const reached = goalMs > 0 && elapsedMs >= goalMs;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScreenHeader
        title={tracker.name}
        color={color}
        onBack={onBack}
        onRename={() => setRenaming(true)}
        onDelete={confirmDelete}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {active ? (
          <>
            <Text style={styles.timer}>{fmtElapsed(elapsedMs)}</Text>
            <Text style={styles.startedLine}>Started {fmtStart(tracker.startMs)}</Text>

            {goalHours > 0 && (
              <>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${pct}%`, backgroundColor: color },
                      reached && styles.barFillReached,
                    ]}
                  />
                </View>
                <View style={styles.goalRow}>
                  <Text style={styles.goalLabel}>Goal {goalHours}h</Text>
                  <Text
                    style={[
                      styles.goalRemaining,
                      { color },
                      reached && styles.goalReached,
                    ]}
                  >
                    {fmtRemaining(elapsedMs, goalMs)}
                  </Text>
                </View>
              </>
            )}

            <Pressable
              onPress={openStartPicker}
              hitSlop={8}
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={styles.editLink}>Edit start date & time</Text>
            </Pressable>

            <View style={styles.actions}>
              <VibeButton label="Stop & Reset" variant="red" onPress={stopReset} />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.timer}>{fmtElapsed(0)}</Text>
            <Text style={styles.idleHint}>Tap start when it begins.</Text>

            <Text style={styles.sectionLabel}>Goal</Text>
            <View style={styles.goalPresets}>
              {GOAL_PRESETS.map((h) => (
                <VibeButton
                  key={h}
                  label={`${h}h`}
                  variant="toggle"
                  color={h === goalHours ? 'green' : 'gray'}
                  onPress={() => pickGoal(h)}
                  style={styles.goalChip}
                />
              ))}
            </View>

            <View style={styles.actions}>
              <VibeButton label="Start Now" variant="green" onPress={startNow} />
              <VibeButton
                label="I forgot — set start time"
                onPress={openStartPicker}
              />
            </View>
          </>
        )}
      </ScrollView>

      {/* Mounted only while in use: VibeCalendar seeds its selection in a
          useState initializer, so a persistent instance would still be showing
          whatever was picked last time. */}
      {pickerStage === 'date' && (
        <VibeCalendar
          visible
          initialDate={pendingDate}
          maximumDate={new Date()}
          onConfirm={onConfirmDate}
          onClose={() => setPickerStage(null)}
        />
      )}

      <VibeTimePicker
        visible={pickerStage === 'time'}
        onClose={() => setPickerStage(null)}
        onConfirm={onConfirmTime}
        initialTime={pickerInitialTime}
        confirmText="Set"
      />

      <RenameModal
        visible={renaming}
        initialName={tracker.name}
        onClose={() => setRenaming(false)}
        onSubmit={(name) => renameTracker(tracker, name)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  timer: {
    color: theme.colors.textPrimary,
    fontSize: 64,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
    fontFamily: theme.fonts.main,
    letterSpacing: 2,
    marginTop: 20,
  },
  startedLine: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    marginTop: 12,
    fontFamily: theme.fonts.main,
  },
  idleHint: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    marginTop: 12,
    textAlign: 'center',
    fontFamily: theme.fonts.main,
  },
  barTrack: {
    width: '100%',
    height: 10,
    borderRadius: 6,
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    marginTop: 32,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 6 },
  barFillReached: { backgroundColor: theme.colors.vibeGreen },
  goalRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  goalLabel: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontFamily: theme.fonts.main,
  },
  goalRemaining: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: theme.fonts.main,
  },
  goalReached: { color: theme.colors.vibeGreen },
  editLink: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginTop: 24,
    textDecorationLine: 'underline',
    fontFamily: theme.fonts.main,
  },
  sectionLabel: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 40,
    marginBottom: 12,
    fontFamily: theme.fonts.main,
  },
  goalPresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  goalChip: { minWidth: 64 },
  actions: { width: '100%', marginTop: 36 },
});
