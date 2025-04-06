import axios, { AxiosInstance } from 'axios';
import Storage from './storage';

type FailedRequest = {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
};

let failedRequestsQueue: FailedRequest[] = [];
let isRefreshing = false;

function decodeJWT(token: string): { exp: number } | null {
  try {
    const payload = token.split('.')[1];
    const decoded = atob(payload);
    return JSON.parse(decoded);
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
  const refreshToken = await Storage.getItem('refreshToken');
  if (!refreshToken) throw new Error('No refresh token available');

  const response = await axios.post(refreshEndpointUrl, { refreshToken });
  const { accessToken, refreshToken: newRefreshToken } = response.data;

  await Storage.setItem(storageAccessTokenKey, accessToken);
  await Storage.setItem(storageRefreshTokenKey, newRefreshToken);

  return { accessToken, refreshToken: newRefreshToken };
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

  API.interceptors.request.use(
    async (config) => {
      let accessToken = await Storage.getItem(storageAccessTokenKey);

      if (accessToken) {
        const decoded = decodeJWT(accessToken);
        const currentTime = Math.floor(Date.now() / 1000);

        if (decoded) {
          const timeLeft = decoded.exp - currentTime;

          if (timeLeft <= tokenExpiryBufferSeconds) {
            if (!isRefreshing) {
              isRefreshing = true;
              try {
                const { accessToken: newAccessToken } = await refreshAuthToken(
                  refreshEndpointUrl,
                  storageAccessTokenKey,
                  storageRefreshTokenKey,
                );
                accessToken = newAccessToken;
                failedRequestsQueue.forEach(({ resolve }) => resolve(newAccessToken));
                failedRequestsQueue = [];
              } catch (err) {
                failedRequestsQueue.forEach(({ reject }) => reject(err));
                failedRequestsQueue = [];
                throw err;
              } finally {
                isRefreshing = false;
              }
            } else {
              accessToken = await new Promise<string>((resolve, reject) => {
                failedRequestsQueue.push({ resolve, reject });
              });
            }
          }
        }

        config.headers['Authorization'] = `Bearer ${accessToken}`;
      }

      return config;
    },
    (error) => {
      return Promise.reject(error);
    },
  );

  if (reactOn401Responses) {
    API.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          if (isRefreshing) {
            return new Promise((resolve, reject) => {
              failedRequestsQueue.push({
                resolve: (token) => {
                  originalRequest.headers['Authorization'] = `Bearer ${token}`;
                  resolve(API(originalRequest));
                },
                reject,
              });
            });
          }

          originalRequest._retry = true;
          isRefreshing = true;

          try {
            const { accessToken: newAccessToken } = await refreshAuthToken(
              refreshEndpointUrl,
              storageAccessTokenKey,
              storageRefreshTokenKey,
            );

            originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
            failedRequestsQueue.forEach(({ resolve }) => resolve(newAccessToken));
            failedRequestsQueue = [];

            return API(originalRequest);
          } catch (err) {
            await Storage.removeItem(storageAccessTokenKey);
            await Storage.removeItem(storageRefreshTokenKey);

            failedRequestsQueue.forEach(({ reject }) => reject(err));
            failedRequestsQueue = [];

            return Promise.reject(err);
          } finally {
            isRefreshing = false;
          }
        }

        return Promise.reject(error);
      },
    );
  }

  return API;
}
