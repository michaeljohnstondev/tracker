import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, View, Text, Pressable } from 'react-native';
import { useTheme, useThemedStyles } from '../../theme/ThemeContext';

/**
 * The app's own alert.
 *
 * Called as a plain function from anywhere — services and stores included, not
 * just components — so the API stays imperative and every existing call site is
 * unchanged. A host mounted once at the root does the rendering, and this
 * module hands alerts to it.
 *
 *   VibeAlert('Could not share', err.message, [], 'error')
 *   VibeAlert('Delete', 'Are you sure?', [
 *     { text: 'Cancel', style: 'cancel' },
 *     { text: 'Delete', style: 'destructive', onPress: remove },
 *   ])
 */

// Set by the host while it's mounted. Module-level rather than context because
// most callers aren't components and have no hooks to reach a context with.
let present = null;

// Names a hue rather than resolving one: this map is module scope, evaluated
// once at import, so a resolved colour here would be frozen to whichever theme
// happened to load first. The host looks the name up per render instead.
const TYPES = {
  info: { color: 'vibeCyan', icon: '' },
  success: { color: 'vibeGreen', icon: '✅' },
  warning: { color: 'vibeOrange', icon: '⚠️' },
  error: { color: 'vibeRed', icon: '⛔' },
};

export default function VibeAlert(title, message, buttons = [], type) {
  // Anything you're asked to confirm destroying is a warning by default, so the
  // common case doesn't have to say so at every call site.
  const resolved =
    type ?? (buttons.some((b) => b.style === 'destructive') ? 'warning' : 'info');

  // With nothing to press the only way out would be a tap on the backdrop,
  // which nobody should have to guess at.
  const resolvedButtons = buttons.length ? buttons : [{ text: 'OK' }];

  if (present) {
    present({ title, message, buttons: resolvedButtons, type: resolved });
    return;
  }

  // Nothing mounted yet — an alert during startup, or after a crash took the
  // tree down. Better the system dialog than silence.
  Alert.alert(title, message, resolvedButtons);
}

export function VibeConfirm(title, message, onConfirm, onCancel) {
  return VibeAlert(title, message, [
    { text: 'Cancel', style: 'cancel', onPress: onCancel },
    { text: 'Confirm', onPress: onConfirm },
  ]);
}

/**
 * Mount once, at the root, above everything else.
 *
 * Alerts queue rather than replace one another: two failures arriving together
 * is exactly when you want to read both.
 */
export function VibeAlertHost() {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    present = (alert) => setQueue((q) => [...q, alert]);
    return () => {
      present = null;
    };
  }, []);

  const current = queue[0];

  const dismiss = useCallback((onPress) => {
    setQueue((q) => q.slice(1));
    // Next tick, so the alert is off screen before a handler navigates,
    // deletes, or opens something of its own.
    if (onPress) setTimeout(onPress, 0);
  }, []);

  // Android's back button. On something you're being asked to confirm, backing
  // out means cancelling — never the destructive half.
  const handleRequestClose = useCallback(() => {
    if (!current) return;
    const cancel = current.buttons.find((b) => b.style === 'cancel');
    dismiss(cancel?.onPress);
  }, [current, dismiss]);

  const kindSpec = TYPES[current?.type] ?? TYPES.info;
  const kind = { color: theme.colors[kindSpec.color], icon: kindSpec.icon };
  // Two short buttons sit side by side; three, or one long one, read better
  // stacked.
  const stacked =
    !current ||
    current.buttons.length > 2 ||
    current.buttons.some((b) => (b.text?.length ?? 0) > 12);

  return (
    // Kept mounted and toggled by `visible`. Unmounting a Modal while it's on
    // screen is what black-screened Android before, and an alert can be
    // dismissed by the very thing it was reporting on.
    <Modal
      visible={queue.length > 0}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleRequestClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.box, { borderColor: kind.color }]}>
          <View style={styles.header}>
            {kind.icon ? <Text style={styles.icon}>{kind.icon}</Text> : null}
            <Text style={[styles.title, { color: kind.color }]}>
              {current?.title}
            </Text>
          </View>

          {current?.message ? (
            <Text style={styles.message}>{current.message}</Text>
          ) : null}

          <View style={[styles.buttons, stacked && styles.buttonsStacked]}>
            {current?.buttons.map((button, index) => {
              const cancel = button.style === 'cancel';
              const destructive = button.style === 'destructive';
              const tint = destructive ? theme.colors.vibeRed : kind.color;

              return (
                <Pressable
                  key={`${button.text}-${index}`}
                  onPress={() => dismiss(button.onPress)}
                  style={({ pressed }) => [
                    styles.button,
                    !stacked && styles.buttonInline,
                    { borderColor: cancel ? theme.colors.gray : tint },
                    pressed && { backgroundColor: `${tint}22` },
                  ]}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      { color: cancel ? theme.colors.gray : tint },
                    ]}
                  >
                    {button.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (t) => ({
  overlay: {
    flex: 1,
    backgroundColor: t.semantic.overlayStrong,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  box: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: t.colors.background,
    borderRadius: 14,
    borderWidth: 3,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  icon: { fontSize: 20, marginRight: 10 },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
    fontFamily: t.fonts.main,
  },
  message: {
    color: t.colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: t.fonts.main,
  },
  buttons: { flexDirection: 'row', gap: 10 },
  buttonsStacked: { flexDirection: 'column' },
  button: {
    borderWidth: 2,
    borderBottomWidth: 4,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  buttonInline: { flex: 1 },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: t.fonts.main,
  },
});
