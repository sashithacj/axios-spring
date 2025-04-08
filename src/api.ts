import axios from 'axios';
import Storage from './storage';
import { decode, JwtPayload } from 'jsonwebtoken';
import { AxiosSpringInstance, InitializeOptions } from './types';

type FailedRequest = {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
};

const ACCESS_KEY = Symbol('accessTokenKey');
const REFRESH_KEY = Symbol('refreshTokenKey');

const refreshingStateMap = new WeakMap<
  AxiosSpringInstance,
  {
    isRefreshing: boolean;
    failedRequestsQueue: FailedRequest[];
  }
>();

function decodeJWT(token: string): { exp: number } | null {
  try {
    const decoded = decode(token) as JwtPayload | null;
    if (decoded && typeof decoded.exp === 'number') {
      return { exp: decoded.exp };
    }
    return null;
  } catch {
    return null;
  }
}

function joinUrl(baseUrl: string, path: string): string {
  if (!baseUrl.endsWith('/')) baseUrl += '/';
  if (path.startsWith('/')) path = path.slice(1);
  return baseUrl + path;
}

async function refreshAuthToken(
  refreshEndpointUrl: string,
  storageAccessTokenKey: string,
  storageRefreshTokenKey: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const refreshToken = await Storage.getItem(storageRefreshTokenKey);
  if (!refreshToken) throw new Error('No refresh token available');

  const response = await axios.post(refreshEndpointUrl, { refreshToken });
  const { accessToken, refreshToken: newRefreshToken } = response.data;

  await Storage.setItem(storageAccessTokenKey, accessToken);
  await Storage.setItem(storageRefreshTokenKey, newRefreshToken);

  return { accessToken, refreshToken: newRefreshToken };
}

async function ensureFreshAccessToken(
  API: AxiosSpringInstance,
  accessKey: string,
  refreshKey: string,
  refreshEndpointUrl: string,
  bufferSeconds: number = 30,
): Promise<string | null> {
  let accessToken = await Storage.getItem(accessKey);
  if (!accessToken) return null;

  const decoded = decodeJWT(accessToken);
  const currentTime = Math.floor(Date.now() / 1000);

  if (!decoded) return null;

  const timeLeft = decoded.exp - currentTime;
  const state = refreshingStateMap.get(API)!;

  if (timeLeft > bufferSeconds) return accessToken;

  if (!state.isRefreshing) {
    state.isRefreshing = true;
    try {
      const { accessToken: newAccessToken } = await refreshAuthToken(
        refreshEndpointUrl,
        accessKey,
        refreshKey,
      );
      accessToken = newAccessToken;
      state.failedRequestsQueue.forEach(({ resolve }) => resolve(newAccessToken));
      state.failedRequestsQueue = [];
      return newAccessToken;
    } catch (err) {
      state.failedRequestsQueue.forEach(({ reject }) => reject(err));
      state.failedRequestsQueue = [];
      return null;
    } finally {
      state.isRefreshing = false;
    }
  } else {
    try {
      accessToken = await new Promise<string>((resolve, reject) => {
        state.failedRequestsQueue.push({ resolve, reject });
      });
      return accessToken;
    } catch {
      return null;
    }
  }
}

/**
 * Initializes a customized Axios instance with token management (including refresh),
 * automatic authorization handling, and response handling for 401 errors.
 *
 * @param {InitializeOptions} options - Configuration options for the API setup.
 * @param {string} options.baseUrl - The base URL of the API that the Axios instance will communicate with.
 * @param {string} options.refreshEndpoint - The endpoint URL used to refresh the access token.
 * @param {number} [options.tokenExpiryBufferSeconds=30] - A buffer period in seconds before the access token expires to trigger automatic refresh. Defaults to 30 seconds.
 * @param {boolean} [options.reactOn401Responses=true] - Whether to automatically react to HTTP 401 responses by attempting to refresh the token and retrying the request. Defaults to true.
 * @param {string} [options.storageAccessTokenKey='@axios-spring-access-token'] - The storage key to store the access token (defaults to '@axios-spring-access-token').
 * @param {string} [options.storageRefreshTokenKey='@axios-spring-refresh-token'] - The storage key to store the refresh token (defaults to '@axios-spring-refresh-token').
 *
 * @returns {AxiosSpringInstance} - A customized Axios instance that supports token management and automatic 401 error handling. This instance has additional methods:
 *   - `setAuthTokens`: Set access and refresh tokens.
 *   - `deleteAuthTokens`: Remove access and refresh tokens.
 *   - `isAuthenticated`: Check if the user is authenticated by verifying the access token.
 */
export function initializeApiInstance({
  baseUrl,
  refreshEndpoint,
  tokenExpiryBufferSeconds = 30,
  reactOn401Responses = true,
  storageAccessTokenKey = '@axios-spring-access-token',
  storageRefreshTokenKey = '@axios-spring-refresh-token',
}: InitializeOptions): AxiosSpringInstance {
  const API = axios.create({ baseURL: baseUrl }) as AxiosSpringInstance;
  const refreshEndpointUrl = joinUrl(baseUrl, refreshEndpoint);

  refreshingStateMap.set(API, {
    isRefreshing: false,
    failedRequestsQueue: [],
  });

  (API as any)[ACCESS_KEY] = storageAccessTokenKey;
  (API as any)[REFRESH_KEY] = storageRefreshTokenKey;

  API.setAuthTokens = async (accessToken: string, refreshToken: string) => {
    const accessKey = (API as any)[ACCESS_KEY];
    const refreshKey = (API as any)[REFRESH_KEY];
    await Storage.setItem(accessKey, accessToken);
    await Storage.setItem(refreshKey, refreshToken);
  };

  API.deleteAuthTokens = async () => {
    const accessKey = (API as any)[ACCESS_KEY];
    const refreshKey = (API as any)[REFRESH_KEY];
    await Storage.removeItem(accessKey);
    await Storage.removeItem(refreshKey);
  };

  API.isAuthenticated = async () => {
    const accessKey = (API as any)[ACCESS_KEY];
    const refreshKey = (API as any)[REFRESH_KEY];
    const accessToken = await ensureFreshAccessToken(
      API,
      accessKey,
      refreshKey,
      refreshEndpointUrl,
      tokenExpiryBufferSeconds,
    );
    if (!accessToken) return null;
    const decoded = decodeJWT(accessToken);
    return decoded ?? null;
  };

  API.interceptors.request.use(
    async (config) => {
      const accessToken = await ensureFreshAccessToken(
        API,
        storageAccessTokenKey,
        storageRefreshTokenKey,
        refreshEndpointUrl,
        tokenExpiryBufferSeconds,
      );
      if (accessToken) {
        config.headers['Authorization'] = `Bearer ${accessToken}`;
      }
      return config;
    },
    (error) => Promise.reject(error),
  );

  if (reactOn401Responses) {
    API.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          const token = await ensureFreshAccessToken(
            API,
            storageAccessTokenKey,
            storageRefreshTokenKey,
            refreshEndpointUrl,
            0,
          );

          if (token) {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return API(originalRequest);
          }

          return Promise.reject(error);
        }

        return Promise.reject(error);
      },
    );
  }

  return API;
}
