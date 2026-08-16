import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Keyboard,
} from 'react-native';
import theme from '../theme/themes';
import VibeInput from './ui/VibeInput';
import VibeButton from './ui/VibeButton';
import VibeDropdown from './ui/VibeDropdown';
import VibeAlert from './ui/VibeAlert';
import { useKeyboardHeight } from '../lib/useKeyboardHeight';

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

export default function ItemReminders({ value = [], onChange, disabled }) {
  const [showModal, setShowModal] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [customUnit, setCustomUnit] = useState('minutes');
  const keyboardHeight = useKeyboardHeight();

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
    addId(id);
    closeModal();
  }, [customAmount, customUnit, value, addId, closeModal]);

  const remove = useCallback(
    (id) => onChange(value.filter((v) => v !== id)),
    [value, onChange]
  );

  const isPresetActive = (preset) => value.includes(makeId(preset.amount, preset.unit));

  return (
    <View>
      {active.length === 0 ? (
        <Text style={styles.empty}>No reminders</Text>
      ) : (
        active.map((template) => (
          <View key={template.id} style={styles.row}>
            <Text style={styles.rowText}>{template.label} before</Text>
            <Pressable onPress={() => remove(template.id)} hitSlop={10}>
              <Text style={styles.remove}>✕</Text>
            </Pressable>
          </View>
        ))
      )}

      <Pressable onPress={() => setShowModal(true)} hitSlop={8} disabled={disabled}>
        <Text style={[styles.add, disabled && styles.addDisabled]}>
          + Add reminder
        </Text>
      </Pressable>

      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.overlay} onPress={closeModal}>
          <Pressable
            style={[styles.sheet, { paddingBottom: 34 + keyboardHeight }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.title}>Add a reminder</Text>

            {!showCustom ? (
              <>
                <View style={styles.presets}>
                  {PRESET_REMINDERS.map((preset) => {
                    const taken = isPresetActive(preset);
                    return (
                      <VibeButton
                        key={`${preset.amount}${preset.unit}`}
                        label={preset.label}
                        variant="toggle"
                        color={taken ? 'green' : 'gray'}
                        disabled={taken}
                        onPress={() => addPreset(preset)}
                        style={styles.presetChip}
                      />
                    );
                  })}
                </View>
                <Pressable onPress={() => setShowCustom(true)} hitSlop={8}>
                  <Text style={styles.customLink}>Custom…</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.label}>How long before?</Text>
                <View style={styles.customRow}>
                  <VibeInput
                    value={customAmount}
                    onChangeText={setCustomAmount}
                    placeholder="10"
                    keyboardType="number-pad"
                    maxLength={3}
                    autoFocus
                    style={styles.amountInput}
                  />
                  <View style={styles.unitPicker}>
                    <VibeDropdown
                      options={UNIT_OPTIONS}
                      selectedValue={customUnit}
                      onSelect={setCustomUnit}
                    />
                  </View>
                </View>
                <View style={styles.actions}>
                  <VibeButton label="Add" variant="green" onPress={addCustom} />
                </View>
              </>
            )}

            <Pressable onPress={closeModal} hitSlop={8}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    fontFamily: theme.fonts.main,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: theme.sizes.borderRadius,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  rowText: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontFamily: theme.fonts.main,
  },
  remove: {
    color: theme.colors.textSecondary,
    fontSize: 16,
  },
  add: {
    color: theme.colors.vibeCyan,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 6,
    fontFamily: theme.fonts.main,
  },
  addDisabled: {
    color: theme.colors.textSecondary,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: theme.colors.inputBorder,
    paddingHorizontal: 24,
    paddingTop: 22,
  },
  title: {
    color: theme.colors.vibeCyan,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: theme.fonts.main,
    marginBottom: 16,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    minWidth: 76,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  customLink: {
    color: theme.colors.vibeCyan,
    fontSize: 15,
    marginTop: 18,
    fontFamily: theme.fonts.main,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
    fontFamily: theme.fonts.main,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  amountInput: {
    width: 90,
    textAlign: 'center',
  },
  unitPicker: {
    flex: 1,
  },
  actions: {
    marginTop: 20,
    alignItems: 'stretch',
  },
  cancel: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 16,
    fontFamily: theme.fonts.main,
  },
});
