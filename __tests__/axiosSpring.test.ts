import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import Storage from '../__mocks__/storage';
import * as jwt from 'jsonwebtoken';
import { initializeApiInstance } from '../src/api';

jest.mock('../src/storage', () => require('../__mocks__/storage'));

const mockAxios = new MockAdapter(axios);

const generateToken = (expiresInSeconds: number) => {
  return jwt.sign({ foo: 'bar' }, 'secret', {
    expiresIn: expiresInSeconds,
  });
};

describe('AxiosSpringInstance', () => {
  const baseUrl = 'https://api.example.com';
  const refreshEndpoint = '/auth/refresh';
  const accessKey = '@axios-spring-access-token';
  const refreshKey = '@axios-spring-refresh-token';

  let API: ReturnType<typeof initializeApiInstance>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios.reset();
    API = initializeApiInstance({
      baseUrl,
      refreshEndpoint,
      tokenExpiryBufferSeconds: 30,
    });
  });

  test('skips token attachment if access token is missing', async () => {
    mockAxios.onGet(`${baseUrl}/no-token`).reply((config) => {
      expect(config.headers?.Authorization).toBeUndefined();
      return [200, {}];
    });

    const res = await API.get('/no-token');
    expect(res.status).toBe(200);
  });

  test('sets and retrieves tokens via setAuthTokens and isAuthenticated', async () => {
    const accessToken = generateToken(600); // expires in 10 min
    const refreshToken = 'refresh-token';

    await API.setAuthTokens(accessToken, refreshToken);
    const auth = await API.isAuthenticated();

    expect(auth).toBeTruthy();
    expect(Storage.setItem).toHaveBeenCalledTimes(2);
  });

  test('returns null when accessToken is expired', async () => {
    const expiredAccessToken = generateToken(-60);
    await Storage.setItem(accessKey, expiredAccessToken);
    const result = await API.isAuthenticated();
    expect(result).toBeNull();
  });

  test('refreshes token when expired', async () => {
    const expiredToken = generateToken(-10);
    await Storage.setItem(accessKey, expiredToken);
    await Storage.setItem(refreshKey, 'refresh-token');

    const newToken = generateToken(600);
    mockAxios.onPost(`${baseUrl}/auth/refresh`).reply(200, {
      accessToken: newToken,
      refreshToken: 'new-refresh-token',
    });

    const auth = await API.isAuthenticated();
    expect(auth?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  test('handles failed token refresh', async () => {
    const expiredToken = generateToken(-10);
    await Storage.setItem(accessKey, expiredToken);
    await Storage.setItem(refreshKey, 'bad-refresh-token');

    mockAxios.onPost(`${baseUrl}/auth/refresh`).reply(400, {});

    const result = await API.isAuthenticated();
    expect(result).toBeNull();
  });

  test('attaches token to request if valid', async () => {
    const validToken = generateToken(600);
    await API.setAuthTokens(validToken, 'refresh-token');

    mockAxios.onGet(`${baseUrl}/secure-endpoint`).reply((config) => {
      expect(config.headers?.Authorization).toBe(`Bearer ${validToken}`);
      return [200, {}];
    });

    const response = await API.get('/secure-endpoint');
    expect(response.status).toBe(200);
  });

  test('retries request after 401 if refresh succeeds', async () => {
    const token1 = generateToken(-10); // expired
    const token2 = generateToken(600); // new

    await Storage.setItem(accessKey, token1);
    await Storage.setItem(refreshKey, 'refresh-token');

    mockAxios
      .onGet(`${baseUrl}/retry-endpoint`)
      .replyOnce(401) // First fails
      .onPost(`${baseUrl}/auth/refresh`)
      .reply(200, {
        accessToken: token2,
        refreshToken: 'new-refresh-token',
      })
      .onGet(`${baseUrl}/retry-endpoint`)
      .reply(200, { success: true });

    const response = await API.get('/retry-endpoint');
    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
  });

  test('deletes tokens with deleteAuthTokens', async () => {
    await API.deleteAuthTokens();
    expect(Storage.removeItem).toHaveBeenCalledWith(accessKey);
    expect(Storage.removeItem).toHaveBeenCalledWith(refreshKey);
  });

  test('queues multiple requests during token refresh and resolves all', async () => {
    const expiredToken = generateToken(-10);
    const newAccessToken = generateToken(600);
    const newRefreshToken = 'new-refresh-token';

    await Storage.setItem(accessKey, expiredToken);
    await Storage.setItem(refreshKey, 'refresh-token');

    mockAxios.onPost(`${baseUrl}/auth/refresh`).replyOnce(async () => {
      await new Promise((res) => setTimeout(res, 100)); // simulate delay
      return [200, { accessToken: newAccessToken, refreshToken: newRefreshToken }];
    });

    mockAxios.onGet(`${baseUrl}/queued`).reply((config) => {
      expect(config.headers?.Authorization).toBe(`Bearer ${newAccessToken}`);
      return [200, {}];
    });

    const [res1, res2] = await Promise.all([API.get('/queued'), API.get('/queued')]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });

  test('uses custom attachAccessTokenToRequest function', async () => {
    const token = generateToken(600);
    await API.setAuthTokens(token, 'refresh-token');

    const customHeader = 'X-Custom-Auth';

    const CustomAPI = initializeApiInstance({
      baseUrl,
      refreshEndpoint,
      attachAccessTokenToRequest: (config, accessToken) => {
        config.headers = { ...config.headers, [customHeader]: `Custom ${accessToken}` };
        return config;
      },
    });

    mockAxios.onGet(`${baseUrl}/custom-header`).reply((config) => {
      expect(config.headers?.[customHeader]).toBe(`Custom ${token}`);
      return [200, {}];
    });

    const res = await CustomAPI.get('/custom-header');
    expect(res.status).toBe(200);
  });

  test('does not retry request on 401 if refresh fails', async () => {
    const expired = generateToken(-10);
    await Storage.setItem(accessKey, expired);
    await Storage.setItem(refreshKey, 'invalid-refresh');

    mockAxios
      .onGet(`${baseUrl}/fail-retry`)
      .replyOnce(401)
      .onPost(`${baseUrl}/auth/refresh`)
      .reply(400);

    await expect(API.get('/fail-retry')).rejects.toThrow();
  });

  test('refreshes token if expiring within bufferSeconds', async () => {
    const expiringSoon = generateToken(5); // Expires in 5s
    const freshToken = generateToken(600);

    await Storage.setItem(accessKey, expiringSoon);
    await Storage.setItem(refreshKey, 'refresh-token');

    mockAxios.onPost(`${baseUrl}/auth/refresh`).reply(200, {
      accessToken: freshToken,
      refreshToken: 'ref2',
    });

    const result = await API.isAuthenticated();
    expect(result?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  test('throws if refresh endpoint returns missing tokens', async () => {
    const expiredToken = generateToken(-10);
    await Storage.setItem(accessKey, expiredToken);
    await Storage.setItem(refreshKey, 'refresh-token');

    mockAxios.onPost(`${baseUrl}/auth/refresh`).reply(200, {
      notAccessToken: 'oops',
    });

    const result = await API.isAuthenticated();
    expect(result).toBeNull();
  });
});
