import { createTestApi, generateToken, mockAxios, resetTestEnvironment } from './test-utils';
jest.mock('../src/storage', () => require('../__mocks__/storage'));
const Storage = require('../src/storage').default;
import { decode, JwtPayload } from 'jsonwebtoken';

describe('3. Token Decoding & Validation', () => {
  let api: ReturnType<typeof createTestApi>;

  beforeEach(() => {
    resetTestEnvironment();
    api = createTestApi();
  });

  it('✅ JWT decoding returns expiration timestamp for valid tokens', () => {
    const token = generateToken(300);
    const decoded = decode(token) as JwtPayload;
    expect(typeof decoded?.exp).toBe('number');
  });

  it('✅ JWT decoding handles malformed or invalid tokens', async () => {
    const malformedToken = 'invalid.token.string';
    await api.setAuthTokens(malformedToken, 'some-refresh-token');

    const result = await api.isAuthenticated();
    expect(result).toBeNull();
  });

  it('✅ JWT decoding returns null if exp is missing', async () => {
    // manually create token with no `exp`
    const noExpToken = [
      Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64'),
      Buffer.from(JSON.stringify({ user: 'test-user' })).toString('base64'),
      'signature',
    ].join('.');

    await api.setAuthTokens(noExpToken, 'some-refresh-token');

    const result = await api.isAuthenticated();
    expect(result).toBeNull();
  });

  it('✅ ensureFreshAccessToken() skips refresh if token is valid', async () => {
    const longLivedToken = generateToken(600); // expires in 10 minutes
    const refreshToken = generateToken(600);

    await api.setAuthTokens(longLivedToken, refreshToken);

    Storage.getItem.mockClear();

    const result = await api.isAuthenticated();

    expect(result).not.toBeNull();
    // should not attempt to read refresh token
    expect(Storage.getItem).not.toHaveBeenCalledWith('@axios-spring-refresh-token');
  });

  it('✅ Token expiration check considers buffer time correctly', async () => {
    const expiringSoonToken = generateToken(10); // expires in 10 seconds
    const refreshToken = generateToken(600); // valid refresh token

    await api.setAuthTokens(expiringSoonToken, refreshToken);

    // Mock refresh response
    const newAccessToken = generateToken(600);
    const newRefreshToken = generateToken(1200);

    mockAxios.onPost('https://api.test.com/auth/refresh').reply(200, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });

    Storage.getItem.mockClear();

    const result = await api.isAuthenticated();

    expect(result).not.toBeNull();
    expect(result?.exp).toBeDefined();

    // Should have tried to get refresh token
    expect(Storage.getItem).toHaveBeenCalledWith('@axios-spring-refresh-token');
    expect(Storage.setItem).toHaveBeenCalledWith('@axios-spring-access-token', newAccessToken);
    expect(Storage.setItem).toHaveBeenCalledWith('@axios-spring-refresh-token', newRefreshToken);
  });
});
