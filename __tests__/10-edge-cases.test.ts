import { createTestApi, generateToken, mockAxios, resetTestEnvironment } from './test-utils';
import { initializeApiInstance } from '../src/api';

jest.mock('../src/storage', () => require('../__mocks__/storage'));
const Storage = require('../src/storage').default;

describe('10. Edge Case Handling', () => {
  let api: ReturnType<typeof createTestApi>;

  beforeEach(() => {
    resetTestEnvironment();
    api = createTestApi();
  });

  it('✅ API instance handles multiple simultaneous requests with expired tokens', async () => {
    const expiredToken = generateToken(-60);
    const refreshToken = generateToken(600);
    const newAccessToken = generateToken(300);
    const newRefreshToken = generateToken(600);

    await api.setAuthTokens(expiredToken, refreshToken);

    mockAxios.onPost('https://api.test.com/auth/refresh').replyOnce(200, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });

    mockAxios.onGet('https://api.test.com/data').reply((config) => {
      expect(config.headers?.Authorization).toBe(`Bearer ${newAccessToken}`);
      return [200];
    });

    await Promise.all([
      api.get('https://api.test.com/data'),
      api.get('https://api.test.com/data'),
      api.get('https://api.test.com/data'),
    ]);
  });

  it('✅ Works if storage keys are accidentally cleared mid-session', async () => {
    const expiredToken = generateToken(-60);
    const refreshToken = generateToken(600);
    await api.setAuthTokens(expiredToken, refreshToken);

    Storage.removeItem('accessToken');
    Storage.removeItem('refreshToken');

    mockAxios.onPost('https://api.test.com/auth/refresh').reply(500); // won't hit
    mockAxios.onGet('https://api.test.com/data').reply(200); // still goes through

    await expect(api.get('https://api.test.com/data')).resolves.toBeDefined();
  });

  it('✅ Custom extractor returns partial tokens (access only), consider it as an endpoint failure', async () => {
    const expiredToken = generateToken(-60);
    const newAccessToken = generateToken(300);

    const partialApi = initializeApiInstance({
      baseUrl: 'https://api.test.com',
      refreshEndpoint: '/auth/refresh',
      extractTokensFromResponse: (response) => ({
        accessToken: response.data.accessToken,
        refreshToken: '',
      }),
    });

    await partialApi.setAuthTokens(expiredToken, 'dummy-refresh');

    mockAxios.onPost('https://api.test.com/auth/refresh').reply(200, {
      accessToken: newAccessToken,
    });

    mockAxios.onGet('https://api.test.com/data').reply((config) => {
      expect(config.headers?.Authorization).toBeUndefined();
      return [200];
    });

    await partialApi.get('https://api.test.com/data');
  });

  it('✅ Works if header is already set before interceptor', async () => {
    const expiredToken = generateToken(-60);
    const refreshToken = generateToken(600);
    const newAccessToken = generateToken(300);
    const newRefreshToken = generateToken(600);

    await api.setAuthTokens(expiredToken, refreshToken);

    mockAxios.onPost('https://api.test.com/auth/refresh').reply(200, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });

    mockAxios.onGet('https://api.test.com/data').reply((config) => {
      expect(config.headers?.Authorization).toBe(`Bearer ${newAccessToken}`);
      return [200];
    });

    await api.get('https://api.test.com/data', {
      headers: {
        Authorization: 'Bearer something-old', // should be replaced
      },
    });
  });
});
