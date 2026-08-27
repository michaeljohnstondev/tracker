import React from 'react';
import { Modal, Text, Pressable } from 'react-native';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';

/**
 * Everything you can do here, in one sheet off the header.
 *
 * Moving used to live here as a one-at-a-time thing done to the node you were
 * already inside: open it, find it in this menu, move it, go back, repeat.
 * That's replaced by picking things off the list in front of you — so what
 * this offers now is the way in to that, and the destination picker handles
 * where they go. Moving the current node is done from its parent, alongside
 * everything else there, which is the same job with one fewer special case.
 *
 * Also serves the home screen, which has no node of its own but is a list like
 * any other and needs the same two actions.
 */
export default function NodeMenu({
  visible,
  node,
  onClose,
  onRename,
  onShare,
  onDelete,
  onSelect,
  canSelect = false,
}) {
  const { isDark, toggleTheme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const close = () => onClose();

  // Close, then act once this sheet has actually gone.
  //
  // Every action here opens something else — another sheet, or an alert. On
  // Android each Modal is its own window, and mounting one while another is
  // still dismissing is what produced the black screen when sharing before.
  // The delay covers the dismiss animation.
  const run = (fn) => {
    onClose();
    if (fn) setTimeout(fn, 260);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={close}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title} numberOfLines={1}>
            {node?.name ?? 'Home'}
          </Text>

          {canSelect && (
            <>
              <Pressable onPress={() => run(() => onSelect?.('move'))} style={styles.row}>
                <Text style={styles.rowIcon}>↔</Text>
                <Text style={styles.rowLabel}>Move things…</Text>
              </Pressable>

              <Pressable onPress={() => run(() => onSelect?.('copy'))} style={styles.row}>
                <Text style={styles.rowIcon}>⧉</Text>
                <Text style={styles.rowLabel}>Copy things…</Text>
              </Pressable>
            </>
          )}

          {node && (
            <>
              <Pressable onPress={() => run(onRename)} style={styles.row}>
                <Text style={styles.rowIcon}>✎</Text>
                <Text style={styles.rowLabel}>Edit title</Text>
              </Pressable>

              {onShare && (
                <Pressable onPress={() => run(onShare)} style={styles.row}>
                  <Text style={styles.rowIcon}>⤴</Text>
                  <Text style={styles.rowLabel}>
                    {node?.shared ? 'Invite someone' : 'Share'}
                  </Text>
                </Pressable>
              )}

              <Pressable onPress={() => run(onDelete)} style={styles.row}>
                <Text style={styles.rowIcon}>🗑</Text>
                <Text style={[styles.rowLabel, styles.destructive]}>Delete</Text>
              </Pressable>
            </>
          )}

          {/* Deliberately not routed through run(): leaving the sheet open
              is the point, so the switch is visible as it happens rather than
              landing on a screen that has already changed. */}
          <Pressable onPress={toggleTheme} style={styles.row}>
            <Text style={styles.rowIcon}>{isDark ? '☀' : '☾'}</Text>
            <Text style={styles.rowLabel}>
              {isDark ? 'Light theme' : 'Dark theme'}
            </Text>
          </Pressable>

          <Pressable onPress={close} hitSlop={8}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (t) => ({
  overlay: { flex: 1, backgroundColor: t.semantic.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: t.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: t.colors.inputBorder,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 34,
    maxHeight: '80%',
  },
  title: {
    color: t.colors.vibeCyan,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: t.fonts.main,
    marginBottom: 10,
  },
  scroll: { flexGrow: 0 },
  hint: {
    color: t.colors.textSecondary,
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 6,
    fontFamily: t.fonts.main,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.inputBorder,
  },
  rowIcon: { fontSize: 17, width: 32, color: t.colors.textPrimary },
  rowLabel: {
    flex: 1,
    color: t.colors.textPrimary,
    fontSize: 16,
    fontFamily: t.fonts.main,
  },
  destructive: { color: t.colors.vibeRed },
  cancel: {
    color: t.colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 16,
    fontFamily: t.fonts.main,
  },
});
