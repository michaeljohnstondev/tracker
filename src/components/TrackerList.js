import React from 'react';
import ReorderableList from 'react-native-reorderable-list';
import TrackerCard from './TrackerCard';

/**
 * The shared tracker list, used by the home screen and inside categories.
 *
 * Drag reorders, and only reorders. An earlier version also let you drop a
 * card *into* a category by pausing over it, inferring the target from which
 * item had been displaced — a reorder list has no real notion of hovering over
 * something, so that was the only way to fake it. It was dropped: filing one
 * item at a time is the wrong tool for organising a pile of trackers anyway,
 * and a gesture that can file something when you meant to reorder fails
 * silently, which you'd only notice later when a tracker went missing.
 *
 * Filing now lives in two deliberate places: hold a card to move it, or edit a
 * category to tick off everything that belongs in it.
 */
export default function TrackerList({ data, onOpen, onHold, onReorder, ...listProps }) {
  return (
    <ReorderableList
      data={data}
      keyExtractor={(t) => t.id}
      onReorder={({ from, to }) => onReorder?.(from, to)}
      renderItem={({ item, index }) => (
        <TrackerCard
          tracker={item}
          index={index}
          onPress={() => onOpen?.(item.id)}
          onHold={() => onHold?.(item)}
        />
      )}
      {...listProps}
    />
  );
}
