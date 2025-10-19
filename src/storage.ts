type StorageInterface = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

let Storage: StorageInterface;

(function initializeStorage() {
  // Check for browser environment (React/Next.js)
  if (typeof window !== 'undefined' && window.localStorage) {
    Storage = {
      getItem: (key) => Promise.resolve(localStorage.getItem(key)),
      setItem: (key, value) => {
        localStorage.setItem(key, value);
        return Promise.resolve();
      },
      removeItem: (key) => {
        localStorage.removeItem(key);
        return Promise.resolve();
      },
    };
    return;
  }

  // Check for React Native environment
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    Storage = {
      getItem: (key) => AsyncStorage.getItem(key),
      setItem: (key, value) => AsyncStorage.setItem(key, value),
      removeItem: (key) => AsyncStorage.removeItem(key),
    };
    return;
  } catch {
    // AsyncStorage not available, this is expected in some environments
  }

  // Fallback to memory storage (for testing or unsupported environments)
  const memoryStore: Record<string, string> = {};
  Storage = {
    getItem: (key) => Promise.resolve(memoryStore[key] || null),
    setItem: (key, value) => {
      memoryStore[key] = value;
      return Promise.resolve();
    },
    removeItem: (key) => {
      delete memoryStore[key];
      return Promise.resolve();
    },
  };
})();

export default Storage;
