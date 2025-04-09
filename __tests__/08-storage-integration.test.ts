import { createTestApi, resetTestEnvironment, mockAxios, generateToken } from './test-utils';
jest.mock('../src/storage', () => require('../__mocks__/storage'));
const Storage = require('../src/storage').default;

describe('8. Storage Integration', () => {
  let api: ReturnType<typeof createTestApi>;

  beforeEach(() => {
    resetTestEnvironment();
    api = createTestApi();
    jest.clearAllMocks();
  });

  it('✅ Access token is read from storage before each request', async () => {
    const accessToken = generateToken(600);
    const refreshToken = generateToken(1200);

    await Storage.setItem('@axios-spring-access-token', accessToken);
    await Storage.setItem('@axios-spring-refresh-token', refreshToken);

    mockAxios.onGet('/test').reply((config) => {
      return config.headers?.Authorization === `Bearer ${accessToken}`
        ? [200, { ok: true }]
        : [401];
    });

    const response = await api.get('/test');
    expect(response.data.ok).toBe(true);
    expect(Storage.getItem).toHaveBeenCalledWith('@axios-spring-access-token');
  });

  it('✅ Refresh token is read from storage before refresh', async () => {
    const expiredToken = generateToken(-10);
    const refreshToken = generateToken(1200);
    const newAccessToken = generateToken(600);
    const newRefreshToken = generateToken(1200);

    await api.setAuthTokens(expiredToken, refreshToken);

    mockAxios.onPost('https://api.test.com/auth/refresh').reply(200, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });

    await api.isAuthenticated();

    expect(Storage.getItem).toHaveBeenCalledWith('@axios-spring-refresh-token');
  });

  it('✅ Storage read/write/remove functions are used as expected', async () => {
    const accessToken = generateToken(600);
    const refreshToken = generateToken(1200);

    await api.setAuthTokens(accessToken, refreshToken);

    expect(Storage.setItem).toHaveBeenCalledWith('@axios-spring-access-token', accessToken);
    expect(Storage.setItem).toHaveBeenCalledWith('@axios-spring-refresh-token', refreshToken);

    await api.deleteAuthTokens();

    expect(Storage.removeItem).toHaveBeenCalledWith('@axios-spring-access-token');
    expect(Storage.removeItem).toHaveBeenCalledWith('@axios-spring-refresh-token');
  });

  it('✅ Works with async storage implementations', async () => {
    // Backup original mocked functions
    const originalGetItem = Storage.getItem;
    const originalSetItem = Storage.setItem;
    const originalRemoveItem = Storage.removeItem;

    // Override with delayed versions
    Storage.getItem = jest.fn(
      (key: string) =>
        new Promise((resolve) => setTimeout(() => resolve(originalGetItem(key)), 10)),
    );
    Storage.setItem = jest.fn(
      (key: string, value: string) =>
        new Promise((resolve) => setTimeout(() => resolve(originalSetItem(key, value)), 10)),
    );
    Storage.removeItem = jest.fn(
      (key: string) =>
        new Promise((resolve) => setTimeout(() => resolve(originalRemoveItem(key)), 10)),
    );

    const token = generateToken(600);
    await api.setAuthTokens(token, generateToken(1200));

    const result = await api.isAuthenticated();
    expect(result).not.toBeNull();
    expect(Storage.getItem).toHaveBeenCalledWith('@axios-spring-access-token');

    // Restore original storage functions after test
    Storage.getItem = originalGetItem;
    Storage.setItem = originalSetItem;
    Storage.removeItem = originalRemoveItem;
  });
});
