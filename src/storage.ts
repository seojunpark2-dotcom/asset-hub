import * as SecureStore from 'expo-secure-store';
// Chunked storage keeps sessions and portfolio snapshots below native item limits.
export const secureStorage = {
  async getItem(key: string) {
    const meta = await SecureStore.getItemAsync(key + '.meta');
    if (!meta) return null;
    const { slot, count } = JSON.parse(meta) as { slot: number; count: number };
    const chunks = await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(key + '.' + slot + '.' + i)));
    return chunks.some(c => c === null) ? null : chunks.join('');
  },
  async setItem(key: string, value: string) {
    const old = await SecureStore.getItemAsync(key + '.meta');
    const slot = old ? 1 - JSON.parse(old).slot : 0;
    const chunks = value.match(/[\s\S]{1,500}/g) ?? [''];
    for (let i = 0; i < chunks.length; i++) await SecureStore.setItemAsync(key + '.' + slot + '.' + i, chunks[i]!);
    await SecureStore.setItemAsync(key + '.meta', JSON.stringify({ slot, count: chunks.length }));
    if (old) {
      const previous = JSON.parse(old);
      for (let i = 0; i < previous.count; i++) await SecureStore.deleteItemAsync(key + '.' + previous.slot + '.' + i);
    }
  },
  async removeItem(key: string) {
    const old = await SecureStore.getItemAsync(key + '.meta');
    await SecureStore.deleteItemAsync(key + '.meta');
    if (old) { const previous = JSON.parse(old); for (let i = 0; i < previous.count; i++) await SecureStore.deleteItemAsync(key + '.' + previous.slot + '.' + i); }
  },
};
