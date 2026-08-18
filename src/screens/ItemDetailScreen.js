import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import theme from '../theme/themes';
import VibeInput from '../components/ui/VibeInput';
import VibeAlert from '../components/ui/VibeAlert';
import ScreenHeader from '../components/ScreenHeader';
import ItemReminders, { normalizeReminders } from '../components/ItemReminders';
import { useTrackers } from '../store/TrackerContext';
import { useAuth } from '../store/AuthContext';
import { ensurePushPermission } from '../services/fcm';
import {
  syncItemReminders,
  clearItemReminders,
  syncGoalReminder,
} from '../services/reminders';
import GoalModal from '../components/GoalModal';
import VibeButton from '../components/ui/VibeButton';
import { useNow } from '../lib/useNow';
import { fmtElapsed } from '../lib/format';
import { resolveColor, fmtStart } from '../lib/format';

// Goals can be fractional, so 1.5 has to read as "1h 30m".
function fmtGoal(hours) {
  if (!hours) return '—';
  const whole = Math.floor(hours);
  const mins = Math.round((hours - whole) * 60);
  if (!whole) return `${mins}m`;
  return mins ? `${whole}h ${mins}m` : `${whole}h`;
}

export default function ItemDetailScreen({ tracker, item, onBack }) {
  // Ticking off lives on the list screen's checkbox, not here.
  const { updateItemIn, removeItemFrom } = useTrackers();
  const { uid } = useAuth();

  const [text, setText] = useState(item.text ?? '');
  const [note, setNote] = useState(item.note ?? '');
  const [reminders, setReminders] = useState(normalizeReminders(item.reminders));
  const [goalOpen, setGoalOpen] = useState(false);

  const color = resolveColor(tracker.color);

  // An item can carry a timer of its own — a gym session, a meditation, a
  // night's sleep — rather than having to become its own tracker.
  const hasTimer = item.goalHours != null || item.startMs != null;
  const timerRunning = item.startMs != null;
  const now = useNow(timerRunning);
  const elapsedMs = timerRunning ? now - item.startMs : 0;
  const goalMs = (item.goalHours || 0) * 3600 * 1000;
  const reachedGoal = goalMs > 0 && elapsedMs >= goalMs;

  // Written straight through rather than through the autosave draft: these are
  // button presses, not typing, so there's nothing to debounce.
  const applyTimer = useCallback(
    (patch) => {
      updateItemIn(tracker, item.id, patch);
      syncGoalReminder({
        tracker,
        uid,
        // Distinct from the parent tracker's own goal alarm, which would
        // otherwise share an id and overwrite this one.
        key: `item_${item.id}`,
        label: item.text,
        startMs: 'startMs' in patch ? patch.startMs : item.startMs,
        goalHours: 'goalHours' in patch ? patch.goalHours : item.goalHours,
      });
    },
    [tracker, item, uid, updateItemIn]
  );

  // Re-seed when a different item is opened, or when someone else edits this
  // one on a shared list. Local edits in progress are intentionally not
  // clobbered mid-keystroke — this only fires when the stored value changes.
  useEffect(() => {
    setText(item.text ?? '');
  }, [item.id, item.text]);

  useEffect(() => {
    setNote(item.note ?? '');
  }, [item.id, item.note]);

  // Compared by contents, not by identity. item.reminders is an array, and a
  // fresh one arrives on every Firestore snapshot and every local tracker
  // update — so depending on the array itself re-ran this effect constantly
  // and wiped a reminder the moment it was added, before autosave could store
  // it. Text and note are strings and don't have this problem.
  const storedReminderKey = normalizeReminders(item.reminders).join(',');
  useEffect(() => {
    setReminders(normalizeReminders(item.reminders));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, storedReminderKey]);

  // What still differs from what's stored. Drives the Save button, so there's
  // a visible answer to "did that save?".
  const pendingText = text.trim();
  const pendingNote = note.trim();
  const storedReminders = normalizeReminders(item.reminders);
  const sameReminders =
    reminders.length === storedReminders.length &&
    reminders.every((r) => storedReminders.includes(r));
  const dirty =
    (!!pendingText && pendingText !== item.text) ||
    pendingNote !== (item.note ?? '') ||
    !sameReminders;

  // Writes are batched rather than per-keystroke: on a shared list every
  // character would otherwise be a Firestore write, and a sync to the other
  // person's screen.
  const save = useCallback(() => {
    const patch = {};
    const t = text.trim();
    const n = note.trim();
    // An empty name would leave an unidentifiable row, so a blank reverts
    // instead of saving.
    if (t && t !== item.text) patch.text = t;
    if (n !== (item.note ?? '')) patch.note = n;
    if (!sameReminders) patch.reminders = reminders;

    if (Object.keys(patch).length) updateItemIn(tracker, item.id, patch);

    // Reconciled unconditionally, not only when something changed. Alarms
    // listed on an item are not proof that the matching documents exist — an
    // item carrying alarms with nothing scheduled could otherwise never
    // repair itself. Re-writing identical docs is harmless; ids are
    // deterministic.
    syncItemReminders({
      tracker,
      item,
      uid,
      previous: storedReminders,
      reminders,
    });
  }, [text, note, reminders, storedReminders, sameReminders, item, tracker, uid, updateItemIn]);

  const flushRef = useRef(save);
  flushRef.current = save;
  const skipFlushRef = useRef(false);

  // Don't resurrect an item that was just deleted — on a shared list that
  // write would recreate the document.
  const flushNow = useCallback(() => {
    if (!skipFlushRef.current) flushRef.current();
  }, []);

  // Autosave once typing has stopped, so there's nothing to press. The delay
  // is what stops this being a Firestore write per keystroke.
  useEffect(() => {
    if (!dirty) return undefined;
    const timer = setTimeout(flushNow, 2000);
    // Deps are the edited values, deliberately, not `save`. `save` gets a new
    // identity on every render, so depending on it restarted this timer on any
    // unrelated re-render — and on a shared list, incoming snapshots re-render
    // often enough that the timer could keep resetting and never fire.
    return () => clearTimeout(timer);
  }, [dirty, flushNow, text, note, reminders]);

  // Two safety nets, because the timer alone loses work in two real cases.
  // Unmount covers hardware back and the header chevron, which tear the screen
  // down mid-delay. Leaving the foreground covers the app being closed or
  // swiped away before the timer fires — at which point the process dies and
  // neither the timer nor the unmount cleanup would ever run.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') flushNow();
    });
    return () => sub.remove();
  }, [flushNow]);

  useEffect(() => () => flushNow(), [flushNow]);

  const confirmDelete = useCallback(() => {
    VibeAlert('Delete item', `Delete "${item.text}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          skipFlushRef.current = true;
          onBack();
          removeItemFrom(tracker, item.id);
          // Otherwise a deleted item still buzzes you next week.
          clearItemReminders(item.id, normalizeReminders(item.reminders));
        },
      },
    ]);
  }, [item, tracker, removeItemFrom, onBack]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScreenHeader
        title={tracker.name}
        color={color}
        onBack={onBack}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.label}>Item</Text>
          <VibeInput
            value={text}
            onChangeText={setText}
            onBlur={save}
            placeholder="Item"
            maxLength={120}
            autoCapitalize="sentences"
          />

          <Text style={styles.label}>Notes</Text>
          <VibeInput
            value={note}
            onChangeText={setNote}
            onBlur={save}
            placeholder="Brand, size, aisle — anything worth remembering"
            multiline
            maxLength={500}
            autoCapitalize="sentences"
            style={styles.note}
          />

          <Text style={styles.label}>Repeat</Text>
          <View style={styles.repeatRow}>
            {[
              { value: null, label: 'Never' },
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
            ].map((option) => (
              <VibeButton
                key={option.label}
                label={option.label}
                variant="toggle"
                color={(item.repeat ?? null) === option.value ? 'green' : 'gray'}
                onPress={() =>
                  updateItemIn(tracker, item.id, { repeat: option.value })
                }
                style={styles.repeatChip}
              />
            ))}
          </View>
          {item.repeat ? (
            <Text style={styles.repeatHint}>
              Un-ticks itself {item.repeat === 'daily' ? 'each day' : 'each Monday'}.
            </Text>
          ) : null}

          <Text style={styles.label}>Timer</Text>
          {!hasTimer ? (
            <Pressable onPress={() => applyTimer({ goalHours: 1 })} hitSlop={8}>
              <Text style={styles.addLink}>Add a timer</Text>
            </Pressable>
          ) : (
            <View style={styles.timerBox}>
              <Text style={[styles.elapsed, reachedGoal && { color: theme.colors.vibeGreen }]}>
                {fmtElapsed(elapsedMs)}
              </Text>

              <Pressable onPress={() => setGoalOpen(true)} hitSlop={8}>
                <Text style={styles.goalLine}>
                  Goal {fmtGoal(item.goalHours)} ✎
                </Text>
              </Pressable>

              <View style={styles.timerActions}>
                <VibeButton
                  label={timerRunning ? 'Stop' : 'Start'}
                  variant={timerRunning ? 'red' : 'green'}
                  onPress={() =>
                    applyTimer({ startMs: timerRunning ? null : Date.now() })
                  }
                />
                <Pressable
                  onPress={() => applyTimer({ startMs: null, goalHours: null })}
                  hitSlop={8}
                >
                  <Text style={styles.removeTimer}>Remove timer</Text>
                </Pressable>
              </View>
            </View>
          )}

          <Text style={styles.label}>Reminders</Text>
          <ItemReminders
            value={reminders}
            onChange={(next) => {
              // Asking here is self-explanatory: the user has just said they
              // want to be told about something.
              if (next.length > reminders.length) ensurePushPermission(uid);
              setReminders(next);
            }}
          />

          <View style={styles.meta}>
            {item.createdAt ? (
              <Text style={styles.metaLine}>Added {fmtStart(item.createdAt)}</Text>
            ) : null}
            {item.done && item.doneAt ? (
              <Text style={styles.metaLine}>
                Completed {fmtStart(item.doneAt)}
              </Text>
            ) : null}
          </View>

          <Pressable onPress={confirmDelete} hitSlop={8}>
            <Text style={styles.delete}>Delete item</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <GoalModal
        visible={goalOpen}
        initialHours={item.goalHours}
        onClose={() => setGoalOpen(false)}
        onSubmit={(hours) => applyTimer({ goalHours: hours })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
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
  note: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  repeatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  repeatChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  repeatHint: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginTop: 8,
    fontFamily: theme.fonts.main,
  },
  addLink: {
    color: theme.colors.vibeBlue,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: theme.fonts.main,
  },
  timerBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 3,
    borderColor: theme.colors.vibeBlue,
    borderRadius: theme.sizes.borderRadius,
    padding: 16,
    alignItems: 'center',
  },
  elapsed: {
    color: theme.colors.textPrimary,
    fontSize: 40,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
    fontFamily: theme.fonts.main,
  },
  goalLine: {
    color: theme.colors.vibeCyan,
    fontSize: 14,
    marginTop: 6,
    fontFamily: theme.fonts.main,
  },
  timerActions: {
    alignSelf: 'stretch',
    marginTop: 14,
  },
  removeTimer: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    textDecorationLine: 'underline',
    fontFamily: theme.fonts.main,
  },
  meta: {
    marginTop: 26,
  },
  metaLine: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginBottom: 4,
    fontFamily: theme.fonts.main,
  },
  delete: {
    color: theme.colors.vibeRed,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 30,
    fontFamily: theme.fonts.main,
  },
});
