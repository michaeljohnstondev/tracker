import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import theme from '../theme/themes';
import VibeInput from './ui/VibeInput';
import VibeButton from './ui/VibeButton';
import { useKeyboardHeight } from '../lib/useKeyboardHeight';
import { useTrackers } from '../store/TrackerContext';
import { filingTargets, contentCandidates } from '../lib/trackers';
import { resolveColor } from '../lib/format';

// Edit sheet for a tracker's name and which category it sits in.
export default function RenameModal({
  visible,
  tracker,
  initialName,
  initialParentId,
  onClose,
  onSubmit,
}) {
  const { trackers, setTrackerParent } = useTrackers();
  const [name, setName] = useState(initialName ?? '');
  const [parentId, setParentId] = useState(initialParentId ?? null);
  const keyboardHeight = useKeyboardHeight();

  const categories = useMemo(
    () => (tracker ? filingTargets(trackers, tracker) : []),
    [trackers, tracker]
  );

  const isCategory = tracker?.type === 'category';

  // For a category, the sheet doubles as its contents list.
  const candidates = useMemo(
    () => (isCategory ? contentCandidates(trackers, tracker) : []),
    [isCategory, trackers, tracker]
  );

  // Ticking files something in; unticking pushes it up to wherever this
  // category itself lives, rather than dumping it at the top level.
  const toggleContent = useCallback(
    (child) => {
      const inside = child.parentId === tracker.id;
      setTrackerParent(child.id, inside ? tracker.parentId ?? null : tracker.id);
    },
    [tracker, setTrackerParent]
  );

  // Re-seed on open rather than on every prop change, so a rename landing from
  // someone else's phone mid-edit doesn't yank the text out from under you.
  useEffect(() => {
    if (visible) {
      setName(initialName ?? '');
      setParentId(initialParentId ?? null);
    }
  }, [visible, initialName, initialParentId]);

  const save = useCallback(() => {
    onSubmit(name, parentId);
    onClose();
  }, [name, parentId, onSubmit, onClose]);

  const canSave = name.trim().length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: 34 + keyboardHeight }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* The whole sheet scrolls. With a long contents list and the
              keyboard up, a category's sheet outgrew the screen and pushed the
              name field out of sight — the one thing you opened it to edit. */}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
          <Text style={styles.title}>Edit tracker</Text>

          <VibeInput
            value={name}
            onChangeText={setName}
            placeholder="Name"
            autoFocus
            selectTextOnFocus
            maxLength={40}
            autoCapitalize="sentences"
            onSubmitEditing={canSave ? save : undefined}
            returnKeyType="done"
          />

          {/* Hidden until there's somewhere to file it. */}
          {categories.length > 0 && (
            <>
              <Text style={styles.label}>Category</Text>
              <View style={styles.chips}>
                <VibeButton
                  label="None"
                  variant="toggle"
                  color={parentId ? 'gray' : 'green'}
                  onPress={() => setParentId(null)}
                  style={styles.chip}
                />
                {categories.map((c) => (
                  <VibeButton
                    key={c.id}
                    label={c.name}
                    variant="toggle"
                    color={c.id === parentId ? 'green' : 'gray'}
                    onPress={() => setParentId(c.id)}
                    style={styles.chip}
                  />
                ))}
              </View>
            </>
          )}

          {isCategory && (
            <>
              <Text style={styles.label}>What's in here</Text>
              {candidates.length === 0 ? (
                <Text style={styles.hint}>Nothing else to file yet.</Text>
              ) : (
                <View style={styles.contents}>
                  {candidates.map((c) => {
                    const inside = c.parentId === tracker.id;
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => toggleContent(c)}
                        style={styles.contentRow}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            { borderColor: resolveColor(c.color) },
                            inside && {
                              backgroundColor: resolveColor(c.color),
                            },
                          ]}
                        >
                          {inside ? <Text style={styles.check}>✓</Text> : null}
                        </View>
                        <Text style={styles.contentLabel} numberOfLines={1}>
                          {c.name}
                        </Text>
                        <Text style={styles.contentType}>
                          {c.type === 'category'
                            ? '🗂'
                            : c.type === 'timer'
                              ? '⏱'
                              : '☰'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </>
          )}

          <View style={styles.actions}>
            <VibeButton
              label="Save"
              variant="green"
              onPress={save}
              disabled={!canSave}
            />
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: theme.colors.inputBorder,
    paddingHorizontal: 24,
    paddingTop: 22,
    // Capped so the sheet can never grow past the screen; its ScrollView takes
    // over from there.
    maxHeight: '88%',
  },
  title: {
    color: theme.colors.vibeCyan,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: theme.fonts.main,
    marginBottom: 14,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
    fontFamily: theme.fonts.main,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  hint: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
    fontFamily: theme.fonts.main,
  },
  // Rendered inline rather than in its own scroll view: nesting a scroller
  // inside the sheet's scroller makes both fight over the same drag.
  contents: {
    marginTop: 2,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    color: theme.colors.black,
    fontSize: 14,
    fontWeight: '900',
  },
  contentLabel: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontFamily: theme.fonts.main,
  },
  contentType: {
    fontSize: 14,
    marginLeft: 8,
  },
  actions: {
    marginTop: 22,
    alignItems: 'stretch',
  },
  cancel: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    fontFamily: theme.fonts.main,
  },
});
