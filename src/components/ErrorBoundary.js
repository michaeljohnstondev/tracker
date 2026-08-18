import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import theme from '../theme/themes';

/**
 * Shows a crash instead of dying from it.
 *
 * `console.log` is stripped from production bundles and a cable isn't always
 * to hand, so a render error would take the app down with nothing to report
 * but "it crashed". This puts the message and the top of the stack on screen,
 * where it can be read or photographed.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error('[crash]', error?.message, info?.componentStack);
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

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
          {info?.componentStack ? (
            <Text style={styles.stack}>
              {info.componentStack.split('\n').slice(0, 8).join('\n')}
            </Text>
          ) : null}
        </ScrollView>
        <Pressable
          onPress={() => this.setState({ error: null, info: null })}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
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
});
