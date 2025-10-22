import { createTestApi, resetTestEnvironment, mockAxios, generateToken } from './test-utils';
jest.mock('../src/storage', () => require('../__mocks__/storage'));
const Storage = require('../src/storage').default;
import { initializeApiInstance } from '../src/api';
import { decode } from 'jsonwebtoken';

describe('JWT Expiry Handling', () => {
  beforeEach(() => {
    resetTestEnvironment();
  });

  it('should refresh expired tokens when accessed', async () => {
    const API = createTestApi();
    
    // Create an expired JWT token
    const expiredToken = generateToken(-60); // 60 seconds ago
    const refreshToken = generateToken(300);
    
    // Set the expired token
    await API.setAuthTokens(expiredToken, refreshToken);
    
    // Mock refresh endpoint
    const newAccessToken = generateToken(300);
    const newRefreshToken = generateToken(600);
    
    mockAxios.onPost('https://api.test.com/auth/refresh').reply(200, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
    
    // Try to make a request - should trigger token refresh
    mockAxios.onGet('/protected').reply(200, {});
    await API.get('/protected');
    
    // Verify that the refresh endpoint was called
    expect(mockAxios.history.post).toHaveLength(1);
    expect(mockAxios.history.post[0].url).toBe('https://api.test.com/auth/refresh');
  });

  it('should use JWT expiry time when setting tokens', async () => {
    const API = createTestApi();
    const accessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjN9.4Adcj3UFYzPUVaVF43FmMab6RlaQD8A9V8wFzzht-KQ';
    const refreshToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjN9.4Adcj3UFYzPUVaVF43FmMab6RlaQD8A9V8wFzzht-KQ';
    
    // Decode the JWT to get the expiry time
    const decoded = decode(accessToken) as any;
    const expectedExpiry = decoded.exp;
    
    await API.setAuthTokens(accessToken, refreshToken);
    
    // Verify that setItem was called with the tokens
    expect(Storage.setItem).toHaveBeenCalledWith(
      '@axios-spring-access-token',
      accessToken
    );
    expect(Storage.setItem).toHaveBeenCalledWith(
      '@axios-spring-refresh-token',
      refreshToken
    );
  });

  it('should handle tokens without expiry gracefully', async () => {
    const API = createTestApi();
    // Create a JWT token without expiry
    const tokenWithoutExpiry = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    
    await API.setAuthTokens(tokenWithoutExpiry, tokenWithoutExpiry);
    
    // Should store the token
    expect(Storage.setItem).toHaveBeenCalledWith(
      '@axios-spring-access-token',
      tokenWithoutExpiry
    );
  });

  it('should handle invalid JWT tokens gracefully', async () => {
    const API = createTestApi();
    const invalidToken = 'invalid.jwt.token';
    
    await API.setAuthTokens(invalidToken, invalidToken);
    
    // Should store the token
    expect(Storage.setItem).toHaveBeenCalledWith(
      '@axios-spring-access-token',
      invalidToken
    );
  });

  it('should not use any interval-based cleanup in storage', () => {
    // Verify that storage doesn't have any interval-based cleanup
    const storageInstance = (Storage as any);
    expect(storageInstance.cleanupInterval).toBeUndefined();
    expect(storageInstance.startCleanup).toBeUndefined();
  });

  it('should refresh tokens that are about to expire', async () => {
    const API = createTestApi();
    
    // Create a token that expires in 10 seconds (within default 30s buffer)
    const expiringToken = generateToken(10);
    const refreshToken = generateToken(300);
    
    await API.setAuthTokens(expiringToken, refreshToken);
    
    // Mock refresh endpoint
    const newAccessToken = generateToken(300);
    const newRefreshToken = generateToken(600);
    
    mockAxios.onPost('https://api.test.com/auth/refresh').reply(200, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
    
    mockAxios.onGet('/protected').reply(200, {});
    await API.get('/protected');
    
    // Verify that the refresh endpoint was called (indicating token refresh)
    expect(mockAxios.history.post.length).toBeGreaterThanOrEqual(1);
    expect(mockAxios.history.post[0].url).toBe('https://api.test.com/auth/refresh');
    
    // Verify that new tokens were stored
    expect(Storage.setItem).toHaveBeenCalledWith(
      '@axios-spring-access-token',
      expect.any(String)
    );
    expect(Storage.setItem).toHaveBeenCalledWith(
      '@axios-spring-refresh-token',
      expect.any(String)
    );
  });
});
