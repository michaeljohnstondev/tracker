import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import theme from '../theme/themes';

/**
 * What you can hang on an item: a note, a timer, a counter, an alarm, a repeat.
 *
 * They're offered here rather than laid out permanently on the screen, so an
 * item shows only what it actually carries. A shopping list entry is a line of
 * text, and it shouldn't come with an empty form attached.
 *
 * Anything already present is left out — except reminders, since wanting a
 * second alarm is ordinary.
 */
export default function AddDetailModal({ visible, node, onClose, onPick }) {
  const options = [
    { key: 'note', icon: '📝', label: 'Note', hide: !!node?.note },
    { key: 'timer', icon: '⏱', label: 'Timer', hide: node?.goalHours != null || node?.startMs != null },
    { key: 'counter', icon: '🔢', label: 'Counter', hide: node?.count != null },
    { key: 'due', icon: '📅', label: 'Due date', hide: node?.dueAt != null },
    { key: 'reminder', icon: '🔔', label: 'Reminder' },
    { key: 'repeat', icon: '🔁', label: 'Repeat', hide: !!node?.repeat },
  ].filter((option) => !option.hide);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Add to “{node?.name}”</Text>

          {options.length === 0 ? (
            <Text style={styles.empty}>
              This already has everything it can carry.
            </Text>
          ) : (
            options.map((option) => (
              <Pressable
                key={option.key}
                onPress={() => {
                  onClose();
                  // After the sheet has gone: mounting one modal while another
                  // is dismissing is what black-screened sharing before.
                  setTimeout(() => onPick(option.key), 260);
                }}
                style={styles.row}
              >
                <Text style={styles.rowIcon}>{option.icon}</Text>
                <Text style={styles.rowLabel}>{option.label}</Text>
              </Pressable>
            ))
          )}

          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  title: {
    color: theme.colors.vibeCyan,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: theme.fonts.main,
    marginBottom: 10,
  },
  empty: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    paddingVertical: 16,
    fontFamily: theme.fonts.main,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.inputBorder,
  },
  rowIcon: { fontSize: 17, width: 32 },
  rowLabel: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: theme.fonts.main,
  },
  cancel: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 16,
    fontFamily: theme.fonts.main,
  },
});
