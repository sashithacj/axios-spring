import { AxiosInstance } from 'axios';

export interface InitializeOptions {
  baseUrl: string;
  refreshEndpoint: string;
  tokenExpiryBufferSeconds?: number;
  reactOn401Responses?: boolean;
}

export function initializeApiInstance(options: InitializeOptions): AxiosInstance;
