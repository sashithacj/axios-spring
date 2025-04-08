import { AxiosInstance, AxiosRequestConfig } from 'axios';
import { JwtPayload } from 'jsonwebtoken';
export { AxiosRequestConfig } from 'axios';
export { JwtPayload } from 'jsonwebtoken';

export interface InitializeOptions {
  baseUrl: string;
  refreshEndpoint: string;
  tokenExpiryBufferSeconds?: number;
  reactOn401Responses?: boolean;
  storageAccessTokenKey?: string;
  storageRefreshTokenKey?: string;
  attachAccessTokenToRequest?: (
    config: AxiosRequestConfig,
    accessToken: string,
  ) => AxiosRequestConfig;
}

export interface AxiosSpringInstance extends AxiosInstance {
  setAuthTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  deleteAuthTokens: () => Promise<void>;
  isAuthenticated: () => Promise<JwtPayload | null>;
}
