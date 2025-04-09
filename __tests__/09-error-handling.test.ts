import { AxiosRequestConfig } from 'axios';
import { createTestApi, generateToken, mockAxios, resetTestEnvironment } from './test-utils';

jest.mock('../src/storage', () => require('../__mocks__/storage'));
const Storage = require('../src/storage').default;

describe('9. Error Handling (Silent fallback)', () => {
  let api: ReturnType<typeof createTestApi>;

  beforeEach(() => {
    resetTestEnvironment();
    api = createTestApi();
  });

  it('✅ If refresh token is unavailable, request continues without expired token', async () => {
    const expiredToken = generateToken(-60);
    await api.setAuthTokens(expiredToken, '');

    mockAxios.onGet('https://api.test.com/protected-endpoint').reply((config) => {
      expect(config.headers?.Authorization).toBeUndefined();
      return [200];
    });

    await expect(api.get('https://api.test.com/protected-endpoint')).resolves.toBeDefined();
  });

  it('✅ If refresh response is invalid, request continues without expired token', async () => {
    const expiredToken = generateToken(-60);
    const refreshToken = generateToken(600);
    await api.setAuthTokens(expiredToken, refreshToken);

    mockAxios.onPost('https://api.test.com/auth/refresh').reply(200, { invalid: true });

    mockAxios.onGet('https://api.test.com/protected-endpoint').reply((config) => {
      expect(config.headers?.Authorization).toBeUndefined();
      return [200];
    });

    await expect(api.get('https://api.test.com/protected-endpoint')).resolves.toBeDefined();
  });

  it('✅ If refresh fails (500), request still goes through without expired token', async () => {
    const expiredToken = generateToken(-60);
    const refreshToken = generateToken(600);
    await api.setAuthTokens(expiredToken, refreshToken);

    mockAxios.onPost('https://api.test.com/auth/refresh').reply(500);

    mockAxios.onGet('https://api.test.com/protected-endpoint').reply((config) => {
      expect(config.headers?.Authorization).toBeUndefined();
      return [200];
    });

    await expect(api.get('https://api.test.com/protected-endpoint')).resolves.toBeDefined();
  });

  it('✅ Multiple parallel requests continue silently if refresh fails', async () => {
    const expiredToken = generateToken(-60);
    const refreshToken = generateToken(600);
    await api.setAuthTokens(expiredToken, refreshToken);

    mockAxios.onPost('https://api.test.com/auth/refresh').reply(400); // Simulate failed refresh

    mockAxios.onGet('https://api.test.com/protected-endpoint').reply((config) => {
      expect(config.headers?.Authorization).toBeUndefined();
      return [200];
    });

    const req1 = api.get('https://api.test.com/protected-endpoint');
    const req2 = api.get('https://api.test.com/protected-endpoint');

    await expect(req1).resolves.toBeDefined();
    await expect(req2).resolves.toBeDefined();
  });
});
