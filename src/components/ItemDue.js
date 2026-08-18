import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import theme from '../theme/themes';
import VibeCalendar from './ui/VibeCalendar';
import VibeTimePicker from './ui/VibeTimePicker';
import { fmtStart } from '../lib/format';

/**
 * A due date, and the list that should surface the item when it arrives.
 *
 * The second half is the interesting one. "Port it to my High Priority list"
 * sounds like moving, but moving would throw away where the item actually
 * belongs — and once it was done there'd be nowhere to put it back. So it
 * stays exactly where it is and the other list shows it as well, for as long
 * as it's due and unfinished.
 *
 * Picking the moment is the same two-step as a reminder, deliberately: they're
 * the same gesture and shouldn't feel like different features.
 */
export default function ItemDue({ dueAt, dueTo, targets, onChange }) {
  const [stage, setStage] = useState(null);
  const [pendingDate, setPendingDate] = useState(null);

  const openDate = useCallback(() => {
    setPendingDate(dueAt ? new Date(dueAt) : new Date());
    setStage('date');
  }, [dueAt]);

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
      // A due date in the past is allowed, unlike a reminder — you can be late
      // for something, and saying so is the whole point of "overdue".
      onChange({ dueAt: at, dueTo });
    },
    [pendingDate, dueTo, onChange]
  );

  const chosen = targets.find((t) => t.id === dueTo);

  return (
    <>
      <View style={styles.card}>
        <View style={[styles.row, styles.rowBorder]}>
          <Text style={styles.rowLabel}>Due</Text>
          <TouchableOpacity onPress={openDate} hitSlop={8}>
            <Text style={styles.rowValue}>
              {dueAt ? fmtStart(dueAt) : 'Pick a date'} ✎
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Show in</Text>
          <TouchableOpacity onPress={() => setStage('target')} hitSlop={8}>
            <Text style={styles.rowValue}>{chosen ? chosen.name : 'Nowhere'} ›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {chosen && dueAt ? (
        <Text style={styles.hint}>
          Stays where it is. “{chosen.name}” shows it too, from{' '}
          {fmtStart(dueAt)} until it's ticked off.
        </Text>
      ) : null}

      {/* Mounted only while open: VibeCalendar seeds its selection once, so a
          persistent instance would reopen on the previous pick. */}
      {stage === 'date' && (
        <VibeCalendar
          visible
          initialDate={pendingDate}
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

      <Modal
        visible={stage === 'target'}
        transparent
        animationType="slide"
        onRequestClose={() => setStage(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setStage(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Show this in</Text>

            <TouchableOpacity
              onPress={() => {
                setStage(null);
                onChange({ dueAt, dueTo: null });
              }}
              style={styles.option}
            >
              <Text style={[styles.optionLabel, !dueTo && styles.optionChosen]}>
                Nowhere
              </Text>
            </TouchableOpacity>

            {targets.map((target) => (
              <TouchableOpacity
                key={target.id}
                onPress={() => {
                  setStage(null);
                  onChange({ dueAt, dueTo: target.id });
                }}
                style={styles.option}
              >
                <Text
                  style={[
                    styles.optionLabel,
                    dueTo === target.id && styles.optionChosen,
                  ]}
                >
                  {target.name}
                </Text>
              </TouchableOpacity>
            ))}

            <Pressable onPress={() => setStage(null)} hitSlop={8}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

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
  rowBorder: { borderBottomWidth: 1, borderBottomColor: theme.colors.inputBorder },
  rowLabel: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    fontFamily: theme.fonts.main,
  },
  rowValue: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '500',
    fontFamily: theme.fonts.main,
  },
  hint: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    fontFamily: theme.fonts.main,
  },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
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
  sheetTitle: {
    color: theme.colors.vibeCyan,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    fontFamily: theme.fonts.main,
  },
  option: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.inputBorder,
  },
  optionLabel: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: theme.fonts.main,
  },
  optionChosen: { color: theme.colors.vibeGreen, fontWeight: '700' },
  cancel: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 16,
    fontFamily: theme.fonts.main,
  },
});
