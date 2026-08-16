import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Keyboard,
} from 'react-native';
import theme from '../theme/themes';
import VibeInput from './ui/VibeInput';
import VibeButton from './ui/VibeButton';
import VibeDropdown from './ui/VibeDropdown';
import VibeAlert from './ui/VibeAlert';
import { fmtStart } from '../lib/format';

// Reminder offsets, ported from bvs-app's ReminderListSection. The preset
// ladder, the template-id scheme ("15m", "1d", "2h"), the parse/format helpers
// and the validation rules are all kept identical, so reminder ids mean the
// same thing in both apps if they're ever unified.
//
// What's dropped is the bvs-specific plumbing: CustomTemplateService, the
// hosting/guest userContext split, the alert *context* (tracker's VibeAlert is
// a plain function) and add-to-calendar. This takes a plain value/onChange
// pair instead.

const PRESET_REMINDERS = [
  { amount: 15, unit: 'minutes', label: '15 min' },
  { amount: 30, unit: 'minutes', label: '30 min' },
  { amount: 1, unit: 'hours', label: '1 hour' },
  { amount: 2, unit: 'hours', label: '2 hours' },
  { amount: 1, unit: 'days', label: '1 day' },
  { amount: 1, unit: 'weeks', label: '1 week' },
];

const UNIT_MAP = { m: 'minutes', h: 'hours', d: 'days', w: 'weeks', x: 'months' };
const UNIT_ABBR = { minutes: 'm', hours: 'h', days: 'd', weeks: 'w', months: 'x' };

const UNIT_OPTIONS = [
  { label: 'Minutes', value: 'minutes' },
  { label: 'Hours', value: 'hours' },
  { label: 'Days', value: 'days' },
  { label: 'Weeks', value: 'weeks' },
  { label: 'Months', value: 'months' },
];

// Old-format ids from bvs, kept so a template written by that app still parses.
const OLD_ID_MAP = {
  '15min': { amount: 15, unit: 'minutes', label: '15 min' },
  '30min': { amount: 30, unit: 'minutes', label: '30 min' },
  '1hour': { amount: 1, unit: 'hours', label: '1 hour' },
  '2hour': { amount: 2, unit: 'hours', label: '2 hours' },
  '1day': { amount: 1, unit: 'days', label: '1 day' },
  '1week': { amount: 1, unit: 'weeks', label: '1 week' },
};

const MINUTES = {
  minutes: 1,
  hours: 60,
  days: 1440,
  weeks: 10080,
  months: 43200,
};

function unitLabel(amount, unit) {
  const labels = {
    minutes: 'min',
    hours: amount === 1 ? 'hour' : 'hours',
    days: amount === 1 ? 'day' : 'days',
    weeks: amount === 1 ? 'week' : 'weeks',
    months: amount === 1 ? 'month' : 'months',
  };
  return labels[unit] || unit;
}

export function parseTemplateId(templateId) {
  if (OLD_ID_MAP[templateId]) return { id: templateId, ...OLD_ID_MAP[templateId] };

  const match = String(templateId).match(/^(\d+)([mhdwx])$/);
  if (match) {
    const amount = parseInt(match[1], 10);
    const unit = UNIT_MAP[match[2]] || 'minutes';
    return { id: templateId, amount, unit, label: `${amount} ${unitLabel(amount, unit)}` };
  }
  return { id: templateId, amount: 0, unit: 'minutes', label: String(templateId) };
}

export function toMinutes(template) {
  return template.amount * (MINUTES[template.unit] || 1);
}

export function makeId(amount, unit) {
  return `${amount}${UNIT_ABBR[unit]}`;
}

/** Absolute fire time for a reminder id, given the due timestamp. */
export function remindAt(dueAtMs, templateId) {
  return dueAtMs - toMinutes(parseTemplateId(templateId)) * 60 * 1000;
}

export default function ItemReminders({
  value = [],
  onChange,
  dueAt,
  onPickDate,
  onClearDate,
  disabled,
}) {
  // A reminder is an offset counted back from the due moment, so a long
  // offset on a near date lands in the past. Those are refused rather than
  // silently accepted and never fired.
  const isPast = useCallback(
    (id) => dueAt != null && remindAt(dueAt, id) <= Date.now(),
    [dueAt]
  );

  const [showModal, setShowModal] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [customUnit, setCustomUnit] = useState('minutes');

  const active = value
    .map(parseTemplateId)
    .sort((a, b) => toMinutes(a) - toMinutes(b));

  const closeModal = useCallback(() => {
    setShowModal(false);
    setShowCustom(false);
    setCustomAmount('');
    setCustomUnit('minutes');
  }, []);

  const addId = useCallback(
    (id) => {
      if (value.includes(id)) return false;
      onChange([...value, id]);
      return true;
    },
    [value, onChange]
  );

  const addPreset = useCallback(
    (preset) => {
      addId(makeId(preset.amount, preset.unit));
      closeModal();
    },
    [addId, closeModal]
  );

  // Same validation as bvs: a positive integer under 1000, no duplicates.
  const addCustom = useCallback(() => {
    Keyboard.dismiss();
    const amount = parseInt(customAmount, 10);
    if (!customAmount?.trim() || !amount || amount <= 0) {
      VibeAlert('Invalid input', 'Enter a number greater than 0');
      return;
    }
    if (amount > 999) {
      VibeAlert('Invalid input', 'Enter a number less than 1000');
      return;
    }
    const id = makeId(amount, customUnit);
    if (value.includes(id)) {
      VibeAlert('Duplicate', `"${amount} ${unitLabel(amount, customUnit)}" already exists`);
      return;
    }
    if (isPast(id)) {
      VibeAlert(
        'Already passed',
        `${amount} ${unitLabel(amount, customUnit)} before this is in the past, so it would never fire.`
      );
      return;
    }
    addId(id);
    closeModal();
  }, [customAmount, customUnit, value, addId, closeModal, isPast]);

  const remove = useCallback(
    (id) => onChange(value.filter((v) => v !== id)),
    [value, onChange]
  );

  return (
    <>
      {/* One card, one heading. The date is the first row rather than its own
          titled section — reminders are offsets from it, so they belong to the
          same block. */}
      <View style={styles.card}>
        {dueAt == null ? (
          <TouchableOpacity onPress={onPickDate} style={styles.addRow}>
            <Text style={styles.addRowText}>+ Set date & time</Text>
          </TouchableOpacity>
        ) : (
          <>
            <View style={[styles.row, styles.rowBorder]}>
              <TouchableOpacity onPress={onPickDate} style={styles.dateMain}>
                <Text style={styles.rowLabel}>{fmtStart(dueAt)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onClearDate}
                style={styles.deleteBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {active.length === 0 && (
              <View style={[styles.row, styles.rowBorder]}>
                <Text style={styles.emptyText}>No reminders set</Text>
              </View>
            )}

            {active.map((template) => (
              <View key={template.id} style={[styles.row, styles.rowBorder]}>
                <Text style={styles.rowLabel}>{template.label} before</Text>
                <TouchableOpacity
                  onPress={() => remove(template.id)}
                  style={styles.deleteBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              onPress={() => setShowModal(true)}
              style={styles.addRow}
              disabled={disabled}
            >
              <Text style={styles.addRowText}>+ Add Reminder</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={closeModal}
        >
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Add Reminder</Text>

            <View style={styles.presetGrid}>
              {PRESET_REMINDERS.map((preset) => {
                const id = makeId(preset.amount, preset.unit);
                const taken = value.includes(id);
                // Dimmed rather than removed, so the ladder keeps its shape
                // as the date moves around.
                const past = isPast(id);
                const dim = taken || past;
                return (
                  <TouchableOpacity
                    key={id}
                    style={[styles.presetBtn, dim && styles.presetBtnActive]}
                    onPress={() => !dim && addPreset(preset)}
                    disabled={dim}
                  >
                    <Text
                      style={[styles.presetText, dim && styles.presetTextActive]}
                    >
                      {preset.label}
                    </Text>
                    {taken && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {!showCustom ? (
              <TouchableOpacity
                onPress={() => setShowCustom(true)}
                style={styles.customToggle}
              >
                <Text style={styles.customToggleText}>Custom Time</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.customForm}>
                <View style={styles.customRow}>
                  <VibeInput
                    value={customAmount}
                    onChangeText={(t) => setCustomAmount(t.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                    maxLength={3}
                    autoFocus
                    style={styles.customInput}
                    autoComplete="off"
                    textContentType="none"
                    autoCorrect={false}
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                  <VibeDropdown
                    options={UNIT_OPTIONS}
                    selectedValue={customUnit}
                    onSelect={setCustomUnit}
                    placeholder="Unit"
                    style={styles.customDropdown}
                    hideSelectedFromList
                  />
                </View>
                <VibeButton
                  label="Add Custom"
                  onPress={addCustom}
                  variant="toggle"
                  color="green"
                  disabled={!customAmount || parseInt(customAmount, 10) <= 0}
                  style={styles.customAddBtn}
                />
              </View>
            )}

            <TouchableOpacity onPress={closeModal} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// Styles ported from bvs-app's ReminderListSection so the two apps look the
// same. Only change: fontFamily uses theme.fonts.main, since tracker's theme
// has no comicBold.
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
  dateMain: {
    flex: 1,
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#001020',
    borderRadius: theme.sizes.borderRadius,
    borderWidth: 3,
    borderColor: theme.colors.vibeBlue,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: theme.fonts.main,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  presetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 198, 255, 0.1)',
    borderWidth: 2,
    borderColor: theme.colors.vibeBlue,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 90,
    justifyContent: 'center',
  },
  presetBtnActive: {
    backgroundColor: 'rgba(0, 198, 255, 0.05)',
    borderColor: theme.colors.inputBorder,
  },
  presetText: {
    color: theme.colors.vibeBlue,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: theme.fonts.main,
  },
  presetTextActive: {
    color: theme.colors.textSecondary,
  },
  checkmark: {
    color: theme.colors.vibeGreen,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.inputBorder,
  },
  dividerText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginHorizontal: 12,
    fontFamily: theme.fonts.main,
  },
  customToggle: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  customToggleText: {
    color: theme.colors.vibeCyan,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: theme.fonts.main,
  },
  customForm: {
    gap: 12,
  },
  customRow: {
    flexDirection: 'row',
    gap: 12,
    zIndex: 99,
    elevation: 99,
  },
  customInput: {
    width: 70,
    textAlign: 'center',
  },
  customDropdown: {
    flex: 1,
  },
  customAddBtn: {
    marginTop: 4,
  },
  cancelBtn: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  cancelText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
    fontFamily: theme.fonts.main,
  },
});
