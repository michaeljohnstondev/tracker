import React, { useState, useCallback, useEffect } from 'react';
import { View, BackHandler } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import theme from './src/theme/themes';
import { AuthProvider } from './src/store/AuthContext';
import { NodeProvider, useNodes } from './src/store/NodeContext';
import NodeScreen from './src/screens/NodeScreen';
import UpdateBanner from './src/components/ui/UpdateBanner';
import ErrorBoundary from './src/components/ErrorBoundary';
import { useAppUpdate } from './src/lib/useAppUpdate';

/**
 * A stack of node ids. Home is the empty stack — the children of an invisible
 * root — so the top level isn't a special case, it's the same screen with
 * nothing on the stack.
 */
function Router() {
  const { getNode } = useNodes();
  const [stack, setStack] = useState([]);

  const open = useCallback((id) => setStack((s) => [...s, id]), []);
  const goBack = useCallback(() => setStack((s) => s.slice(0, -1)), []);

  // Replaces the current screen rather than stacking onto it — used when a
  // node is shared and the local copy is swapped for its published twin,
  // where pushing would leave a dead entry behind.
  const replace = useCallback(
    (id) => setStack((s) => (s.length ? [...s.slice(0, -1), id] : [id])),
    []
  );

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!stack.length) return false;
      goBack();
      return true;
    });
    return () => sub.remove();
  }, [stack.length, goBack]);

  const node = stack.length ? getNode(stack[stack.length - 1]) : null;

  // The node can vanish under us — deleted here, or removed by someone else on
  // a shared tree. Drop back rather than render nothing.
  if (stack.length && !node) {
    return <NodeScreen node={null} onOpen={open} onBack={goBack} onReplace={replace} />;
  }

  // Deliberately unkeyed. Keying on the node id remounts the screen whenever
  // it changes, which tears down any open sheet with it — and sharing swaps
  // the local node for its published twin while the share sheet is still open.
  // The screen re-seeds its own state from the node instead.
  return <NodeScreen node={node} onOpen={open} onBack={goBack} onReplace={replace} />;
}

export default function App() {
  // Outside the providers: an update prompt shouldn't be gated on auth or
  // data having loaded, and should still appear if either fails.
  const { isUpdateReady, applyUpdate } = useAppUpdate();

  return (
    // Required by react-native-gesture-handler, which powers dragging.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          {/* Auth wraps nodes: the store subscribes to shared trees keyed on
              the signed-in uid, so it has to read auth state. */}
          {/* Shows a crash rather than dying from it — console output is
              stripped from production bundles, so without this a render error
              reports nothing at all. */}
          <ErrorBoundary>
            <AuthProvider>
              <NodeProvider>
                <Router />
              </NodeProvider>
            </AuthProvider>
          </ErrorBoundary>
          {/* Last child so it floats above the screen rather than under it. */}
          <UpdateBanner visible={isUpdateReady} onRestart={applyUpdate} />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
