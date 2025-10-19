import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import Storage from './storage';
import { decode, JwtPayload } from 'jsonwebtoken';
import { AxiosSpringInstance, InitializeOptions } from './types';

type FailedRequest = {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
};

type RefreshConfig = {
  accessKey: string;
  refreshKey: string;
  refreshEndpointUrl: string;
  tokenExpiryBufferSeconds: number;
  onRefreshFailure?: (error: unknown) => void;
  attachRefreshTokenToRequest: (
    config: AxiosRequestConfig,
    refreshToken: string,
  ) => AxiosRequestConfig;
  extractTokensFromResponse: (response: AxiosResponse) => {
    accessToken: string;
    refreshToken: string;
  };
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
  refreshAuthTokenConfig: RefreshConfig,
): Promise<{ accessToken: string; refreshToken: string }> {
  const {
    accessKey,
    refreshKey,
    refreshEndpointUrl,
    attachRefreshTokenToRequest,
    extractTokensFromResponse,
  } = refreshAuthTokenConfig;
  const refreshToken = await Storage.getItem(refreshKey);
  if (!refreshToken) throw new Error('No refresh token available');

  const config = attachRefreshTokenToRequest(
    {
      method: 'post',
      url: refreshEndpointUrl,
    },
    refreshToken,
  );

  const response = await axios.request(config);
  const { accessToken, refreshToken: newRefreshToken } = extractTokensFromResponse(response);

  if (!accessToken || !newRefreshToken) {
    throw new Error('Invalid refreshEndpoint response');
  }

  await Storage.setItem(accessKey, accessToken);
  await Storage.setItem(refreshKey, newRefreshToken);

  return { accessToken, refreshToken: newRefreshToken };
}

async function ensureFreshAccessToken(
  API: AxiosSpringInstance,
  refreshAuthTokenConfig: RefreshConfig,
): Promise<string | null> {
  const { accessKey, tokenExpiryBufferSeconds, onRefreshFailure } = refreshAuthTokenConfig;
  let accessToken = await Storage.getItem(accessKey);
  if (!accessToken) return null;

  const decoded = decodeJWT(accessToken);
  const currentTime = Math.floor(Date.now() / 1000);

  if (!decoded) return null;

  const timeLeft = decoded.exp - currentTime;
  const state = refreshingStateMap.get(API)!;

  if (timeLeft > tokenExpiryBufferSeconds) return accessToken;

  if (!state.isRefreshing) {
    state.isRefreshing = true;
    try {
      const { accessToken: newAccessToken } = await refreshAuthToken(refreshAuthTokenConfig);
      accessToken = newAccessToken;
      state.failedRequestsQueue.forEach(({ resolve }) => resolve(newAccessToken));
      state.failedRequestsQueue = [];
      return newAccessToken;
    } catch (err) {
      state.failedRequestsQueue.forEach(({ reject }) => reject(err));
      state.failedRequestsQueue = [];
      if (onRefreshFailure) {
        onRefreshFailure(err);
      }
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

export function initializeApiInstance({
  baseUrl,
  refreshEndpoint,
  tokenExpiryBufferSeconds = 30,
  reactOn401Responses = true,
  storageAccessTokenKey = '@axios-spring-access-token',
  storageRefreshTokenKey = '@axios-spring-refresh-token',
  onRefreshFailure,
  attachAccessTokenToRequest: customAccessTokenAttachFn,
  attachRefreshTokenToRequest: customRefreshTokenAttachFn,
  extractTokensFromResponse: customTokensExtractFn,
  ...axiosConfigOptions
}: InitializeOptions): AxiosSpringInstance {
  const API = axios.create({ ...axiosConfigOptions, baseURL: baseUrl }) as AxiosSpringInstance;
  const refreshEndpointUrl = joinUrl(baseUrl, refreshEndpoint);

  const attachAccessTokenToRequest =
    customAccessTokenAttachFn ??
    ((config, accessToken) => {
      if (!config.headers) config.headers = {};
      config.headers['Authorization'] = `Bearer ${accessToken}`;
      return config;
    });

  const attachRefreshTokenToRequest =
    customRefreshTokenAttachFn ??
    ((config, refreshToken) => {
      config.data = { refreshToken };
      return config;
    });

  const extractTokensFromResponse =
    customTokensExtractFn ??
    ((response) => {
      return {
        accessToken: response?.data?.accessToken,
        refreshToken: response?.data?.refreshToken,
      };
    });

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
    const accessToken = await ensureFreshAccessToken(API, {
      accessKey,
      refreshKey,
      refreshEndpointUrl,
      tokenExpiryBufferSeconds,
      onRefreshFailure,
      attachRefreshTokenToRequest,
      extractTokensFromResponse,
    });
    if (!accessToken) return null;
    const decoded = decodeJWT(accessToken);
    return decoded ?? null;
  };

  API.interceptors.request.use(
    async (config) => {
      const accessToken = await ensureFreshAccessToken(API, {
        accessKey: storageAccessTokenKey,
        refreshKey: storageRefreshTokenKey,
        refreshEndpointUrl,
        tokenExpiryBufferSeconds,
        onRefreshFailure,
        attachRefreshTokenToRequest,
        extractTokensFromResponse,
      });
      if (accessToken) {
        attachAccessTokenToRequest(config, accessToken);
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

          const token = await ensureFreshAccessToken(API, {
            accessKey: storageAccessTokenKey,
            refreshKey: storageRefreshTokenKey,
            refreshEndpointUrl,
            tokenExpiryBufferSeconds: 0,
            onRefreshFailure,
            attachRefreshTokenToRequest,
            extractTokensFromResponse,
          });

          if (token) {
            originalRequest.headers = attachAccessTokenToRequest(originalRequest, token).headers;
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
