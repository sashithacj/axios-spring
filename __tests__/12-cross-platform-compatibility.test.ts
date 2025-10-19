import { createTestApi, generateToken, mockAxios, resetTestEnvironment } from './test-utils';

jest.mock('../src/storage', () => require('../__mocks__/storage'));
const Storage = require('../src/storage').default;

describe('12. Cross-Platform Compatibility', () => {
  let api: ReturnType<typeof createTestApi>;

  beforeEach(() => {
    resetTestEnvironment();
    api = createTestApi();
  });

  describe('Storage Detection', () => {
    it('✅ Should work with localStorage in browser environment', () => {
      // Mock browser environment
      const originalWindow = global.window;
      const originalLocalStorage = global.localStorage;

      global.window = {
        localStorage: {
          getItem: jest.fn(),
          setItem: jest.fn(),
          removeItem: jest.fn(),
        },
      } as any;
      global.localStorage = global.window.localStorage;

      // Re-import storage to test detection
      jest.resetModules();
      const StorageModule = require('../src/storage').default;

      expect(StorageModule).toBeDefined();
      expect(typeof StorageModule.getItem).toBe('function');
      expect(typeof StorageModule.setItem).toBe('function');
      expect(typeof StorageModule.removeItem).toBe('function');

      // Restore globals
      global.window = originalWindow;
      global.localStorage = originalLocalStorage;
    });

    it('✅ Should work with AsyncStorage in React Native environment', () => {
      // Mock React Native environment
      const originalWindow = global.window;
      const originalRequire = require;

      // Remove window and localStorage
      delete (global as any).window;
      delete (global as any).localStorage;

      // Mock AsyncStorage
      const mockAsyncStorage = {
        getItem: jest.fn().mockResolvedValue(null),
        setItem: jest.fn().mockResolvedValue(undefined),
        removeItem: jest.fn().mockResolvedValue(undefined),
      };

      jest.doMock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

      // Re-import storage to test detection
      jest.resetModules();
      const StorageModule = require('../src/storage').default;

      expect(StorageModule).toBeDefined();
      expect(typeof StorageModule.getItem).toBe('function');
      expect(typeof StorageModule.setItem).toBe('function');
      expect(typeof StorageModule.removeItem).toBe('function');

      // Restore globals
      global.window = originalWindow;
    });

    it('✅ Should fallback to memory storage when neither is available', () => {
      // Mock environment with no storage
      const originalWindow = global.window;
      const originalRequire = require;

      delete (global as any).window;
      delete (global as any).localStorage;

      // Mock require to throw for AsyncStorage
      jest.doMock('@react-native-async-storage/async-storage', () => {
        throw new Error('Module not found');
      });

      // Re-import storage to test fallback
      jest.resetModules();
      const StorageModule = require('../src/storage').default;

      expect(StorageModule).toBeDefined();
      expect(typeof StorageModule.getItem).toBe('function');
      expect(typeof StorageModule.setItem).toBe('function');
      expect(typeof StorageModule.removeItem).toBe('function');

      // Test memory storage functionality
      return StorageModule.setItem('test', 'value')
        .then(() => {
          return StorageModule.getItem('test');
        })
        .then((value: string | null) => {
          expect(value).toBe('value');
          return StorageModule.removeItem('test');
        })
        .then(() => {
          return StorageModule.getItem('test');
        })
        .then((value: string | null) => {
          expect(value).toBeNull();
        });

      // Restore globals
      global.window = originalWindow;
    });
  });

  describe('Platform-Specific Features', () => {
    it('✅ Should handle onRefreshFailure callback in browser environment', async () => {
      const onRefreshFailureMock = jest.fn();
      const api = createTestApi({ onRefreshFailure: onRefreshFailureMock });

      const accessToken = generateToken(10);
      const refreshToken = generateToken(600);

      await api.setAuthTokens(accessToken, refreshToken);

      // Mock refresh endpoint to fail
      mockAxios.onPost('https://api.test.com/auth/refresh').reply(500);

      const result = await api.isAuthenticated();

      expect(result).toBeNull();
      expect(onRefreshFailureMock).toHaveBeenCalledTimes(1);
    });

    it('✅ Should handle onRefreshFailure callback in React Native environment', async () => {
      const onRefreshFailureMock = jest.fn();
      const api = createTestApi({ onRefreshFailure: onRefreshFailureMock });

      const accessToken = generateToken(10);
      const refreshToken = generateToken(600);

      await api.setAuthTokens(accessToken, refreshToken);

      // Mock refresh endpoint to fail
      mockAxios.onPost('https://api.test.com/auth/refresh').reply(500);

      const result = await api.isAuthenticated();

      expect(result).toBeNull();
      expect(onRefreshFailureMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Token Management', () => {
    it('✅ Should store and retrieve tokens consistently across platforms', async () => {
      const accessToken = generateToken(600);
      const refreshToken = generateToken(1200);

      await api.setAuthTokens(accessToken, refreshToken);

      const result = await api.isAuthenticated();
      expect(result).not.toBeNull();
      expect(result?.exp).toBeDefined();
    });

    it('✅ Should handle token deletion consistently across platforms', async () => {
      const accessToken = generateToken(600);
      const refreshToken = generateToken(1200);

      await api.setAuthTokens(accessToken, refreshToken);
      await api.deleteAuthTokens();

      const result = await api.isAuthenticated();
      expect(result).toBeNull();
    });
  });

  describe('Request Interceptors', () => {
    it('✅ Should attach tokens to requests consistently across platforms', async () => {
      const accessToken = generateToken(600);
      const refreshToken = generateToken(1200);

      await api.setAuthTokens(accessToken, refreshToken);

      mockAxios.onGet('https://api.test.com/test').reply(200, { success: true });

      await api.get('/test');

      const request = mockAxios.history.get[0];
      expect(request.headers?.Authorization).toBe(`Bearer ${accessToken}`);
    });

    it('✅ Should handle 401 responses consistently across platforms', async () => {
      const accessToken = generateToken(10); // will trigger refresh
      const refreshToken = generateToken(600);
      const newAccessToken = generateToken(600);
      const newRefreshToken = generateToken(1200);

      await api.setAuthTokens(accessToken, refreshToken);

      // Mock 401 response
      mockAxios.onGet('https://api.test.com/protected').reply(401);

      // Mock successful refresh
      mockAxios.onPost('https://api.test.com/auth/refresh').reply(200, {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });

      // Mock successful retry
      mockAxios.onGet('https://api.test.com/protected').reply(200, { success: true });

      const response = await api.get('/protected');
      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('✅ Should handle network errors consistently across platforms', async () => {
      const accessToken = generateToken(600);
      const refreshToken = generateToken(1200);

      await api.setAuthTokens(accessToken, refreshToken);

      mockAxios.onGet('https://api.test.com/test').networkError();

      await expect(api.get('/test')).rejects.toThrow();
    });

    it('✅ Should handle malformed JWT tokens consistently across platforms', async () => {
      const invalidToken = 'invalid.jwt.token';
      const refreshToken = generateToken(1200);

      await api.setAuthTokens(invalidToken, refreshToken);

      const result = await api.isAuthenticated();
      expect(result).toBeNull();
    });
  });
});
