import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  AppState,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import theme from '../theme/themes';
import VibeButton from '../components/ui/VibeButton';
import VibeTimePicker from '../components/ui/VibeTimePicker';
import { loadFast, saveStart, saveGoal } from '../lib/storage';

const GOAL_PRESETS = [13, 16, 18, 20, 24];

// ---- formatting helpers -------------------------------------------------

const pad = (n) => String(n).padStart(2, '0');

// Elapsed ms -> "HH:MM:SS" (hours can exceed 24 for a long fast).
function fmtElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// A friendly "8:30 PM · Sat Aug 16" label for the start moment.
function fmtStart(ms) {
  const d = new Date(ms);
  let h = d.getHours();
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const time = `${h}:${pad(d.getMinutes())} ${period}`;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${time} · ${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`;
}

// A short "6h left" / "goal reached" style label for the goal.
function fmtRemaining(elapsedMs, goalMs) {
  const remaining = goalMs - elapsedMs;
  if (remaining <= 0) return 'Goal reached ✨';
  const total = Math.floor(remaining / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${pad(m)}m left`;
  return `${m}m left`;
}

// ------------------------------------------------------------------------

export default function FastScreen() {
  const [startMs, setStartMs] = useState(null);
  const [goalHours, setGoalHours] = useState(16);
  const [now, setNow] = useState(Date.now());
  const [loaded, setLoaded] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  const intervalRef = useRef(null);

  // Load persisted state once on mount.
  useEffect(() => {
    (async () => {
      const state = await loadFast();
      setStartMs(state.startMs);
      setGoalHours(state.goalHours);
      setLoaded(true);
    })();
  }, []);

  // Tick every second while a fast is running. We also refresh `now`
  // whenever the app returns to the foreground, since JS timers can be
  // throttled/paused in the background — the absolute startMs keeps us
  // accurate regardless.
  useEffect(() => {
    const clear = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    if (startMs != null) {
      setNow(Date.now());
      intervalRef.current = setInterval(() => setNow(Date.now()), 1000);
    } else {
      clear();
    }
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setNow(Date.now());
    });
    return () => {
      clear();
      sub.remove();
    };
  }, [startMs]);

  const startNow = useCallback(() => {
    const ms = Date.now();
    setStartMs(ms);
    saveStart(ms);
  }, []);

  const stopReset = useCallback(() => {
    setStartMs(null);
    saveStart(null);
  }, []);

  const pickGoal = useCallback((h) => {
    setGoalHours(h);
    saveGoal(h);
  }, []);

  // VibeTimePicker returns a Date set to the chosen time on *today's*
  // date. If that lands in the future (e.g. it's 9am and you pick 8pm),
  // you clearly meant yesterday evening — roll it back a day.
  const onConfirmTime = useCallback((date) => {
    setPickerVisible(false);
    let ms = date.getTime();
    if (ms > Date.now()) ms -= 24 * 60 * 60 * 1000;
    setStartMs(ms);
    saveStart(ms);
  }, []);

  if (!loaded) {
    return <SafeAreaView style={styles.screen} />;
  }

  const active = startMs != null;
  const elapsedMs = active ? now - startMs : 0;
  const goalMs = goalHours * 3600 * 1000;
  const pct = goalMs > 0 ? Math.min(100, (elapsedMs / goalMs) * 100) : 0;
  const reached = elapsedMs >= goalMs;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Fast</Text>

        {active ? (
          <>
            <Text style={styles.timer}>{fmtElapsed(elapsedMs)}</Text>
            <Text style={styles.startedLine}>Started {fmtStart(startMs)}</Text>

            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${pct}%` },
                  reached && styles.barFillReached,
                ]}
              />
            </View>
            <View style={styles.goalRow}>
              <Text style={styles.goalLabel}>Goal {goalHours}h</Text>
              <Text style={[styles.goalRemaining, reached && styles.goalReached]}>
                {fmtRemaining(elapsedMs, goalMs)}
              </Text>
            </View>

            <Pressable
              onPress={() => setPickerVisible(true)}
              hitSlop={8}
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={styles.editLink}>Edit start time</Text>
            </Pressable>

            <View style={styles.actions}>
              <VibeButton
                label="Stop & Reset"
                variant="red"
                onPress={stopReset}
              />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.timer}>{fmtElapsed(0)}</Text>
            <Text style={styles.idleHint}>
              Tap start when you finish your meal.
            </Text>

            <Text style={styles.sectionLabel}>Goal</Text>
            <View style={styles.goalPresets}>
              {GOAL_PRESETS.map((h) => (
                <VibeButton
                  key={h}
                  label={`${h}h`}
                  variant="toggle"
                  color={h === goalHours ? 'green' : 'gray'}
                  onPress={() => pickGoal(h)}
                  style={styles.goalChip}
                />
              ))}
            </View>

            <View style={styles.actions}>
              <VibeButton label="Start Now" variant="green" onPress={startNow} />
              <VibeButton
                label="I forgot — set start time"
                onPress={() => setPickerVisible(true)}
              />
            </View>
          </>
        )}
      </ScrollView>

      <VibeTimePicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onConfirm={onConfirmTime}
        initialTime={active ? new Date(startMs) : null}
        confirmText="Set"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  title: {
    color: theme.colors.vibeCyan,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
    fontFamily: theme.fonts.main,
    marginBottom: 40,
  },
  timer: {
    color: theme.colors.textPrimary,
    fontSize: 64,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
    fontFamily: theme.fonts.main,
    letterSpacing: 2,
  },
  startedLine: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    marginTop: 12,
    fontFamily: theme.fonts.main,
  },
  idleHint: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    marginTop: 12,
    textAlign: 'center',
    fontFamily: theme.fonts.main,
  },
  barTrack: {
    width: '100%',
    height: 10,
    borderRadius: 6,
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    marginTop: 32,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: theme.colors.vibeBlue,
    borderRadius: 6,
  },
  barFillReached: {
    backgroundColor: theme.colors.vibeGreen,
  },
  goalRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  goalLabel: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontFamily: theme.fonts.main,
  },
  goalRemaining: {
    color: theme.colors.vibeBlue,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: theme.fonts.main,
  },
  goalReached: {
    color: theme.colors.vibeGreen,
  },
  editLink: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginTop: 24,
    textDecorationLine: 'underline',
    fontFamily: theme.fonts.main,
  },
  sectionLabel: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 40,
    marginBottom: 12,
    fontFamily: theme.fonts.main,
  },
  goalPresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  goalChip: {
    minWidth: 64,
  },
  actions: {
    width: '100%',
    marginTop: 36,
  },
});
