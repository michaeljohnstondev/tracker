import React, { useState, useCallback, useEffect } from 'react';
import { View, BackHandler } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import theme from './src/theme/themes';
import { AuthProvider } from './src/store/AuthContext';
import { TrackerProvider, useTrackers } from './src/store/TrackerContext';
import HomeScreen from './src/screens/HomeScreen';
import TimerDetailScreen from './src/screens/TimerDetailScreen';
import ListDetailScreen from './src/screens/ListDetailScreen';
import UpdateBanner from './src/components/ui/UpdateBanner';
import { useAppUpdate } from './src/lib/useAppUpdate';

// Tiny in-app router. Two routes: the home list and a tracker detail.
// Keeping it a plain state switch avoids pulling in a navigation library
// for what is (for now) a two-level app.
function Router() {
  const { getTracker } = useTrackers();
  const [route, setRoute] = useState({ name: 'home' });

  const openTracker = useCallback((id) => setRoute({ name: 'detail', id }), []);
  const goHome = useCallback(() => setRoute({ name: 'home' }), []);

  // Android hardware back returns to the home list from a detail.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (route.name === 'detail') {
        goHome();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [route.name, goHome]);

  if (route.name === 'detail') {
    const tracker = getTracker(route.id);
    // Guard against a deleted/missing tracker (fall back to home).
    if (!tracker) {
      return <HomeScreen onOpen={openTracker} />;
    }
    return tracker.type === 'timer' ? (
      <TimerDetailScreen tracker={tracker} onBack={goHome} />
    ) : (
      <ListDetailScreen tracker={tracker} onBack={goHome} />
    );
  }

  return <HomeScreen onOpen={openTracker} />;
}

export default function App() {
  // Sits outside the providers: an update prompt shouldn't depend on auth or
  // tracker state having loaded, and it must still appear if either fails.
  const { isUpdateReady, applyUpdate } = useAppUpdate();

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        {/* Auth wraps trackers: the tracker store subscribes to shared lists
            keyed on the signed-in uid, so it has to read auth state. */}
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
  );
}
