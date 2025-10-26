import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import * as jwt from 'jsonwebtoken';
import { initializeApiInstance } from '../src/api';

jest.mock('../src/storage', () => require('../__mocks__/storage'));
const Storage = require('../src/storage').default;

export const mockAxios = new MockAdapter(axios);

export const generateToken = (expiresInSeconds: number, additionalPayload: any = {}): string => {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    iat: Math.floor(Date.now() / 1000),
    sub: 'test-user',
    email: 'test@example.com',
    role: 'user',
    ...additionalPayload,
  };
  return jwt.sign(payload, 'secret');
};

export const createTestApi = (options: any = {}) => {
  return initializeApiInstance({
    baseUrl: 'https://api.test.com',
    refreshEndpoint: '/auth/refresh',
    ...options,
  });
};

export const resetTestEnvironment = () => {
  mockAxios.resetHandlers();
  Storage.__reset();
};
