import React, { useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import theme from '../theme/themes';
import { useNodes } from '../store/NodeContext';
import { filingTargets } from '../lib/nodes';

/**
 * Everything you can do to a node, in one sheet off the header.
 *
 * Moving is relative — out to where its parent lives, or into something
 * sitting alongside it — rather than a picker listing every node in the app.
 * Those are the moves you actually want, and the menu stays short however
 * large the tree grows. Anything that can't apply isn't shown at all.
 */
export default function NodeMenu({ visible, node, onClose, onRename, onShare, onDelete }) {
  const { nodes, moveNode } = useNodes();
  const [choosing, setChoosing] = useState(false);

  const parent = useMemo(
    () => nodes.find((n) => n.id === node?.parentId) ?? null,
    [nodes, node]
  );

  // Legal destinations that sit alongside this node.
  const siblings = useMemo(() => {
    if (!node) return [];
    const legal = new Set(filingTargets(nodes, node).map((n) => n.id));
    return nodes.filter(
      (n) => legal.has(n.id) && (n.parentId ?? null) === (node.parentId ?? null)
    );
  }, [nodes, node]);

  const close = () => {
    setChoosing(false);
    onClose();
  };

  // Close, then act once this sheet has actually gone.
  //
  // Every action here opens something else — another sheet, or an alert. On
  // Android each Modal is its own window, and mounting one while another is
  // still dismissing is what produced the black screen when sharing before.
  // The delay covers the dismiss animation.
  const run = (fn) => {
    onClose();
    if (fn) setTimeout(fn, 260);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={close}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title} numberOfLines={1}>
            {node?.name}
          </Text>

          {choosing ? (
            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.hint}>Move into…</Text>
              {siblings.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    moveNode(node, s.id);
                    close();
                  }}
                  style={styles.row}
                >
                  <Text style={styles.rowIcon}>{s.shared ? '👥' : '🗂'}</Text>
                  <Text style={styles.rowLabel} numberOfLines={1}>
                    {s.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <>
              <Pressable onPress={() => run(onRename)} style={styles.row}>
                <Text style={styles.rowIcon}>✎</Text>
                <Text style={styles.rowLabel}>Edit title</Text>
              </Pressable>

              {onShare && (
                <Pressable onPress={() => run(onShare)} style={styles.row}>
                  <Text style={styles.rowIcon}>⤴</Text>
                  <Text style={styles.rowLabel}>
                    {node?.shared ? 'Invite someone' : 'Share'}
                  </Text>
                </Pressable>
              )}

              {node?.parentId && (
                <Pressable
                  onPress={() => {
                    moveNode(node, parent?.parentId ?? null);
                    close();
                  }}
                  style={styles.row}
                >
                  <Text style={styles.rowIcon}>↑</Text>
                  <Text style={styles.rowLabel}>
                    {parent?.parentId ? 'Move up a level' : 'Move to home'}
                  </Text>
                </Pressable>
              )}

              {siblings.length > 0 && (
                <Pressable onPress={() => setChoosing(true)} style={styles.row}>
                  <Text style={styles.rowIcon}>↓</Text>
                  <Text style={styles.rowLabel}>Move into…</Text>
                </Pressable>
              )}

              <Pressable onPress={() => run(onDelete)} style={styles.row}>
                <Text style={styles.rowIcon}>🗑</Text>
                <Text style={[styles.rowLabel, styles.destructive]}>Delete</Text>
              </Pressable>
            </>
          )}

          <Pressable onPress={close} hitSlop={8}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: theme.colors.inputBorder,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 34,
    maxHeight: '80%',
  },
  title: {
    color: theme.colors.vibeCyan,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: theme.fonts.main,
    marginBottom: 10,
  },
  scroll: { flexGrow: 0 },
  hint: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 6,
    fontFamily: theme.fonts.main,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.inputBorder,
  },
  rowIcon: { fontSize: 17, width: 32, color: theme.colors.textPrimary },
  rowLabel: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: theme.fonts.main,
  },
  destructive: { color: theme.colors.vibeRed },
  cancel: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 16,
    fontFamily: theme.fonts.main,
  },
});
