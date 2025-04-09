import { AxiosRequestConfig } from 'axios';
import { initializeApiInstance } from '../src/api';
import { createTestApi, generateToken, mockAxios, resetTestEnvironment } from './test-utils';

jest.mock('../src/storage', () => require('../__mocks__/storage'));
const Storage = require('../src/storage').default;

describe('5. Interceptor: Request Handling', () => {
  let api: ReturnType<typeof createTestApi>;

  beforeEach(() => {
    resetTestEnvironment();
    api = createTestApi();
  });

  it('✅ Access token is attached to request headers if available', async () => {
    const token = generateToken(600); // valid token
    const refreshToken = generateToken(600);

    await api.setAuthTokens(token, refreshToken);

    // Intercept the request
    mockAxios.onGet('https://api.test.com/protected-endpoint').reply(200);

    await api.get('https://api.test.com/protected-endpoint');

    // Check if the authorization header has the access token
    const request = mockAxios.history.get[mockAxios.history.get.length - 1];
    expect(request.headers?.['Authorization']).toBe(`Bearer ${token}`);
  });

  it('✅ Custom access token attach function modifies request correctly', async () => {
    const customToken = generateToken(600);
    const refreshToken = generateToken(600);

    // Define a custom token attach function
    const customAttachToken = (config: AxiosRequestConfig) => {
      if (!config.headers) config.headers = {};
      config.headers['Authorization'] = `Token ${customToken}`;
      return config;
    };

    const api = initializeApiInstance({
      baseUrl: 'https://api.test.com',
      refreshEndpoint: '/auth/refresh',
      attachAccessTokenToRequest: customAttachToken,
    });

    await api.setAuthTokens(customToken, refreshToken);

    mockAxios.onGet('https://api.test.com/protected-endpoint').reply(200);

    await api.get('https://api.test.com/protected-endpoint');

    const request = mockAxios.history.get[mockAxios.history.get.length - 1];
    expect(request.headers?.['Authorization']).toBe(`Token ${customToken}`);
  });

  it('✅ If token is expired, it is refreshed before request', async () => {
    const expiringToken = generateToken(1); // expires soon
    const refreshToken = generateToken(600);
    const newAccessToken = generateToken(600);
    const newRefreshToken = generateToken(1200);

    await api.setAuthTokens(expiringToken, refreshToken);

    // Mock the refresh request
    mockAxios.onPost('https://api.test.com/auth/refresh').reply(200, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });

    mockAxios.onGet('https://api.test.com/protected-endpoint').reply(200);

    await api.get('https://api.test.com/protected-endpoint');

    // Check that refresh was triggered
    const refreshCall = mockAxios.history.post.find(
      (req) => req.url === 'https://api.test.com/auth/refresh',
    );
    expect(refreshCall).toBeTruthy();

    // Check that the new token is used in the request
    const request = mockAxios.history.get[mockAxios.history.get.length - 1];
    expect(request.headers?.['Authorization']).toBe(`Bearer ${newAccessToken}`);
  });

  it('✅ If no token, request proceeds without Authorization header', async () => {
    const api = initializeApiInstance({
      baseUrl: 'https://api.test.com',
      refreshEndpoint: '/auth/refresh',
    });

    mockAxios.onGet('https://api.test.com/protected-endpoint').reply(200);

    await api.get('https://api.test.com/protected-endpoint');

    const request = mockAxios.history.get[mockAxios.history.get.length - 1];
    expect(request.headers?.['Authorization']).toBeUndefined(); // No authorization header
  });

  it('✅ Refresh is triggered on-demand from request interceptor', async () => {
    const expiringToken = generateToken(1);
    const refreshToken = generateToken(600);
    const newAccessToken = generateToken(600);
    const newRefreshToken = generateToken(1200);

    await api.setAuthTokens(expiringToken, refreshToken);

    // Mock the refresh request
    mockAxios.onPost('https://api.test.com/auth/refresh').reply(200, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });

    const beforeRefreshCalls = mockAxios.history.post.filter(
      (req) => req.url === 'https://api.test.com/auth/refresh',
    );

    mockAxios.onGet('https://api.test.com/protected-endpoint').reply(200);

    await api.get('https://api.test.com/protected-endpoint');

    // Ensure refresh was triggered
    const afterRefreshCalls = mockAxios.history.post.filter(
      (req) => req.url === 'https://api.test.com/auth/refresh',
    );
    expect(afterRefreshCalls.length - beforeRefreshCalls.length).toBe(1);
  });
});
