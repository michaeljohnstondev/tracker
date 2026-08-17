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
import ShareListModal from '../components/ShareListModal';
import TrackerMenu from '../components/TrackerMenu';
import GoalModal from '../components/GoalModal';
import { useTrackers } from '../store/TrackerContext';
import { useAuth } from '../store/AuthContext';
import { syncGoalReminder } from '../services/reminders';
import { useNow } from '../lib/useNow';
import {
  fmtElapsed,
  fmtStart,
  fmtRemaining,
  resolveColor,
} from '../lib/format';

// A spread across the range a timer might plausibly cover — meditation at a
// quarter hour, a gym session, a feeding window, a fast, a full day — rather
// than the fasting-only ladder this started with.
const GOAL_PRESETS = [0.25, 0.5, 1, 4, 8, 16];

// Goals can be fractional now, so 1.5 has to read as "1h 30m" rather than
// "1.5h".
function fmtGoal(hours) {
  if (!hours) return '—';
  const whole = Math.floor(hours);
  const mins = Math.round((hours - whole) * 60);
  if (!mins) return `${whole}h`;
  return whole ? `${whole}h ${mins}m` : `${mins}m`;
}

export default function TimerDetailScreen({ tracker, onBack, onOpenTracker }) {
  const { updateTrackerFields, renameTracker, finalizeShare, deleteTracker } =
    useTrackers();
  const { uid } = useAuth();
  const [sharing, setSharing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Setting a start time is two steps — date, then time — so that a fast
  // running longer than a day can still be corrected. null means closed.
  const [pickerStage, setPickerStage] = useState(null);
  const [pendingDate, setPendingDate] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);

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

  // Every change to when the timer started or what it's aiming at moves the
  // finish line, so the alarm is rewritten alongside it rather than in an
  // effect — an effect would fire again on every incoming snapshot of a
  // shared timer and rewrite the same document endlessly.
  const applyTimer = useCallback(
    (patch) => {
      updateTrackerFields(tracker, patch);
      syncGoalReminder({
        tracker,
        uid,
        startMs: 'startMs' in patch ? patch.startMs : tracker.startMs,
        goalHours: 'goalHours' in patch ? patch.goalHours : tracker.goalHours,
      });
    },
    [tracker, uid, updateTrackerFields]
  );

  const startNow = useCallback(
    () => applyTimer({ startMs: Date.now() }),
    [applyTimer]
  );

  const stopReset = useCallback(() => applyTimer({ startMs: null }), [applyTimer]);

  const pickGoal = useCallback((h) => applyTimer({ goalHours: h }), [applyTimer]);

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
      applyTimer({ startMs: ms });
    },
    [pendingDate, applyTimer]
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
        onMenu={() => setMenuOpen(true)}
      />

      {tracker.shared && (
        <Text style={styles.sharedNote}>Shared · changes sync live</Text>
      )}

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
                  {/* Editable while running: you often only realise the goal
                      is wrong once the clock is already going. */}
                  <Pressable onPress={() => setGoalOpen(true)} hitSlop={8}>
                    <Text style={[styles.goalLabel, styles.goalEditable]}>
                      Goal {fmtGoal(goalHours)} ✎
                    </Text>
                  </Pressable>
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
                {/* The actual finish time, so you never have to add hours to
                    a start time in your head. */}
                <Text style={styles.endsAt}>
                  Ends {fmtStart(tracker.startMs + goalMs)}
                </Text>
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
                  label={fmtGoal(h)}
                  variant="toggle"
                  color={h === goalHours ? 'green' : 'gray'}
                  onPress={() => pickGoal(h)}
                  style={styles.goalChip}
                />
              ))}
              {/* Presets can't cover every use — a feeding window, a
                  20-minute meditation — so anything is typeable. */}
              <VibeButton
                label={
                  goalHours && !GOAL_PRESETS.includes(goalHours)
                    ? fmtGoal(goalHours)
                    : 'Custom'
                }
                variant="toggle"
                color={
                  goalHours && !GOAL_PRESETS.includes(goalHours) ? 'green' : 'gray'
                }
                onPress={() => setGoalOpen(true)}
                style={styles.goalChip}
              />
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

      <ShareListModal
        visible={sharing}
        tracker={tracker}
        onClose={(result) => {
          setSharing(false);
          if (!result?.publishedId) return;
          // Move to the shared copy before the local one is removed, so
          // nothing is left pointing at a tracker that no longer exists.
          onOpenTracker?.(`remote:${result.publishedId}`);
          finalizeShare(result.localId);
        }}
      />

      <GoalModal
        visible={goalOpen}
        initialHours={tracker.goalHours}
        onClose={() => setGoalOpen(false)}
        onSubmit={pickGoal}
      />

      <TrackerMenu
        visible={menuOpen}
        tracker={tracker}
        onClose={() => setMenuOpen(false)}
        onRename={() => setRenaming(true)}
        onShare={() => setSharing(true)}
        onDelete={confirmDelete}
      />

      <RenameModal
        visible={renaming}
        tracker={tracker}
        initialName={tracker.name}
        initialParentId={tracker.parentId}
        onClose={() => setRenaming(false)}
        onSubmit={(name, parentId) => renameTracker(tracker, name, parentId)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  sharedNote: {
    color: theme.colors.vibeCyan,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: -4,
    marginBottom: 4,
    fontFamily: theme.fonts.main,
  },
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
  goalEditable: { color: theme.colors.vibeCyan },
  endsAt: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginTop: 8,
    alignSelf: 'flex-start',
    fontFamily: theme.fonts.main,
  },
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
