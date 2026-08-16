import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import theme from '../theme/themes';
import VibeInput from '../components/ui/VibeInput';
import VibeButton from '../components/ui/VibeButton';
import VibeAlert from '../components/ui/VibeAlert';
import ScreenHeader from '../components/ScreenHeader';
import VibeCalendar from '../components/ui/VibeCalendar';
import VibeTimePicker from '../components/ui/VibeTimePicker';
import ItemReminders, { remindAt } from '../components/ItemReminders';
import { useTrackers } from '../store/TrackerContext';
import { resolveColor, fmtStart } from '../lib/format';

export default function ItemDetailScreen({ tracker, item, onBack }) {
  const { updateItemIn, toggleItemIn, removeItemFrom } = useTrackers();

  const [text, setText] = useState(item.text ?? '');
  const [note, setNote] = useState(item.note ?? '');
  const [dueAt, setDueAt] = useState(item.dueAt ?? null);
  const [reminders, setReminders] = useState(item.reminders ?? []);
  // null | 'date' | 'time' — due dates are picked in two steps, same as a
  // fast's start time.
  const [dueStage, setDueStage] = useState(null);
  const [pendingDue, setPendingDue] = useState(null);

  const color = resolveColor(tracker.color);

  // Re-seed when a different item is opened, or when someone else edits this
  // one on a shared list. Local edits in progress are intentionally not
  // clobbered mid-keystroke — this only fires when the stored value changes.
  useEffect(() => {
    setText(item.text ?? '');
  }, [item.id, item.text]);

  useEffect(() => {
    setNote(item.note ?? '');
  }, [item.id, item.note]);

  useEffect(() => {
    setDueAt(item.dueAt ?? null);
  }, [item.id, item.dueAt]);

  useEffect(() => {
    setReminders(item.reminders ?? []);
  }, [item.id, item.reminders]);

  const openDuePicker = useCallback(() => {
    setPendingDue(dueAt != null ? new Date(dueAt) : new Date());
    setDueStage('date');
  }, [dueAt]);

  const onDueDate = useCallback((date) => {
    setPendingDue(date);
    setDueStage('time');
  }, []);

  const onDueTime = useCallback(
    (time) => {
      setDueStage(null);
      const base = pendingDue ?? new Date();
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
      // Picking today then a time earlier than now is the easy mistake the
      // calendar's date floor can't catch.
      if (ms <= Date.now()) {
        VibeAlert(
          'That time has passed',
          'Pick a moment in the future, or nothing would ever fire.'
        );
        return;
      }
      setDueAt(ms);
      // Drop any offsets that the new, nearer date has pushed into the past.
      setReminders((prev) => prev.filter((id) => remindAt(ms, id) > Date.now()));
    },
    [pendingDue]
  );

  const clearDue = useCallback(() => {
    setDueAt(null);
    // Reminders are offsets from the due date; without one they'd have
    // nothing to count back from.
    setReminders([]);
  }, []);

  // What still differs from what's stored. Drives the Save button, so there's
  // a visible answer to "did that save?".
  const pendingText = text.trim();
  const pendingNote = note.trim();
  const sameReminders =
    reminders.length === (item.reminders ?? []).length &&
    reminders.every((r) => (item.reminders ?? []).includes(r));
  const dirty =
    (!!pendingText && pendingText !== item.text) ||
    pendingNote !== (item.note ?? '') ||
    dueAt !== (item.dueAt ?? null) ||
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
    if (dueAt !== (item.dueAt ?? null)) patch.dueAt = dueAt;
    if (!sameReminders) patch.reminders = reminders;
    if (Object.keys(patch).length) updateItemIn(tracker, item.id, patch);
  }, [text, note, dueAt, reminders, sameReminders, item, tracker, updateItemIn]);

  // Flush on the way out. Blur alone isn't enough: hardware back and the
  // header chevron can both tear this screen down while the field still has
  // focus, and a note typed but never blurred would just evaporate.
  const flushRef = useRef(save);
  flushRef.current = save;
  const skipFlushRef = useRef(false);

  useEffect(
    () => () => {
      // Don't resurrect an item that was just deleted — on a shared list that
      // write would recreate the document.
      if (!skipFlushRef.current) flushRef.current();
    },
    []
  );

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
        onDelete={confirmDelete}
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

          <Text style={styles.label}>When</Text>
          {dueAt != null ? (
            <View style={styles.dueRow}>
              <Pressable onPress={openDuePicker} hitSlop={8} style={styles.dueMain}>
                <Text style={styles.dueText}>{fmtStart(dueAt)}</Text>
              </Pressable>
              <Pressable onPress={clearDue} hitSlop={10}>
                <Text style={styles.dueClear}>✕</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={openDuePicker} hitSlop={8}>
              <Text style={styles.addLink}>+ Set a date & time</Text>
            </Pressable>
          )}

          <Text style={styles.label}>Remind me before</Text>
          {dueAt == null ? (
            <Text style={styles.remindersHint}>
              Set a date and time first.
            </Text>
          ) : (
            <ItemReminders
              value={reminders}
              onChange={setReminders}
              dueAt={dueAt}
            />
          )}

          <View style={styles.saveRow}>
            {dirty ? (
              <VibeButton label="Save" variant="green" onPress={save} />
            ) : (
              <Text style={styles.savedHint}>Saved</Text>
            )}
          </View>

          <View style={styles.actions}>
            <VibeButton
              label={item.done ? 'Mark as not done' : 'Mark as done'}
              variant={item.done ? 'default' : 'green'}
              onPress={() => toggleItemIn(tracker, item.id)}
            />
          </View>

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

      {/* Mounted only while open: VibeCalendar seeds its selection once, so a
          persistent instance would reopen on the previous pick. */}
      {dueStage === 'date' && (
        <VibeCalendar
          visible
          initialDate={pendingDue}
          minimumDate={new Date()}
          onConfirm={onDueDate}
          onClose={() => setDueStage(null)}
        />
      )}

      <VibeTimePicker
        visible={dueStage === 'time'}
        onClose={() => setDueStage(null)}
        onConfirm={onDueTime}
        initialTime={pendingDue}
        confirmText="Set"
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
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: theme.sizes.borderRadius,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  dueMain: { flex: 1 },
  dueText: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontFamily: theme.fonts.main,
  },
  dueClear: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    paddingLeft: 12,
  },
  addLink: {
    color: theme.colors.vibeCyan,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: theme.fonts.main,
  },
  remindersHint: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontFamily: theme.fonts.main,
  },
  saveRow: {
    marginTop: 16,
    minHeight: 24,
    justifyContent: 'center',
  },
  savedHint: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    fontFamily: theme.fonts.main,
  },
  actions: {
    marginTop: 26,
    alignItems: 'stretch',
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
