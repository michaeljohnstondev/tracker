import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import FastScreen from './src/screens/FastScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <FastScreen />
    </SafeAreaProvider>
  );
}
