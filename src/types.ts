import { AxiosInstance, AxiosRequestConfig, AxiosResponse, CreateAxiosDefaults } from 'axios';
import { JwtPayload } from 'jsonwebtoken';
export { AxiosRequestConfig, AxiosResponse } from 'axios';
export { JwtPayload } from 'jsonwebtoken';

export interface SecureStorageConfig {
  encryptionKey?: string;
  keyDerivationSalt?: string;
  maxAge?: number; // in milliseconds
  autoCleanup?: boolean;
}

export interface InitializeOptions extends Omit<CreateAxiosDefaults, 'baseURL'> {
  baseUrl: string;
  refreshEndpoint: string;
  tokenExpiryBufferSeconds?: number;
  reactOn401Responses?: boolean;
  storageAccessTokenKey?: string;
  storageRefreshTokenKey?: string;
  secureStorage?: SecureStorageConfig;
  onRefreshFailure?: (error: unknown) => void;
  attachAccessTokenToRequest?: (
    config: AxiosRequestConfig,
    accessToken: string,
  ) => AxiosRequestConfig;
  attachRefreshTokenToRequest?: (
    config: AxiosRequestConfig,
    refreshToken: string,
  ) => AxiosRequestConfig;
  extractTokensFromResponse?: (response: AxiosResponse) => {
    accessToken: string;
    refreshToken: string;
  };
}

export interface AxiosSpringInstance extends AxiosInstance {
  setAuthTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  deleteAuthTokens: () => Promise<void>;
  isAuthenticated: () => Promise<JwtPayload | null>;
}
