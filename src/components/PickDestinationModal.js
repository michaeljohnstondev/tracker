import React, { useMemo } from 'react';
import { Modal, View, Text, Pressable, ScrollView } from 'react-native';
import { useThemedStyles } from '../theme/ThemeContext';
import { useNodes } from '../store/NodeContext';
import { descendantsOf } from '../lib/nodes';

/**
 * Where a batch of nodes should end up.
 *
 * Every category in the tree, shown with its path, plus the home screen. A
 * flat list rather than a tree you navigate: the point of this sheet is to get
 * the job done in one tap, and drilling through folders to find a folder is
 * the tedium the whole selection flow exists to remove.
 *
 * Anything that would swallow itself is left out — a node can't be moved into
 * itself or into anything under it, which would detach that branch from the
 * tree entirely.
 */
export default function PickDestinationModal({
  visible,
  verb = 'Move',
  moving = [],
  currentParentId = null,
  onClose,
  onPick,
}) {
  const styles = useThemedStyles(makeStyles);
  const { nodes } = useNodes();

  const targets = useMemo(() => {
    if (!visible) return [];

    const banned = new Set();
    moving.forEach((node) => {
      banned.add(node.id);
      descendantsOf(nodes, node.id).forEach((n) => banned.add(n.id));
    });

    const nameFor = (id) => nodes.find((n) => n.id === id)?.name;

    // "Health › Gym" rather than "Gym", since two categories can easily share
    // a name and there's nothing else here to tell them apart.
    const pathOf = (node) => {
      const parts = [node.name];
      let parentId = node.parentId;
      let guard = 0;
      while (parentId && guard < 12) {
        const name = nameFor(parentId);
        if (!name) break;
        parts.unshift(name);
        parentId = nodes.find((n) => n.id === parentId)?.parentId;
        guard += 1;
      }
      return parts.join(' › ');
    };

    return nodes
      .filter((n) => n.kind === 'category' && !banned.has(n.id))
      .map((n) => ({ id: n.id, label: pathOf(n) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [visible, nodes, moving]);

  const count = moving.length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>
            {verb} {count} {count === 1 ? 'thing' : 'things'} to…
          </Text>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {currentParentId !== null && (
              <Pressable style={styles.row} onPress={() => onPick(null)}>
                <Text style={styles.rowLabel}>Home</Text>
              </Pressable>
            )}

            {targets.map((target) => (
              <Pressable
                key={target.id}
                style={styles.row}
                onPress={() => onPick(target.id)}
                disabled={target.id === currentParentId}
              >
                <Text
                  style={[
                    styles.rowLabel,
                    target.id === currentParentId && styles.rowHere,
                  ]}
                >
                  {target.label}
                  {target.id === currentParentId ? '  (already here)' : ''}
                </Text>
              </Pressable>
            ))}

            {targets.length === 0 && (
              <Text style={styles.empty}>
                Nowhere to put these yet. Make a category first.
              </Text>
            )}
          </ScrollView>

          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (t) => ({
  overlay: { flex: 1, backgroundColor: t.semantic.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: t.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: t.colors.inputBorder,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 34,
    maxHeight: '75%',
  },
  title: {
    color: t.colors.vibeCyan,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    fontFamily: t.fonts.main,
  },
  scroll: { flexGrow: 0 },
  row: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.inputBorder,
  },
  rowLabel: {
    color: t.colors.textPrimary,
    fontSize: 16,
    fontFamily: t.fonts.main,
  },
  rowHere: { color: t.colors.textSecondary },
  empty: {
    color: t.colors.textSecondary,
    fontSize: 15,
    paddingVertical: 20,
    fontFamily: t.fonts.main,
  },
  cancel: {
    color: t.colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 16,
    fontFamily: t.fonts.main,
  },
});
