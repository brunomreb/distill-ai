import '@testing-library/jest-dom';

// Node 26 exposes an incomplete experimental localStorage unless started with --localstorage-file.
// Give jsdom tests a standards-shaped in-memory store, independent of the host Node version.
const values = new Map<string, string>();
const memoryStorage: Storage = {
  get length() {
    return values.size;
  },
  clear: () => values.clear(),
  getItem: (key) => values.get(key) ?? null,
  key: (index) => Array.from(values.keys())[index] ?? null,
  removeItem: (key) => {
    values.delete(key);
  },
  setItem: (key, value) => {
    values.set(key, String(value));
  },
};
Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage, configurable: true });
