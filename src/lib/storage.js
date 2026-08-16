import AsyncStorage from '@react-native-async-storage/async-storage';

// Single source of truth for the on-device fast state. We store the
// absolute start timestamp (ms since epoch) rather than an elapsed
// count, so the timer stays correct across app restarts, backgrounding,
// and device reboots — we just recompute now - startMs on every tick.
const KEY_START = 'fast.startMs';
const KEY_GOAL = 'fast.goalHours';

export async function loadFast() {
  const [start, goal] = await Promise.all([
    AsyncStorage.getItem(KEY_START),
    AsyncStorage.getItem(KEY_GOAL),
  ]);
  return {
    startMs: start != null ? Number(start) : null,
    goalHours: goal != null ? Number(goal) : 16,
  };
}

export async function saveStart(startMs) {
  if (startMs == null) {
    await AsyncStorage.removeItem(KEY_START);
  } else {
    await AsyncStorage.setItem(KEY_START, String(startMs));
  }
}

export async function saveGoal(goalHours) {
  await AsyncStorage.setItem(KEY_GOAL, String(goalHours));
}
