// __mocks__/storage.ts
const mockStorage: Record<string, string> = {};

const Storage = {
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStorage[key];
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    return Promise.resolve();
  }),
  __reset: () => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    Storage.getItem.mockClear();
    Storage.setItem.mockClear();
    Storage.removeItem.mockClear();
    Storage.clear.mockClear();
  },
};

// Mock the initializeSecureStorage function
export const initializeSecureStorage = jest.fn((config: any) => {
  return Storage;
});

export default Storage;
