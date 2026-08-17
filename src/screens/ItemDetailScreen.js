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
import { syncItemReminders, clearItemReminders } from '../services/reminders';
import { resolveColor, fmtStart } from '../lib/format';

export default function ItemDetailScreen({ tracker, item, onBack }) {
  // Ticking off lives on the list screen's checkbox, not here.
  const { updateItemIn, removeItemFrom } = useTrackers();
  const { uid } = useAuth();

  const [text, setText] = useState(item.text ?? '');
  const [note, setNote] = useState(item.note ?? '');
  const [reminders, setReminders] = useState(normalizeReminders(item.reminders));

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
