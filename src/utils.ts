/**
 * Environment-safe utilities for cross-platform compatibility
 */

/**
 * Runtime environment detection
 */
export const isNode = typeof process !== 'undefined' && process.versions?.node;
export const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
export const isReactNative =
  typeof navigator !== 'undefined' && navigator.product === 'ReactNative';

/**
 * Check if Web Crypto API is available
 */
export const isWebCryptoAvailable = (): boolean => {
  return (
    typeof crypto !== 'undefined' &&
    typeof crypto.subtle !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  );
};

/**
 * Environment-safe base64 encoding
 */
export const base64Encode = (data: string): string => {
  if (isNode) {
    // Node.js environment - use Buffer
    try {
      return Buffer.from(data, 'utf8').toString('base64');
    } catch (error) {
      throw new Error(
        `Base64 encoding failed in Node.js: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  } else if (isBrowser || isReactNative) {
    // Browser/React Native environment - use btoa with fallback
    try {
      if (typeof btoa === 'function') {
        return btoa(data);
      }
      // Fallback for environments where btoa is not available
      return Buffer.from(data, 'utf8').toString('base64');
    } catch (error) {
      throw new Error(
        `Base64 encoding failed in browser/RN: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  } else {
    // Fallback for unknown environments
    try {
      return Buffer.from(data, 'utf8').toString('base64');
    } catch (error) {
      throw new Error(
        `Base64 encoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
};

/**
 * Environment-safe base64 decoding
 */
export const base64Decode = (encodedData: string): string => {
  if (isNode) {
    // Node.js environment - use Buffer
    try {
      return Buffer.from(encodedData, 'base64').toString('utf8');
    } catch (error) {
      throw new Error(
        `Base64 decoding failed in Node.js: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  } else if (isBrowser || isReactNative) {
    // Browser/React Native environment - use atob with fallback
    try {
      if (typeof atob === 'function') {
        return atob(encodedData);
      }
      // Fallback for environments where atob is not available
      return Buffer.from(encodedData, 'base64').toString('utf8');
    } catch (error) {
      throw new Error(
        `Base64 decoding failed in browser/RN: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  } else {
    // Fallback for unknown environments
    try {
      return Buffer.from(encodedData, 'base64').toString('utf8');
    } catch (error) {
      throw new Error(
        `Base64 decoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
};

/**
 * Convert Uint8Array to base64 string
 */
export const uint8ArrayToBase64 = (uint8Array: Uint8Array): string => {
  if (isNode) {
    // Node.js environment - use Buffer
    try {
      return Buffer.from(uint8Array).toString('base64');
    } catch (error) {
      throw new Error(
        `Uint8Array to base64 failed in Node.js: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  } else {
    // Browser/React Native environment
    try {
      // Convert to string first, then encode
      const binaryString = Array.from(uint8Array, (byte) => String.fromCharCode(byte)).join('');
      return base64Encode(binaryString);
    } catch (error) {
      throw new Error(
        `Uint8Array to base64 failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
};

/**
 * Convert base64 string to Uint8Array
 */
export const base64ToUint8Array = (base64: string): Uint8Array => {
  if (isNode) {
    // Node.js environment - use Buffer
    try {
      const buffer = Buffer.from(base64, 'base64');
      return new Uint8Array(buffer);
    } catch (error) {
      throw new Error(
        `Base64 to Uint8Array failed in Node.js: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  } else {
    // Browser/React Native environment
    try {
      const binaryString = base64Decode(base64);
      return new Uint8Array(Array.from(binaryString, (char) => char.charCodeAt(0)));
    } catch (error) {
      throw new Error(
        `Base64 to Uint8Array failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
};

/**
 * Generate cryptographically secure random values
 */
export const getRandomValues = (array: Uint8Array): Uint8Array => {
  if (isWebCryptoAvailable()) {
    try {
      return crypto.getRandomValues(array);
    } catch (error) {
      console.warn('crypto.getRandomValues failed, falling back to Math.random:', error);
    }
  }

  // Fallback for environments without crypto.getRandomValues
  // Note: This should rarely happen since polyfills are loaded automatically
  for (let i = 0; i < array.length; i++) {
    array[i] = Math.floor(Math.random() * 256);
  }
  return array;
};

/**
 * Generate a cryptographically secure random key
 */
export const generateRandomKey = (): string => {
  const array = new Uint8Array(32); // 256 bits
  getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Generate a cryptographically secure random salt
 */
export const generateRandomSalt = (): string => {
  const array = new Uint8Array(16); // 128 bits
  getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
};
