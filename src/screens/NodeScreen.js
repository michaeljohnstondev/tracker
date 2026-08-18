import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReorderableList from 'react-native-reorderable-list';
import theme from '../theme/themes';
import VibeInput from '../components/ui/VibeInput';
import VibeButton from '../components/ui/VibeButton';
import VibeAlert from '../components/ui/VibeAlert';
import ScreenHeader from '../components/ScreenHeader';
import NodeCard from '../components/NodeCard';
import AddNodeModal from '../components/AddNodeModal';
import NodeMenu from '../components/NodeMenu';
import ShareNodeModal from '../components/ShareNodeModal';
import AddDetailModal from '../components/AddDetailModal';
import RenameModal from '../components/RenameModal';
import JoinListModal from '../components/JoinListModal';
import GoalModal from '../components/GoalModal';
import ItemReminders, { normalizeReminders } from '../components/ItemReminders';
import { useNodes } from '../store/NodeContext';
import { useAuth } from '../store/AuthContext';
import { ensurePushPermission } from '../services/fcm';
import { syncNodeReminders, syncGoalReminder } from '../services/reminders';
import { resolveColor, fmtElapsed, isStale, isCountStale } from '../lib/format';
import { hasTimer as nodeHasTimer, hasCounter as nodeHasCounter } from '../lib/nodes';
import { useNow } from '../lib/useNow';

const fmtGoal = (hours) => {
  if (!hours) return '—';
  const whole = Math.floor(hours);
  const mins = Math.round((hours - whole) * 60);
  if (!whole) return `${mins}m`;
  return mins ? `${whole}h ${mins}m` : `${whole}h`;
};

/**
 * The only screen.
 *
 * Home is this screen with no node — the children of an invisible root — so
 * there is no special case for the top level. Everything below is what this
 * particular node happens to carry: children, a note, a timer, a repeat,
 * reminders. A node with none of those simply shows none of it.
 */
export default function NodeScreen({ node, onOpen, onBack, onReplace }) {
  const {
    nodes,
    loaded,
    childrenFor,
    addNode,
    updateNode,
    deleteNode,
    reorderChildren,
    toggleDone,
  } = useNodes();
  const { uid } = useAuth();

  const [adding, setAdding] = useState(false);
  const [joining, setJoining] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [note, setNote] = useState(node?.note ?? '');
  const [reminders, setReminders] = useState(normalizeReminders(node?.reminders));
  const [addingDetail, setAddingDetail] = useState(false);
  // A section is on screen if the node carries it, or if it was just added and
  // is waiting to be filled in.
  const [revealed, setRevealed] = useState({});

  const isRoot = !node;
  const color = resolveColor(node?.color);
  const children = useMemo(
    () => childrenFor(node?.id ?? null),
    [childrenFor, node]
  );

  // Counting grandchildren so a card can say "3 inside" without each row
  // having to scan the whole tree itself.
  const childCounts = useMemo(() => {
    const counts = {};
    nodes.forEach((n) => {
      if (!n.parentId) return;
      counts[n.parentId] = (counts[n.parentId] ?? 0) + 1;
    });
    return counts;
  }, [nodes]);

  // ---- Repeats ------------------------------------------------------------

  // Repeating nodes un-tick themselves once their period has passed. Done on
  // view rather than on a schedule: there's no background process to lean on,
  // and the only moment it has to be right is when you're looking at it.
  useEffect(() => {
    children.filter(isStale).forEach((child) => {
      updateNode(child, { done: false, doneAt: null, doneBy: null });
    });
    // A tally resets on its own schedule, whether or not the item was ever
    // ticked — yesterday's reps aren't today's.
    children.filter(isCountStale).forEach((child) => {
      updateNode(child, { count: 0, countedAt: Date.now() });
    });
  }, [children, updateNode]);

  // ---- Note ---------------------------------------------------------------

  // Typing is what saves a note, not leaving the field.
  //
  // The old arrangement wrote on blur, with unmounting as the safety net for
  // backing out mid-sentence. That net stopped existing when the router was
  // made unkeyed to survive sharing: this screen is now reused as you move
  // around rather than remounted, so going back doesn't unmount anything — it
  // just swaps the node underneath, and the effect below adopts the new node's
  // note over whatever was typed. The words were gone before anything tried to
  // save them.
  const noteTimer = useRef(null);
  const noteDirty = useRef(false);

  const handleNoteChange = useCallback(
    (text) => {
      setNote(text);
      noteDirty.current = true;

      // Captured, so a write still in flight when you move on lands on the
      // node it was written for rather than the one now on screen.
      const target = node;
      clearTimeout(noteTimer.current);
      noteTimer.current = setTimeout(() => {
        noteTimer.current = null;
        noteDirty.current = false;
        const trimmed = text.trim();
        if (target && trimmed !== (target.note ?? '')) {
          updateNode(target, { note: trimmed });
        }
      }, 600);
    },
    [node, updateNode]
  );

  // Adopt what the node carries — unless there are unsaved keystrokes, which
  // a snapshot echoing back the last save would otherwise overwrite mid-word.
  useEffect(() => {
    if (noteDirty.current) return;
    setNote(node?.note ?? '');
  }, [node?.id, node?.note]);

  // A different node is a clean slate regardless.
  useEffect(() => {
    noteDirty.current = false;
    setNote(node?.note ?? '');
  }, [node?.id]);

  const storedReminders = useMemo(
    () => normalizeReminders(node?.reminders),
    [node?.reminders]
  );
  const reminderKey = storedReminders.join(',');

  // Compared by contents, not identity: a fresh array arrives on every
  // Firestore snapshot, and depending on the array itself would wipe a
  // reminder the moment it was added, before it could be saved.
  useEffect(() => {
    setReminders(normalizeReminders(node?.reminders));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id, reminderKey]);

  /** Write immediately, cancelling anything the debounce still owed. */
  const saveNote = useCallback(() => {
    clearTimeout(noteTimer.current);
    noteTimer.current = null;
    noteDirty.current = false;
    if (!node) return;
    const trimmed = note.trim();
    if (trimmed === (node.note ?? '')) return;
    updateNode(node, { note: trimmed });
  }, [node, note, updateNode]);

  const flushRef = useRef(saveNote);
  flushRef.current = saveNote;

  // Leaving the foreground is the one exit a debounce can't cover: the process
  // can be killed while a write is still pending, and nothing else would run.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') flushRef.current();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => () => flushRef.current(), []);

  // ---- Reminders ----------------------------------------------------------

  const applyReminders = useCallback(
    (next) => {
      if (next.length > reminders.length) ensurePushPermission(uid);
      setReminders(next);
      updateNode(node, { reminders: next });
      syncNodeReminders({ node, uid, previous: storedReminders, reminders: next });
    },
    [node, uid, reminders.length, storedReminders, updateNode]
  );

  // ---- Timer --------------------------------------------------------------

  const running = node?.startMs != null;
  const now = useNow(running);
  const elapsedMs = running ? now - node.startMs : 0;
  const goalMs = (node?.goalHours || 0) * 3600 * 1000;
  const reachedGoal = goalMs > 0 && elapsedMs >= goalMs;

  const applyTimer = useCallback(
    (patch) => {
      updateNode(node, patch);
      syncGoalReminder({
        tracker: node,
        uid,
        key: `node_${node.id}`,
        label: node.name,
        startMs: 'startMs' in patch ? patch.startMs : node.startMs,
        goalHours: 'goalHours' in patch ? patch.goalHours : node.goalHours,
      });
    },
    [node, uid, updateNode]
  );

  // ---- Actions ------------------------------------------------------------

  const confirmDelete = useCallback(() => {
    // The sheets outlive the node now, so nothing here may assume one.
    if (!node) return;
    const count = children.length;
    const leaving = node.shared && !node.isRoot;
    VibeAlert(
      'Delete',
      count
        ? `Delete "${node.name}" and the ${count} thing${count === 1 ? '' : 's'} inside it?`
        : `Delete "${node.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: leaving ? 'Leave' : 'Delete',
          style: 'destructive',
          onPress: () => {
            onBack();
            deleteNode(node);
          },
        },
      ]
    );
  }, [node, children.length, deleteNode, onBack]);

  // Set the moment a share is published, cleared once we've followed it.
  const [pendingRoot, setPendingRoot] = useState(null);

  // Follow the node to its published twin as soon as that twin exists.
  //
  // The local copy is deleted once the upload is confirmed, and this screen is
  // showing it. Without moving first, the screen would be rendering a node
  // that had just been removed — and the share sheet would be torn down with
  // it, mid-use.
  useEffect(() => {
    if (!pendingRoot) return;
    if (!nodes.some((n) => n.id === pendingRoot)) return;
    setPendingRoot(null);
    onReplace?.(pendingRoot);
  }, [pendingRoot, nodes, onReplace]);

  const handleShareClose = useCallback(
    (result) => {
      setSharing(false);
      if (result?.rootId) setPendingRoot(result.rootId);
    },
    []
  );

  // The two halves of the app, and a node is exactly one of them.
  //
  // A category is a place you put things: its screen is its contents, and
  // nothing else. An item is a thing: its screen is its own notes, timer,
  // repeat and reminders, and it holds nothing. Letting an item contain items
  // made every leaf a folder, which is absurd, and hanging a form under every
  // folder put one on each screen you pass through on the way somewhere else.
  const isContainer = isRoot || node.kind === 'category';
  const hasDetails = !isRoot && !isContainer;

  const showNote = !!node?.note || revealed.note;
  const showRepeat = !!node?.repeat || revealed.repeat;
  const showReminders = !!node?.reminders?.length || revealed.reminder;

  // Reset when a different item is opened, or a section revealed on one would
  // linger on the next.
  useEffect(() => setRevealed({}), [node?.id]);

  const addDetail = useCallback(
    (kind) => {
      if (kind === 'timer') {
        applyTimer({ goalHours: 1 });
        return;
      }
      if (kind === 'counter') {
        updateNode(node, { count: 0, countedAt: Date.now() });
        return;
      }
      if (kind === 'repeat') {
        updateNode(node, { repeat: 'daily' });
        return;
      }
      setRevealed((r) => ({ ...r, [kind]: true }));
    },
    [applyTimer, updateNode, node]
  );

  // Never below zero: a negative rep count is nothing, and the guard is
  // cheaper than explaining it.
  const bumpCount = useCallback(
    (delta) => {
      if (!node) return;
      updateNode(node, {
        count: Math.max(0, (node.count ?? 0) + delta),
        countedAt: Date.now(),
      });
    },
    [node, updateNode]
  );
  // Only what Clear would actually remove. Repeating items are ticked off
  // rather than finished — they come back on their own — so deleting one
  // because it was done today would throw away the habit. Counting them here
  // made the button promise to clear things it then left alone.
  const clearable = useMemo(
    () => children.filter((c) => c.done && !c.repeat),
    [children]
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {isRoot ? (
        <View style={styles.homeHeader}>
          <Text style={styles.homeTitle}>Tracker</Text>
        </View>
      ) : (
        <ScreenHeader
          title={node.name}
          color={color}
          onBack={onBack}
          onRename={() => setRenaming(true)}
          onMenu={() => setMenuOpen(true)}
        />
      )}

      {node?.shared && (
        <Text style={styles.sharedNote}>Shared · changes sync live</Text>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        {/* A screen is one thing or the other — a container's children, or an
            item's details — so each gets the scroller that suits it. The list
            used to be a NestedReorderableList inside a ScrollViewContainer,
            which is what you need when a list shares a screen with other
            content. Nothing here ever does, and a virtualized list nested in a
            scroll view had no idea how tall it was: past a screenful the rest
            simply couldn't be reached. */}
        {isContainer ? (
          <ReorderableList
            style={styles.flex}
            data={children}
            keyExtractor={(child) => child.id}
            onReorder={({ from, to }) => reorderChildren(node?.id ?? null, from, to)}
            // The list's own padding is dropped while empty, or it offsets the
            // centred message by the difference between top and bottom.
            contentContainerStyle={[
              styles.list,
              loaded && children.length === 0 && styles.listEmpty,
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            renderItem={({ item: child, index }) => (
              <NodeCard
                node={child}
                index={index}
                childCount={childCounts[child.id] ?? 0}
                onPress={() => onOpen(child.id)}
                onHold={() => onOpen(child.id)}
                onToggle={() => toggleDone(child)}
              />
            )}
            // Same wording wherever you are — an empty category and an empty
            // home screen are the same situation, and the prompt is the useful
            // part of the message.
            ListEmptyComponent={
              loaded ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.empty}>
                    Nothing yet.{'\n'}Add something to get started.
                  </Text>
                </View>
              ) : null
            }
          />
        ) : (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Only what this item actually carries. Everything else is added
                deliberately from the Add button, so a plain line of text stays
                a plain line of text. */}
            <View style={styles.details}>
              {showNote && (
                <>
                  <Text style={styles.label}>Note</Text>
                  <VibeInput
                    value={note}
                    onChangeText={handleNoteChange}
                    onBlur={saveNote}
                    placeholder="Anything worth remembering"
                    multiline
                    maxLength={500}
                    autoCapitalize="sentences"
                    autoFocus={!node.note}
                    style={styles.note}
                  />
                </>
              )}

              {showRepeat && (
                <>
                  <Text style={styles.label}>Repeat</Text>
                  <View style={styles.chips}>
                    {[
                      { value: null, label: 'Never' },
                      { value: 'daily', label: 'Daily' },
                      { value: 'weekly', label: 'Weekly' },
                      // No period of its own: this one is permanent. Clear
                      // leaves it alone and it stays ticked until you untick
                      // it, which is what you want for a standing item that
                      // isn't on a schedule.
                      { value: 'always', label: 'Always' },
                    ].map((option) => (
                      <VibeButton
                        key={option.label}
                        label={option.label}
                        variant="toggle"
                        color={(node.repeat ?? null) === option.value ? 'green' : 'gray'}
                        onPress={() => updateNode(node, { repeat: option.value })}
                        style={styles.chip}
                      />
                    ))}
                  </View>
                </>
              )}

              {nodeHasTimer(node) && (
                <>
                  <Text style={styles.label}>Timer</Text>
                  <View style={styles.timerBox}>
                  <Text
                    style={[
                      styles.elapsed,
                      reachedGoal && { color: theme.colors.vibeGreen },
                    ]}
                  >
                    {fmtElapsed(elapsedMs)}
                  </Text>
                  <Pressable onPress={() => setGoalOpen(true)} hitSlop={8}>
                    <Text style={styles.goalLine}>
                      Goal {fmtGoal(node.goalHours)} ✎
                    </Text>
                  </Pressable>
                  <View style={styles.timerActions}>
                    <VibeButton
                      label={running ? 'Stop' : 'Start'}
                      variant={running ? 'red' : 'green'}
                      onPress={() =>
                        applyTimer({ startMs: running ? null : Date.now() })
                      }
                    />
                    <Pressable
                      onPress={() => applyTimer({ startMs: null, goalHours: null })}
                      hitSlop={8}
                    >
                      <Text style={styles.removeTimer}>Remove timer</Text>
                    </Pressable>
                    </View>
                  </View>
                </>
              )}

              {nodeHasCounter(node) && (
                <>
                  <Text style={styles.label}>Counter</Text>
                  <View style={styles.counterBox}>
                    <View style={styles.counterRow}>
                      <Pressable
                        onPress={() => bumpCount(-1)}
                        style={({ pressed }) => [
                          styles.counterKey,
                          pressed && styles.counterKeyDown,
                        ]}
                        // Held down to walk a miscount back quickly, rather
                        // than tapping fifteen times.
                        onLongPress={() => bumpCount(-5)}
                        delayLongPress={400}
                      >
                        <Text style={styles.counterKeyLabel}>−</Text>
                      </Pressable>

                      <Text style={styles.count}>{node.count ?? 0}</Text>

                      <Pressable
                        onPress={() => bumpCount(1)}
                        style={({ pressed }) => [
                          styles.counterKey,
                          pressed && styles.counterKeyDown,
                        ]}
                        onLongPress={() => bumpCount(5)}
                        delayLongPress={400}
                      >
                        <Text style={styles.counterKeyLabel}>+</Text>
                      </Pressable>
                    </View>

                    <View style={styles.counterLinks}>
                      {(node.count ?? 0) > 0 && (
                        <Pressable
                          onPress={() =>
                            updateNode(node, { count: 0, countedAt: Date.now() })
                          }
                          hitSlop={8}
                        >
                          <Text style={styles.subtleLink}>Reset</Text>
                        </Pressable>
                      )}
                      <Pressable
                        onPress={() =>
                          updateNode(node, { count: null, countedAt: null })
                        }
                        hitSlop={8}
                      >
                        <Text style={styles.subtleLink}>Remove counter</Text>
                      </Pressable>
                    </View>
                  </View>
                </>
              )}

              {showReminders && (
                <>
                  <Text style={styles.label}>Reminders</Text>
                  <ItemReminders value={reminders} onChange={applyReminders} />
                </>
              )}
            </View>
          </ScrollView>
        )}

        {hasDetails && (
          <View style={styles.footer}>
            <VibeButton label="Add" onPress={() => setAddingDetail(true)} />
          </View>
        )}

        {isContainer && (
          <View style={styles.footer}>
            {clearable.length > 0 && (
              <Pressable
                onPress={() => clearable.forEach((c) => deleteNode(c))}
                hitSlop={8}
              >
                <Text style={styles.clearDone}>
                  Clear {clearable.length} completed
                </Text>
              </Pressable>
            )}
            <VibeButton label="Add" onPress={() => setAdding(true)} />
            {isRoot && (
              <Pressable onPress={() => setJoining(true)} hitSlop={8}>
                <Text style={styles.joinLink}>Join with code</Text>
              </Pressable>
            )}
          </View>
        )}
      </KeyboardAvoidingView>

      <AddNodeModal
        visible={adding}
        onClose={() => setAdding(false)}
        // Stays put rather than opening what was just made: adding several
        // things in a row is the common case, and being thrown inside each one
        // means backing out every time.
        onCreate={(fields) => {
          addNode(fields, node);
          setAdding(false);
        }}
      />

      <JoinListModal visible={joining} onClose={() => setJoining(false)} />

      {/* Mounted unconditionally, and visible only by their own flags.
          Wrapping these in a check on the node meant that the instant the node
          went — which is precisely what sharing does to the local copy once
          the upload is confirmed — a visible sheet was unmounted underneath
          the user. On Android each Modal is its own window, and tearing one
          down while it is on screen takes the app with it. */}
      <AddDetailModal
        visible={addingDetail}
        node={node}
        onClose={() => setAddingDetail(false)}
        onPick={addDetail}
      />

      <ShareNodeModal
        visible={sharing}
        node={node}
        onPublished={setPendingRoot}
        onClose={handleShareClose}
      />

      <NodeMenu
        visible={menuOpen}
        node={node}
        onClose={() => setMenuOpen(false)}
        onRename={() => setRenaming(true)}
        onShare={() => setSharing(true)}
        onDelete={confirmDelete}
      />

      <RenameModal
        visible={renaming}
        initialName={node?.name ?? ''}
        onClose={() => setRenaming(false)}
        onSubmit={(name) =>
          node && updateNode(node, { name: name.trim() || node.name })
        }
      />

      <GoalModal
        visible={goalOpen}
        initialHours={node?.goalHours}
        onClose={() => setGoalOpen(false)}
        onSubmit={(hours) => node && applyTimer({ goalHours: hours })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  homeHeader: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
  homeTitle: {
    color: theme.colors.vibeCyan,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
    fontFamily: theme.fonts.main,
  },
  sharedNote: {
    color: theme.colors.vibeCyan,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 4,
    fontFamily: theme.fonts.main,
  },
  list: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    flexGrow: 1,
  },
  listEmpty: {
    paddingTop: 0,
    paddingBottom: 0,
  },
  emptyWrap: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  empty: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: theme.fonts.main,
  },
  // No longer sits under a list, so it doesn't need to be pushed clear of one.
  details: {},
  label: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
    fontFamily: theme.fonts.main,
  },
  note: { minHeight: 90, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 16 },
  addLink: {
    color: theme.colors.vibeBlue,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: theme.fonts.main,
  },
  timerBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 3,
    borderColor: theme.colors.vibeBlue,
    borderRadius: theme.sizes.borderRadius,
    padding: 16,
    alignItems: 'center',
  },
  elapsed: {
    color: theme.colors.textPrimary,
    fontSize: 40,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
    fontFamily: theme.fonts.main,
  },
  goalLine: {
    color: theme.colors.vibeCyan,
    fontSize: 14,
    marginTop: 6,
    fontFamily: theme.fonts.main,
  },
  timerActions: { alignSelf: 'stretch', marginTop: 14 },
  removeTimer: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    textDecorationLine: 'underline',
    fontFamily: theme.fonts.main,
  },
  counterBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 3,
    borderColor: theme.colors.vibeBlue,
    borderRadius: theme.sizes.borderRadius,
    padding: 16,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Big and square: this gets tapped repeatedly, often mid-set and without
  // looking properly at the screen.
  counterKey: {
    width: 68,
    height: 68,
    borderRadius: theme.sizes.borderRadius,
    borderWidth: 2,
    borderColor: theme.colors.vibeBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterKeyDown: { backgroundColor: theme.colors.vibeBlue },
  counterKeyLabel: {
    color: theme.colors.textPrimary,
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 38,
    fontFamily: theme.fonts.main,
  },
  count: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 48,
    fontWeight: '200',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    fontFamily: theme.fonts.main,
  },
  counterLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 12,
  },
  subtleLink: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    textDecorationLine: 'underline',
    fontFamily: theme.fonts.main,
  },
  footer: { paddingHorizontal: 24, paddingBottom: 8 },
  clearDone: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    textDecorationLine: 'underline',
    marginBottom: 10,
    fontFamily: theme.fonts.main,
  },
  joinLink: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    textDecorationLine: 'underline',
    fontFamily: theme.fonts.main,
  },
});
