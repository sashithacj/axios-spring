import { AxiosRequestConfig } from 'axios';
import { initializeApiInstance } from '../src/api';
import { createTestApi, generateToken, mockAxios, resetTestEnvironment } from './test-utils';

jest.mock('../src/storage', () => require('../__mocks__/storage'));
const Storage = require('../src/storage').default;

describe('6. Interceptor: 401 Response Handling', () => {
  let api: ReturnType<typeof createTestApi>;

  beforeEach(() => {
    resetTestEnvironment();
    api = createTestApi();
  });

  it('✅ 401 triggers token refresh only once per failure', async () => {
    const shortLivedToken = generateToken(1);
    const refreshToken = generateToken(600);
    const newAccessToken = generateToken(600);
    const newRefreshToken = generateToken(1200);

    await api.setAuthTokens(shortLivedToken, refreshToken);

    mockAxios
      .onPost('https://api.test.com/auth/refresh')
      .replyOnce(200, { accessToken: newAccessToken, refreshToken: newRefreshToken });

    mockAxios.onGet('/protected').replyOnce(401).onGet('/protected').reply(200, { data: 'ok' });

    const responses = await Promise.all([api.get('/protected'), api.get('/protected')]);

    expect(responses[0].data.data).toBe('ok');
    expect(responses[1].data.data).toBe('ok');
    expect(Storage.setItem).toHaveBeenCalledWith('@axios-spring-access-token', newAccessToken);
    expect(mockAxios.history.post.filter((r) => r.url?.includes('/auth/refresh'))).toHaveLength(1);
  });

  it('✅ _retry flag prevents infinite retry loops', async () => {
    const accessToken = generateToken(10);
    const refreshToken = generateToken(600);

    await api.setAuthTokens(accessToken, refreshToken);

    mockAxios.onPost('https://api.test.com/auth/refresh').replyOnce(500); // fails to refresh

    mockAxios.onGet('/protected').reply(401);

    await expect(api.get('/protected')).rejects.toThrow();
  });

  it('✅ Token is refreshed on 401 and original request is retried', async () => {
    const oldToken = generateToken(10);
    const refreshToken = generateToken(600);
    const newAccessToken = generateToken(600);
    const newRefreshToken = generateToken(1200);

    await api.setAuthTokens(oldToken, refreshToken);

    mockAxios.onPost('https://api.test.com/auth/refresh').reply(200, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });

    mockAxios
      .onGet('/protected')
      .replyOnce(401)
      .onGet('/protected')
      .reply(200, { data: 'after-refresh' });

    const response = await api.get('/protected');
    expect(response.data.data).toBe('after-refresh');
  });

  it('✅ If refresh fails, error is passed to caller', async () => {
    const oldToken = generateToken(10);
    const refreshToken = generateToken(600);

    await api.setAuthTokens(oldToken, refreshToken);

    mockAxios.onPost('https://api.test.com/auth/refresh').reply(400); // Refresh fails

    mockAxios.onGet('/protected').reply(401);

    await expect(api.get('/protected')).rejects.toThrow();
  });

  it('✅ Response interceptor does not modify successful responses', async () => {
    const token = generateToken(600);
    const refreshToken = generateToken(600);
    await api.setAuthTokens(token, refreshToken);

    mockAxios.onGet('/open-endpoint').reply(200, { public: 'yes' });

    const res = await api.get('/open-endpoint');
    expect(res.data.public).toBe('yes');
  });

  it('✅ 401 response is retried with updated Authorization header', async () => {
    const accessToken = generateToken(10);
    const refreshToken = generateToken(600);
    const newAccessToken = generateToken(600);
    const newRefreshToken = generateToken(1200);

    await api.setAuthTokens(accessToken, refreshToken);

    mockAxios.onPost('https://api.test.com/auth/refresh').reply(200, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });

    mockAxios
      .onGet('/protected')
      .replyOnce(401)
      .onGet('/protected')
      .reply((config) => {
        expect(config.headers?.Authorization).toBe(`Bearer ${newAccessToken}`);
        return [200, { secure: 'data' }];
      });

    const response = await api.get('/protected');
    expect(response.data.secure).toBe('data');
  });

  it('✅ Response interceptor does not retry if reactOn401Responses is false', async () => {
    api = initializeApiInstance({
      baseUrl: 'https://api.test.com',
      refreshEndpoint: '/auth/refresh',
      reactOn401Responses: false,
    });

    const token = generateToken(10);
    const refreshToken = generateToken(600);
    await api.setAuthTokens(token, refreshToken);

    mockAxios.onGet('/no-retry').reply(401);

    await expect(api.get('/no-retry')).rejects.toThrow();
  });
});
