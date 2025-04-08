import axios, { AxiosInstance } from 'axios';
import Storage from './storage';
import { decode, JwtPayload } from 'jsonwebtoken';

type FailedRequest = {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
};

let failedRequestsQueue: FailedRequest[] = [];
let isRefreshing = false;

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

  if (timeLeft > bufferSeconds) return accessToken;

  if (!isRefreshing) {
    isRefreshing = true;
    try {
      const { accessToken: newAccessToken } = await refreshAuthToken(
        refreshEndpointUrl,
        accessKey,
        refreshKey,
      );
      accessToken = newAccessToken;
      failedRequestsQueue.forEach(({ resolve }) => resolve(newAccessToken));
      failedRequestsQueue = [];
      return newAccessToken;
    } catch (err) {
      failedRequestsQueue.forEach(({ reject }) => reject(err));
      failedRequestsQueue = [];
      return null;
    } finally {
      isRefreshing = false;
    }
  } else {
    try {
      accessToken = await new Promise<string>((resolve, reject) => {
        failedRequestsQueue.push({ resolve, reject });
      });
      return accessToken;
    } catch {
      return null;
    }
  }
}

interface InitializeOptions {
  baseUrl: string;
  refreshEndpoint: string;
  tokenExpiryBufferSeconds?: number;
  reactOn401Responses?: boolean;
  storageAccessTokenKey?: string;
  storageRefreshTokenKey?: string;
}

const ACCESS_KEY = Symbol('accessTokenKey');
const REFRESH_KEY = Symbol('refreshTokenKey');

interface AxiosSpringInstance extends AxiosInstance {
  setAuthTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  deleteAuthTokens: () => Promise<void>;
  isAuthenticated: () => Promise<JwtPayload | null>;
}

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
