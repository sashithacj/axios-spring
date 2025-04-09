import { createTestApi, generateToken, mockAxios, resetTestEnvironment } from './test-utils';

jest.mock('../src/storage', () => require('../__mocks__/storage'));
const Storage = require('../src/storage').default;

describe('4. Token Refreshing Logic', () => {
  let api: ReturnType<typeof createTestApi>;

  beforeEach(() => {
    resetTestEnvironment();
    api = createTestApi();
  });

  it('✅ Refresh token is used to fetch new access/refresh tokens', async () => {
    const accessToken = generateToken(10); // will trigger refresh
    const refreshToken = generateToken(600);
    const newAccessToken = generateToken(600);
    const newRefreshToken = generateToken(1200);

    await api.setAuthTokens(accessToken, refreshToken);

    mockAxios.onPost('https://api.test.com/auth/refresh').reply(200, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });

    const result = await api.isAuthenticated();

    expect(result).not.toBeNull();
    expect(Storage.setItem).toHaveBeenCalledWith('@axios-spring-access-token', newAccessToken);
    expect(Storage.setItem).toHaveBeenCalledWith('@axios-spring-refresh-token', newRefreshToken);
  });

  it('✅ Refresh fails if refresh token is missing', async () => {
    const accessToken = generateToken(10); // triggers refresh

    await Storage.setItem('@axios-spring-access-token', accessToken);

    const result = await api.isAuthenticated();

    expect(result).toBeNull();
  });

  it('✅ Refresh fails if refresh endpoint returns malformed response', async () => {
    const accessToken = generateToken(10);
    const refreshToken = generateToken(600);

    await api.setAuthTokens(accessToken, refreshToken);

    mockAxios.onPost('https://api.test.com/auth/refresh').reply(200, {
      invalid: 'structure',
    });

    const result = await api.isAuthenticated();

    expect(result).toBeNull();
  });

  it('✅ Tokens from response are saved to storage', async () => {
    const accessToken = generateToken(10);
    const refreshToken = generateToken(600);
    const newAccessToken = generateToken(600);
    const newRefreshToken = generateToken(1200);

    await api.setAuthTokens(accessToken, refreshToken);

    mockAxios.onPost('https://api.test.com/auth/refresh').reply(200, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });

    await api.isAuthenticated();

    expect(Storage.setItem).toHaveBeenCalledWith('@axios-spring-access-token', newAccessToken);
    expect(Storage.setItem).toHaveBeenCalledWith('@axios-spring-refresh-token', newRefreshToken);
  });

  it('✅ Refresh is only triggered once when multiple requests come in', async () => {
    const expiringToken = generateToken(1);
    const refreshToken = generateToken(600);
    const newAccessToken = generateToken(600);
    const newRefreshToken = generateToken(1200);

    await api.setAuthTokens(expiringToken, refreshToken);

    // clear previous history
    const beforeRefreshCalls = mockAxios.history.post.filter(
      (req) => req.url === 'https://api.test.com/auth/refresh',
    );

    mockAxios.onPost('https://api.test.com/auth/refresh').reply(200, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });

    await Promise.all([api.isAuthenticated(), api.isAuthenticated(), api.isAuthenticated()]);

    const afterRefreshCalls = mockAxios.history.post.filter(
      (req) => req.url === 'https://api.test.com/auth/refresh',
    );

    expect(afterRefreshCalls.length - beforeRefreshCalls.length).toBe(1); // should trigger refresh only once
  });

  it('✅ Pending requests are queued during refresh', async () => {
    const expiringToken = generateToken(1);
    const refreshToken = generateToken(600);
    const newAccessToken = generateToken(600);
    const newRefreshToken = generateToken(1200);

    await api.setAuthTokens(expiringToken, refreshToken);

    let refreshResolver: (value: [number, any]) => void;
    const refreshPromise: Promise<[number, any]> = new Promise((resolve) => {
      refreshResolver = resolve;
    });

    mockAxios.onPost('https://api.test.com/auth/refresh').reply(() => refreshPromise);

    const promises = [api.isAuthenticated(), api.isAuthenticated(), api.isAuthenticated()];

    setTimeout(() => {
      refreshResolver([
        200,
        {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        },
      ]);
    }, 100);

    const results = await Promise.all(promises);
    expect(results.every((r) => r !== null)).toBe(true);
  });

  it('✅ Pending requests are resolved with new token after success', async () => {
    const expiringToken = generateToken(1);
    const refreshToken = generateToken(600);
    const newAccessToken = generateToken(600);
    const newRefreshToken = generateToken(1200);

    await api.setAuthTokens(expiringToken, refreshToken);

    mockAxios.onPost('https://api.test.com/auth/refresh').reply(200, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });

    const [res1, res2] = await Promise.all([api.isAuthenticated(), api.isAuthenticated()]);

    expect(res1?.exp).toBeDefined();
    expect(res2?.exp).toBeDefined();
  });

  it('✅ Pending requests are rejected on refresh failure', async () => {
    const expiringToken = generateToken(1);
    const refreshToken = generateToken(600);

    await api.setAuthTokens(expiringToken, refreshToken);

    mockAxios.onPost('https://api.test.com/auth/refresh').reply(500);

    const [res1, res2] = await Promise.all([api.isAuthenticated(), api.isAuthenticated()]);

    expect(res1).toBeNull();
    expect(res2).toBeNull();
  });

  it('✅ Failed requests queue resets after success', async () => {
    const expiringToken = generateToken(1);
    const refreshToken = generateToken(600);
    const newAccessToken = generateToken(600);
    const newRefreshToken = generateToken(1200);

    await api.setAuthTokens(expiringToken, refreshToken);

    mockAxios.onPost('https://api.test.com/auth/refresh').reply(200, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });

    await api.isAuthenticated();

    // next call should not be queued
    mockAxios.onPost('https://api.test.com/auth/refresh').reply(500);

    const result = await api.isAuthenticated();
    expect(result).not.toBeNull(); // should still use valid accessToken
  });

  it('✅ Failed requests queue resets after failure', async () => {
    const expiringToken = generateToken(1);
    const refreshToken = generateToken(600);

    await api.setAuthTokens(expiringToken, refreshToken);

    mockAxios.onPost('https://api.test.com/auth/refresh').reply(500);

    await api.isAuthenticated(); // fails and clears queue

    // Should start fresh
    mockAxios.onPost('https://api.test.com/auth/refresh').reply(500);
    const result = await api.isAuthenticated();

    expect(result).toBeNull();
  });
});
