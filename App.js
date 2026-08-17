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
import CategoryDetailScreen from './src/screens/CategoryDetailScreen';
import UpdateBanner from './src/components/ui/UpdateBanner';
import { useAppUpdate } from './src/lib/useAppUpdate';

// In-app router holding a real stack of tracker ids, because categories can
// contain categories to any depth — so "one level up" isn't a fixed
// destination any more. Still no navigation library: a stack of ids and an
// optional open item is the whole model.
function Router() {
  const { getTracker } = useTrackers();
  const [stack, setStack] = useState([]);
  const [itemId, setItemId] = useState(null);

  const openTracker = useCallback((id) => {
    setItemId(null);
    setStack((s) => [...s, id]);
  }, []);

  const openItem = useCallback((trackerId, id) => setItemId(id), []);

  const goHome = useCallback(() => {
    setItemId(null);
    setStack([]);
  }, []);

  // One step up: out of an item first, then out of each nested category.
  const goBack = useCallback(() => {
    setItemId((currentItem) => {
      if (currentItem) return null;
      setStack((s) => s.slice(0, -1));
      return null;
    });
  }, []);

  // Replaces the current screen rather than stacking onto it — used when a
  // tracker is shared and the local copy is swapped for the remote one, where
  // pushing would leave a dead entry behind.
  const replaceTracker = useCallback((id) => {
    setItemId(null);
    setStack((s) => (s.length ? [...s.slice(0, -1), id] : [id]));
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (itemId || stack.length) {
        goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [itemId, stack.length, goBack]);

  const tracker = stack.length ? getTracker(stack[stack.length - 1]) : null;

  // The tracker can vanish under us — deleted here, or removed by someone
  // else on a shared list. Drop back rather than render nothing.
  if (stack.length && !tracker) {
    return <HomeScreen onOpen={openTracker} />;
  }

  if (tracker) {
    const item = itemId ? tracker.items?.find((i) => i.id === itemId) : null;
    if (itemId && item) {
      return <ItemDetailScreen tracker={tracker} item={item} onBack={goBack} />;
    }

    if (tracker.type === 'category') {
      return (
        <CategoryDetailScreen
          tracker={tracker}
          onBack={goBack}
          onOpen={openTracker}
        />
      );
    }

    return tracker.type === 'timer' ? (
      <TimerDetailScreen
        tracker={tracker}
        onBack={goBack}
        onOpenTracker={replaceTracker}
      />
    ) : (
      <ListDetailScreen
        tracker={tracker}
        onBack={goBack}
        onOpenItem={openItem}
        onOpenTracker={replaceTracker}
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
