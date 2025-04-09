import { createTestApi, generateToken, resetTestEnvironment } from './test-utils';
jest.mock('../src/storage', () => require('../__mocks__/storage'));
const Storage = require('../src/storage').default;

describe('Token Setting & Deletion', () => {
  const accessToken = generateToken(300); // expires in 5 min
  const refreshToken = generateToken(600); // expires in 10 min

  let api: ReturnType<typeof createTestApi>;

  beforeEach(() => {
    resetTestEnvironment();
    api = createTestApi();
  });

  it('✅ setAuthTokens() stores both access and refresh tokens', async () => {
    await api.setAuthTokens(accessToken, refreshToken);
    expect(await Storage.getItem('@axios-spring-access-token')).toBe(accessToken);
    expect(await Storage.getItem('@axios-spring-refresh-token')).toBe(refreshToken);
  });

  it('✅ deleteAuthTokens() removes both tokens from storage', async () => {
    await api.setAuthTokens(accessToken, refreshToken);
    await api.deleteAuthTokens();
    expect(await Storage.getItem('@axios-spring-access-token')).toBeNull();
    expect(await Storage.getItem('@axios-spring-refresh-token')).toBeNull();
  });

  it('✅ setAuthTokens() overrides existing stored tokens', async () => {
    const token1 = generateToken(100);
    const token2 = generateToken(200);
    await api.setAuthTokens(token1, token1);
    await api.setAuthTokens(token2, token2);
    expect(await Storage.getItem('@axios-spring-access-token')).toBe(token2);
    expect(await Storage.getItem('@axios-spring-refresh-token')).toBe(token2);
  });

  it('✅ deleteAuthTokens() does not throw if tokens are already missing', async () => {
    await expect(api.deleteAuthTokens()).resolves.not.toThrow();
  });

  it('✅ Tokens are saved to the correct keys from the instance', async () => {
    await api.setAuthTokens(accessToken, refreshToken);
    const accessKey = (api as any)[Symbol.for('accessTokenKey')] ?? '@axios-spring-access-token';
    const refreshKey = (api as any)[Symbol.for('refreshTokenKey')] ?? '@axios-spring-refresh-token';
    expect(await Storage.getItem(accessKey)).toBe(accessToken);
    expect(await Storage.getItem(refreshKey)).toBe(refreshToken);
  });
});
