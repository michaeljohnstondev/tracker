import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal } from 'react-native';
import { signOut } from '@react-native-firebase/auth';
import theme from '../theme/themes';
import { auth } from '../services/firebase';

/**
 * Shows a crash instead of dying from it.
 *
 * `console.log` is stripped from production bundles and a cable isn't always
 * to hand — least of all when the phone that's crashing belongs to someone
 * else. This puts the message and the top of the stack on screen, where it can
 * be read or photographed.
 *
 * Two kinds of crash arrive here. React catches errors thrown while rendering;
 * everything else — a callback, a subscription, a timer, anything that runs
 * after mount — goes to the global handler instead, and would otherwise close
 * the app with nothing to show for it.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    // Two separate slots on purpose. A render error means React has already
    // thrown the subtree away and there is nothing left to show but the
    // report. An error from anywhere else leaves the app intact, and the
    // report goes over the top of it — see render().
    this.state = { error: null, info: null, globalError: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidMount() {
    const errorUtils = global.ErrorUtils;
    if (!errorUtils?.setGlobalHandler) return;

    this.previousHandler = errorUtils.getGlobalHandler?.();
    errorUtils.setGlobalHandler((error, isFatal) => {
      this.setState({ globalError: error, fatal: isFatal });
      // The previous handler is deliberately not called for a fatal error:
      // handing it on is what closes the app, and a crash nobody can read is
      // the problem being solved here.
      if (!isFatal) this.previousHandler?.(error, isFatal);
    });
  }

  componentWillUnmount() {
    if (this.previousHandler) {
      global.ErrorUtils?.setGlobalHandler?.(this.previousHandler);
    }
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error('[crash]', error?.message, info?.componentStack);
  }

  report(error, componentStack, dismiss) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Something broke</Text>
        <ScrollView style={styles.scroll}>
          <Text style={styles.message}>{String(error?.message || error)}</Text>
          {/* The first few frames are the useful part; the rest is React's
              own machinery. */}
          <Text style={styles.stack}>
            {String(error?.stack || '').split('\n').slice(0, 6).join('\n')}
          </Text>
          {componentStack ? (
            <Text style={styles.stack}>
              {componentStack.split('\n').slice(0, 8).join('\n')}
            </Text>
          ) : null}
        </ScrollView>
        <Pressable onPress={dismiss} style={styles.button}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>

        {/* A way out of a crash that repeats on every launch. Whatever is
            being loaded for the signed-in account stops being loaded, and the
            app is usable again — without wiping the device's own data, which
            is the only escape otherwise. Firebase is called directly here:
            this can render in place of the providers, so there's no auth
            context to reach. */}
        <Pressable
          onPress={() => {
            signOut(auth).catch(() => {});
            dismiss();
          }}
          style={[styles.button, styles.buttonQuiet]}
        >
          <Text style={[styles.buttonText, styles.buttonQuietText]}>
            Sign out and try again
          </Text>
        </Pressable>
      </View>
    );
  }

  render() {
    const { error, info, globalError, fatal } = this.state;

    // React threw the subtree away before calling this, so there is nothing
    // left to render around — the report takes the whole screen.
    if (error) {
      return this.report(error, info?.componentStack, () =>
        this.setState({ error: null, info: null })
      );
    }

    return (
      <>
        {this.props.children}
        {/* Everything else leaves the app standing, so the report goes over
            the top rather than replacing it. Swapping the tree out from under
            a live screen was itself a crash: on Android a Modal is its own
            window, and unmounting a visible one takes the app with it — which
            is exactly what an open sheet would hit here. */}
        <Modal
          visible={!!globalError}
          transparent={false}
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => this.setState({ globalError: null })}
        >
          {this.report(
            globalError,
            fatal ? '(uncaught, fatal)' : '(uncaught)',
            () => this.setState({ globalError: null })
          )}
        </Modal>
      </>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 24,
    paddingTop: 60,
  },
  title: {
    color: theme.colors.vibeRed,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    fontFamily: theme.fonts.main,
  },
  scroll: { flex: 1 },
  message: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    marginBottom: 16,
    fontFamily: theme.fonts.main,
  },
  stack: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 16,
  },
  button: {
    borderWidth: 2,
    borderColor: theme.colors.vibeBlue,
    borderRadius: theme.sizes.borderRadius,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: theme.colors.vibeBlue,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: theme.fonts.main,
  },
  buttonQuiet: { borderColor: theme.colors.gray, marginTop: 10 },
  buttonQuietText: { color: theme.colors.gray },
});
