import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Where a shared tree's root sits on *this* device, as rootId -> parentId.
 *
 * Kept on the device rather than on the shared document because filing is
 * personal: a list you keep under Shopping may live somewhere else entirely
 * for whoever you share it with, and neither should overwrite the other. It's
 * also the only way a shared root — which has no parent on the server — can
 * appear anywhere but the top level.
 */
const KEY = 'filing.v1';

export async function loadFiling() {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw == null) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveFiling(map) {
  await AsyncStorage.setItem(KEY, JSON.stringify(map));
}
