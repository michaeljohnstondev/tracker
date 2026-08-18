import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import theme from '../theme/themes';
import VibeAlert from './ui/VibeAlert';
import VibeCalendar from './ui/VibeCalendar';
import VibeTimePicker from './ui/VibeTimePicker';
import { fmtStart } from '../lib/format';

// Alarms on an item, stored as absolute timestamps.
//
// This started as a port of bvs-app's ReminderListSection, which expresses
// reminders as offsets before an event — "1 day before", "2 hours before".
// That's right for an event, which has its own time independent of any
// reminder. An item on a list has no such time: the moment you want telling
// about it IS the thing. Offsets forced two values to express one, and made
// "remind me Saturday morning" a subtraction problem.
//
// So the offset ladder is gone. You pick the moment, the way you'd set an
// alarm. Several are allowed, since "the day before" and "an hour before" is
// a reasonable thing to want — you just say when each one is.

// Anything already stored in the old shape (offset ids against a due date) is
// discarded rather than half-converted. Only ever a handful of test entries,
// and a silently wrong alarm time is worse than none.
export function normalizeReminders(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === 'number' && Number.isFinite(v));
}

export default function ItemReminders({ value = [], onChange }) {
  const [stage, setStage] = useState(null);
  const [pendingDate, setPendingDate] = useState(null);
  // The reminder being changed, or null when adding a new one. Editing and
  // adding are the same two-step pick; the only difference is whether the old
  // time makes way for the new one.
  const [editing, setEditing] = useState(null);

  const times = normalizeReminders(value).slice().sort((a, b) => a - b);

  const open = useCallback(() => {
    setEditing(null);
    setPendingDate(new Date());
    setStage('date');
  }, []);

  const edit = useCallback((at) => {
    setEditing(at);
    setPendingDate(new Date(at));
    setStage('date');
  }, []);

  const onDate = useCallback((date) => {
    setPendingDate(date);
    setStage('time');
  }, []);

  const onTime = useCallback(
    (time) => {
      setStage(null);
      const base = pendingDate ?? new Date();
      const at = new Date(
        base.getFullYear(),
        base.getMonth(),
        base.getDate(),
        time.getHours(),
        time.getMinutes(),
        0,
        0
      ).getTime();

      if (at <= Date.now()) {
        VibeAlert(
          'That time has passed',
          'Pick a moment in the future, or the alarm would never go off.'
        );
        return;
      }

      const without = editing != null ? times.filter((t) => t !== editing) : times;
      if (without.includes(at)) {
        // Already set for that moment. Dropping the one being edited would
        // silently delete it, so leave things as they were.
        onChange(without.length === times.length ? times : [...without, at].sort((a, b) => a - b));
        setEditing(null);
        return;
      }

      onChange([...without, at].sort((a, b) => a - b));
      setEditing(null);
    },
    [pendingDate, times, editing, onChange]
  );

  const remove = useCallback(
    (at) => onChange(times.filter((t) => t !== at)),
    [times, onChange]
  );

  return (
    <>
      <View style={styles.card}>
        {times.length === 0 && (
          <View style={[styles.row, styles.rowBorder]}>
            <Text style={styles.emptyText}>No reminders set</Text>
          </View>
        )}

        {times.map((at) => (
          <View key={at} style={[styles.row, styles.rowBorder]}>
            {/* Tapping the time changes it; the ✕ stays a separate target so
                you can't delete one by aiming badly. */}
            <TouchableOpacity onPress={() => edit(at)} style={styles.rowMain}>
              <Text style={styles.rowLabel}>{fmtStart(at)}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => remove(at)}
              style={styles.deleteBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.deleteBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity onPress={open} style={styles.addRow}>
          <Text style={styles.addRowText}>+ Add Reminder</Text>
        </TouchableOpacity>
      </View>

      {/* Mounted only while open: VibeCalendar seeds its selection once, so a
          persistent instance would reopen on the previous pick. */}
      {stage === 'date' && (
        <VibeCalendar
          visible
          initialDate={pendingDate}
          minimumDate={new Date()}
          onConfirm={onDate}
          onClose={() => setStage(null)}
        />
      )}

      <VibeTimePicker
        visible={stage === 'time'}
        onClose={() => setStage(null)}
        onConfirm={onTime}
        initialTime={pendingDate}
        confirmText="Set"
      />
    </>
  );
}

// Card and row styling ported from bvs-app's ReminderListSection, with
// fontFamily on theme.fonts.main since tracker's theme has no comicBold.
const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: theme.sizes.borderRadius,
    borderWidth: 3,
    borderColor: theme.colors.vibeBlue,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.inputBorder,
  },
  rowMain: { flex: 1 },
  rowLabel: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '500',
    fontFamily: theme.fonts.main,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
    fontFamily: theme.fonts.main,
  },
  deleteBtn: {
    padding: 4,
  },
  deleteBtnText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  addRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  addRowText: {
    color: theme.colors.vibeBlue,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: theme.fonts.main,
  },
});
