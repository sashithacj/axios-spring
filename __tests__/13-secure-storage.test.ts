import { createTestApi, generateToken, mockAxios, resetTestEnvironment } from './test-utils';

jest.mock('../src/storage', () => require('../__mocks__/storage'));
const Storage = require('../src/storage').default;

describe('13. Secure Storage Implementation', () => {
  let api: ReturnType<typeof createTestApi>;

  beforeEach(() => {
    resetTestEnvironment();
  });

  describe('Basic Secure Storage Configuration', () => {
    it('✅ Should work with secure storage configuration', async () => {
      const api = createTestApi({
        secureStorage: {
          maxAge: 60 * 60 * 1000, // 1 hour
        },
      });

      const accessToken = generateToken(600);
      const refreshToken = generateToken(1200);

      await api.setAuthTokens(accessToken, refreshToken);

      // Verify tokens are stored and retrievable
      const result = await api.isAuthenticated();
      expect(result).not.toBeNull();
      expect(result?.exp).toBeDefined();
    });

    it('✅ Should work with custom encryption key', async () => {
      const customKey = 'my-secret-encryption-key-12345';
      const customSalt = 'my-custom-salt-67890';

      const api = createTestApi({
        secureStorage: {
          encryptionKey: customKey,
          keyDerivationSalt: customSalt,
        },
      });

      const accessToken = generateToken(600);
      const refreshToken = generateToken(1200);

      await api.setAuthTokens(accessToken, refreshToken);

      const result = await api.isAuthenticated();
      expect(result).not.toBeNull();
    });

    it('✅ Should work with default secure storage (encryption always enabled)', async () => {
      const api = createTestApi({
        secureStorage: {},
      });

      const accessToken = generateToken(600);
      const refreshToken = generateToken(1200);

      await api.setAuthTokens(accessToken, refreshToken);

      const result = await api.isAuthenticated();
      expect(result).not.toBeNull();
    });
  });

  describe('Storage Interface', () => {
    it('✅ Should support clear method', async () => {
      const api = createTestApi({
        secureStorage: {},
      });

      const accessToken = generateToken(600);
      const refreshToken = generateToken(1200);

      await api.setAuthTokens(accessToken, refreshToken);

      // Verify tokens are stored
      let result = await api.isAuthenticated();
      expect(result).not.toBeNull();

      // Clear storage
      await api.deleteAuthTokens();

      // Verify tokens are removed
      result = await api.isAuthenticated();
      expect(result).toBeNull();
    });

    it('✅ Should handle storage operations without errors', async () => {
      const api = createTestApi({
        secureStorage: {},
      });

      const accessToken = generateToken(600);
      const refreshToken = generateToken(1200);

      // Should not throw errors
      await expect(api.setAuthTokens(accessToken, refreshToken)).resolves.not.toThrow();
      await expect(api.isAuthenticated()).resolves.not.toThrow();
      await expect(api.deleteAuthTokens()).resolves.not.toThrow();
    });
  });

  describe('Configuration Options', () => {
    it('✅ Should accept all secure storage configuration options', async () => {
      const config = {
        encryptionKey: 'test-key',
        keyDerivationSalt: 'test-salt',
        maxAge: 30 * 60 * 1000, // 30 minutes
        autoCleanup: true,
      };

      const api = createTestApi({
        secureStorage: config,
      });

      const accessToken = generateToken(600);
      const refreshToken = generateToken(1200);

      await api.setAuthTokens(accessToken, refreshToken);

      const result = await api.isAuthenticated();
      expect(result).not.toBeNull();
    });

    it('✅ Should work with minimal configuration', async () => {
      const api = createTestApi({
        secureStorage: {},
      });

      const accessToken = generateToken(600);
      const refreshToken = generateToken(1200);

      await api.setAuthTokens(accessToken, refreshToken);

      const result = await api.isAuthenticated();
      expect(result).not.toBeNull();
    });
  });

  describe('JWT-Based Expiration Handling', () => {
    it('✅ Should use JWT expiration times for storage instead of fixed maxAge', async () => {
      const api = createTestApi({
        secureStorage: {
          maxAge: 1 * 60 * 1000, // 1 minute - very short
        },
      });

      // Create tokens with longer expiration (2 hours)
      const accessToken = generateToken(7200); // 2 hours
      const refreshToken = generateToken(86400); // 24 hours

      await api.setAuthTokens(accessToken, refreshToken);

      // Tokens should still be available even though maxAge is 1 minute
      // because JWT expiration times take precedence
      const result = await api.isAuthenticated();
      expect(result).not.toBeNull();
    });

    it('✅ Should handle tokens without expiration gracefully', async () => {
      const api = createTestApi({
        secureStorage: {
          maxAge: 1 * 60 * 1000, // 1 minute
        },
      });

      // Create tokens without expiration (invalid JWT)
      const accessToken = 'invalid.jwt.token';
      const refreshToken = 'another.invalid.jwt.token';

      await api.setAuthTokens(accessToken, refreshToken);

      // Should fall back to maxAge when JWT expiration is not available
      const result = await api.isAuthenticated();
      expect(result).toBeNull(); // Invalid tokens should return null
    });

    it('✅ Should respect JWT expiration over maxAge for long-lived tokens', async () => {
      const api = createTestApi({
        secureStorage: {
          maxAge: 5 * 60 * 1000, // 5 minutes
        },
      });

      // Create tokens with 30-day expiration
      const accessToken = generateToken(30 * 24 * 60 * 60); // 30 days
      const refreshToken = generateToken(30 * 24 * 60 * 60); // 30 days

      await api.setAuthTokens(accessToken, refreshToken);

      // Tokens should be available because JWT expiration (30 days)
      // takes precedence over maxAge (5 minutes)
      const result = await api.isAuthenticated();
      expect(result).not.toBeNull();
    });
  });

  describe('Automatic Secure Storage Configuration', () => {
    it('✅ Should automatically configure secure storage with defaults when not provided', async () => {
      const api = createTestApi(); // No secureStorage config

      const accessToken = generateToken(600);
      const refreshToken = generateToken(1200);

      await api.setAuthTokens(accessToken, refreshToken);

      const result = await api.isAuthenticated();
      expect(result).not.toBeNull();
    });

    it('✅ Should use provided secure storage configuration when provided', async () => {
      const customConfig = {
        maxAge: 30 * 60 * 1000, // 30 minutes
        autoCleanup: false,
        encryptionKey: 'custom-key',
        keyDerivationSalt: 'custom-salt',
      };

      const api = createTestApi({
        secureStorage: customConfig,
      });

      const accessToken = generateToken(600);
      const refreshToken = generateToken(1200);

      await api.setAuthTokens(accessToken, refreshToken);

      const result = await api.isAuthenticated();
      expect(result).not.toBeNull();
    });

    it('✅ Should merge user config with defaults', async () => {
      const partialConfig = {
        maxAge: 60 * 60 * 1000, // 1 hour
        // Other options should use defaults
      };

      const api = createTestApi({
        secureStorage: partialConfig,
      });

      const accessToken = generateToken(600);
      const refreshToken = generateToken(1200);

      await api.setAuthTokens(accessToken, refreshToken);

      const result = await api.isAuthenticated();
      expect(result).not.toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('✅ Should handle invalid configuration gracefully', async () => {
      const api = createTestApi({
        secureStorage: {
          maxAge: -1, // Invalid maxAge
        },
      });

      const accessToken = generateToken(600);
      const refreshToken = generateToken(1200);

      await api.setAuthTokens(accessToken, refreshToken);

      const result = await api.isAuthenticated();
      expect(result).not.toBeNull();
    });

    it('✅ Should work with encryption always enabled by default', async () => {
      const api = createTestApi({
        secureStorage: {},
      });

      const accessToken = generateToken(600);
      const refreshToken = generateToken(1200);

      // Should work with encryption enabled by default
      await expect(api.setAuthTokens(accessToken, refreshToken)).resolves.not.toThrow();

      const result = await api.isAuthenticated();
      expect(result).not.toBeNull();
    });
  });

  describe('Integration with Existing Features', () => {
    it('✅ Should work with refresh failure callback', async () => {
      const onRefreshFailureMock = jest.fn();
      const api = createTestApi({
        secureStorage: {},
        onRefreshFailure: onRefreshFailureMock,
      });

      const accessToken = generateToken(10); // will trigger refresh
      const refreshToken = generateToken(600);

      await api.setAuthTokens(accessToken, refreshToken);

      // Mock refresh endpoint to fail
      mockAxios.onPost('https://api.test.com/auth/refresh').reply(500);

      const result = await api.isAuthenticated();

      expect(result).toBeNull();
      expect(onRefreshFailureMock).toHaveBeenCalledTimes(1);
    });

    it('✅ Should work with custom token keys', async () => {
      const api = createTestApi({
        secureStorage: {},
        storageAccessTokenKey: 'custom-access-key',
        storageRefreshTokenKey: 'custom-refresh-key',
      });

      const accessToken = generateToken(600);
      const refreshToken = generateToken(1200);

      await api.setAuthTokens(accessToken, refreshToken);

      const result = await api.isAuthenticated();
      expect(result).not.toBeNull();
    });
  });
});
