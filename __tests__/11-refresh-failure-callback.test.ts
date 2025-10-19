import { createTestApi, generateToken, mockAxios, resetTestEnvironment } from './test-utils';

jest.mock('../src/storage', () => require('../__mocks__/storage'));
const Storage = require('../src/storage').default;

describe('11. Refresh Failure Callback', () => {
  let api: ReturnType<typeof createTestApi>;
  let onRefreshFailureMock: jest.Mock;

  beforeEach(() => {
    resetTestEnvironment();
    onRefreshFailureMock = jest.fn();
    api = createTestApi({
      onRefreshFailure: onRefreshFailureMock,
    });
  });

  it('✅ onRefreshFailure callback is called when refresh token request fails', async () => {
    const accessToken = generateToken(10); // will trigger refresh
    const refreshToken = generateToken(600);

    await api.setAuthTokens(accessToken, refreshToken);

    // Mock refresh endpoint to return 500 error
    mockAxios.onPost('https://api.test.com/auth/refresh').reply(500, {
      error: 'Internal Server Error',
    });

    const result = await api.isAuthenticated();

    expect(result).toBeNull();
    expect(onRefreshFailureMock).toHaveBeenCalledTimes(1);
    expect(onRefreshFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        response: expect.objectContaining({
          status: 500,
        }),
      }),
    );
  });

  it('✅ onRefreshFailure callback is called when refresh token is missing', async () => {
    const accessToken = generateToken(10); // will trigger refresh

    await Storage.setItem('@axios-spring-access-token', accessToken);
    // Don't set refresh token

    const result = await api.isAuthenticated();

    expect(result).toBeNull();
    expect(onRefreshFailureMock).toHaveBeenCalledTimes(1);
    expect(onRefreshFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'No refresh token available',
      }),
    );
  });

  it('✅ onRefreshFailure callback is called when refresh response is malformed', async () => {
    const accessToken = generateToken(10); // will trigger refresh
    const refreshToken = generateToken(600);

    await api.setAuthTokens(accessToken, refreshToken);

    // Mock refresh endpoint to return malformed response
    mockAxios.onPost('https://api.test.com/auth/refresh').reply(200, {
      invalid: 'structure',
    });

    const result = await api.isAuthenticated();

    expect(result).toBeNull();
    expect(onRefreshFailureMock).toHaveBeenCalledTimes(1);
    expect(onRefreshFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Invalid refreshEndpoint response',
      }),
    );
  });

  it('✅ onRefreshFailure callback is called for queued requests when refresh fails', async () => {
    const expiringToken = generateToken(1);
    const refreshToken = generateToken(600);

    await api.setAuthTokens(expiringToken, refreshToken);

    // Mock refresh endpoint to fail
    mockAxios.onPost('https://api.test.com/auth/refresh').reply(500);

    // Make multiple concurrent requests that will be queued
    const promises = [api.isAuthenticated(), api.isAuthenticated(), api.isAuthenticated()];

    const results = await Promise.all(promises);

    // All requests should return null
    expect(results.every((r) => r === null)).toBe(true);

    // Callback should be called only once (not for each queued request)
    expect(onRefreshFailureMock).toHaveBeenCalledTimes(1);
  });

  it('✅ onRefreshFailure callback is not called when refresh succeeds', async () => {
    const accessToken = generateToken(10); // will trigger refresh
    const refreshToken = generateToken(600);
    const newAccessToken = generateToken(600);
    const newRefreshToken = generateToken(1200);

    await api.setAuthTokens(accessToken, refreshToken);

    // Mock refresh endpoint to succeed
    mockAxios.onPost('https://api.test.com/auth/refresh').reply(200, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });

    const result = await api.isAuthenticated();

    expect(result).not.toBeNull();
    expect(onRefreshFailureMock).not.toHaveBeenCalled();
  });

  it('✅ onRefreshFailure callback is not called when token is still valid', async () => {
    const accessToken = generateToken(600); // valid token
    const refreshToken = generateToken(1200);

    await api.setAuthTokens(accessToken, refreshToken);

    const result = await api.isAuthenticated();

    expect(result).not.toBeNull();
    expect(onRefreshFailureMock).not.toHaveBeenCalled();
  });

  it('✅ onRefreshFailure callback works with custom error handling', async () => {
    const accessToken = generateToken(10);
    const refreshToken = generateToken(600);

    await api.setAuthTokens(accessToken, refreshToken);

    // Mock refresh endpoint to return 401 (unauthorized)
    mockAxios.onPost('https://api.test.com/auth/refresh').reply(401, {
      error: 'Refresh token expired',
    });

    const result = await api.isAuthenticated();

    expect(result).toBeNull();
    expect(onRefreshFailureMock).toHaveBeenCalledTimes(1);
    expect(onRefreshFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        response: expect.objectContaining({
          status: 401,
          data: expect.objectContaining({
            error: 'Refresh token expired',
          }),
        }),
      }),
    );
  });
});
