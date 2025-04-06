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
): Promise<{ accessToken: string; refreshToken: string }> {
  const refreshToken = await Storage.getItem('refreshToken');
  if (!refreshToken) throw new Error('No refresh token available');

  const response = await axios.post(refreshEndpointUrl, { refreshToken });
  const { accessToken, refreshToken: newRefreshToken } = response.data;

  await Storage.setItem('accessToken', accessToken);
  await Storage.setItem('refreshToken', newRefreshToken);

  return { accessToken, refreshToken: newRefreshToken };
}

interface InitializeOptions {
  baseUrl: string;
  refreshEndpoint: string;
  tokenExpiryBufferSeconds?: number;
  reactOn401Responses?: boolean;
}

export function initializeApiInstance({
  baseUrl,
  refreshEndpoint,
  tokenExpiryBufferSeconds = 30,
  reactOn401Responses = true,
}: InitializeOptions): AxiosInstance {
  const API = axios.create({ baseURL: baseUrl });
  const refreshEndpointUrl = joinUrl(baseUrl, refreshEndpoint);

  API.interceptors.request.use(
    async (config) => {
      let accessToken = await Storage.getItem('accessToken');

      if (accessToken) {
        const decoded = decodeJWT(accessToken);
        const currentTime = Math.floor(Date.now() / 1000);

        if (decoded) {
          const timeLeft = decoded.exp - currentTime;

          if (timeLeft <= tokenExpiryBufferSeconds) {
            if (!isRefreshing) {
              isRefreshing = true;
              try {
                const { accessToken: newAccessToken } = await refreshAuthToken(refreshEndpointUrl);
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
            const { accessToken: newAccessToken } = await refreshAuthToken(refreshEndpointUrl);

            await Storage.setItem('accessToken', newAccessToken);
            originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;

            failedRequestsQueue.forEach(({ resolve }) => resolve(newAccessToken));
            failedRequestsQueue = [];

            return API(originalRequest);
          } catch (err) {
            await Storage.removeItem('accessToken');
            await Storage.removeItem('refreshToken');

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
