import React, { useState, useCallback, useEffect } from 'react';
import { View, BackHandler } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import theme from './src/theme/themes';
import { AuthProvider } from './src/store/AuthContext';
import { TrackerProvider, useTrackers } from './src/store/TrackerContext';
import HomeScreen from './src/screens/HomeScreen';
import TimerDetailScreen from './src/screens/TimerDetailScreen';
import ListDetailScreen from './src/screens/ListDetailScreen';
import ItemDetailScreen from './src/screens/ItemDetailScreen';
import UpdateBanner from './src/components/ui/UpdateBanner';
import { useAppUpdate } from './src/lib/useAppUpdate';

// Tiny in-app router: home -> tracker detail -> item detail. Still a plain
// state switch rather than a navigation library — three known routes don't
// justify the dependency.
function Router() {
  const { getTracker } = useTrackers();
  const [route, setRoute] = useState({ name: 'home' });

  const openTracker = useCallback((id) => setRoute({ name: 'detail', id }), []);
  const openItem = useCallback(
    (trackerId, itemId) => setRoute({ name: 'item', id: trackerId, itemId }),
    []
  );
  const goHome = useCallback(() => setRoute({ name: 'home' }), []);
  const backToTracker = useCallback(
    () => setRoute((r) => ({ name: 'detail', id: r.id })),
    []
  );

  // Android hardware back walks one level up the stack rather than exiting.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (route.name === 'item') {
        backToTracker();
        return true;
      }
      if (route.name === 'detail') {
        goHome();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [route.name, goHome, backToTracker]);

  if (route.name === 'item') {
    const tracker = getTracker(route.id);
    const item = tracker?.items?.find((i) => i.id === route.itemId);
    // The item can vanish under us — someone else deleting it on a shared
    // list, or a clear-completed. Fall back rather than render nothing.
    if (!tracker) return <HomeScreen onOpen={openTracker} />;
    if (!item) {
      return (
        <ListDetailScreen
          tracker={tracker}
          onBack={goHome}
          onOpenItem={openItem}
        />
      );
    }
    return (
      <ItemDetailScreen
        tracker={tracker}
        item={item}
        onBack={backToTracker}
      />
    );
  }

  if (route.name === 'detail') {
    const tracker = getTracker(route.id);
    // Guard against a deleted/missing tracker (fall back to home).
    if (!tracker) {
      return <HomeScreen onOpen={openTracker} />;
    }
    return tracker.type === 'timer' ? (
      <TimerDetailScreen tracker={tracker} onBack={goHome} />
    ) : (
      <ListDetailScreen
        tracker={tracker}
        onBack={goHome}
        onOpenItem={openItem}
      />
    );
  }

  return <HomeScreen onOpen={openTracker} />;
}

export default function App() {
  // Sits outside the providers: an update prompt shouldn't depend on auth or
  // tracker state having loaded, and it must still appear if either fails.
  const { isUpdateReady, applyUpdate } = useAppUpdate();

  return (
    // Required by react-native-gesture-handler, which powers drag-to-reorder.
    // Must sit above everything that uses a gesture.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          {/* Auth wraps trackers: the tracker store subscribes to shared
              lists keyed on the signed-in uid, so it has to read auth. */}
          <AuthProvider>
            <TrackerProvider>
              <Router />
            </TrackerProvider>
          </AuthProvider>
          {/* Last child so it floats above the screens rather than being
              covered by them. */}
          <UpdateBanner visible={isUpdateReady} onRestart={applyUpdate} />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
