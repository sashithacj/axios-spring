import { createTestApi, resetTestEnvironment, mockAxios, generateToken } from './test-utils';
jest.mock('../src/storage', () => require('../__mocks__/storage'));
const Storage = require('../src/storage').default;

describe('7. isAuthenticated() Behavior', () => {
  let api: ReturnType<typeof createTestApi>;

  beforeEach(() => {
    resetTestEnvironment();
    api = createTestApi();
  });

  it('✅ Returns decoded payload if access token is valid', async () => {
    const validToken = generateToken(600); // 10 min expiry
    const refreshToken = generateToken(1200);

    await api.setAuthTokens(validToken, refreshToken);

    const result = await api.isAuthenticated();

    expect(result).not.toBeNull();
    expect(result!.exp).toBeGreaterThan(Date.now() / 1000);
  });

  it('✅ Triggers refresh if token is expired but refreshable', async () => {
    const expiredToken = generateToken(-10); // already expired
    const refreshToken = generateToken(600);
    const newAccessToken = generateToken(600);
    const newRefreshToken = generateToken(1200);

    await api.setAuthTokens(expiredToken, refreshToken);

    mockAxios.onPost('https://api.test.com/auth/refresh').reply(200, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });

    const result = await api.isAuthenticated();

    expect(result).not.toBeNull();
    expect(Storage.setItem).toHaveBeenCalledWith('@axios-spring-access-token', newAccessToken);
    expect(Storage.setItem).toHaveBeenCalledWith('@axios-spring-refresh-token', newRefreshToken);
  });

  it('✅ Returns null if no access token available', async () => {
    await Storage.removeItem('@axios-spring-access-token');
    await Storage.setItem('@axios-spring-refresh-token', generateToken(600));

    const result = await api.isAuthenticated();

    expect(result).toBeNull();
  });

  it('✅ Returns null if refresh fails', async () => {
    const expiredToken = generateToken(-10);
    const refreshToken = generateToken(600);

    await api.setAuthTokens(expiredToken, refreshToken);

    mockAxios.onPost('https://api.test.com/auth/refresh').reply(401);

    const result = await api.isAuthenticated();

    expect(result).toBeNull();
  });
});
