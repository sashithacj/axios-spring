// Setup polyfills automatically when the package is imported
import './polyfills';

export * from './types';
export { initializeApiInstance } from './api';
export { initializeSecureStorage } from './storage';
export * from './utils';
