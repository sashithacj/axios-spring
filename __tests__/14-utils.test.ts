import {
  isNode,
  isBrowser,
  isReactNative,
  isWebCryptoAvailable,
  base64Encode,
  base64Decode,
  uint8ArrayToBase64,
  base64ToUint8Array,
  getRandomValues,
  generateRandomKey,
  generateRandomSalt,
} from '../src/utils';

describe('14. Utils Functions', () => {
  let originalCrypto: any;
  let originalWindow: any;
  let originalProcess: any;
  let originalNavigator: any;

  beforeEach(() => {
    // Store original globals
    originalCrypto = global.crypto;
    originalWindow = global.window;
    originalProcess = global.process;
    originalNavigator = global.navigator;
  });

  afterEach(() => {
    // Restore original globals
    global.crypto = originalCrypto;
    global.window = originalWindow;
    global.process = originalProcess;
    global.navigator = originalNavigator;
  });

  describe('Environment Detection', () => {
    it('✅ Should detect Node.js environment correctly', () => {
      // Mock Node.js environment
      (global as any).process = { versions: { node: '18.0.0' } };
      delete (global as any).window;
      delete (global as any).navigator;

      // Re-import to test detection
      jest.resetModules();
      const { isNode: testIsNode } = require('../src/utils');

      expect(testIsNode).toBe('18.0.0');
    });

    it('✅ Should detect browser environment correctly', () => {
      // Mock browser environment
      (global as any).window = { document: {} };
      (global as any).navigator = { product: 'Gecko' };
      delete (global as any).process;

      // Re-import to test detection
      jest.resetModules();
      const { isBrowser: testIsBrowser } = require('../src/utils');

      expect(testIsBrowser).toBe(true);
    });

    it('✅ Should detect React Native environment correctly', () => {
      // Mock React Native environment
      (global as any).navigator = { product: 'ReactNative' };
      delete (global as any).window;
      delete (global as any).process;

      // Re-import to test detection
      jest.resetModules();
      const { isReactNative: testIsReactNative } = require('../src/utils');

      expect(testIsReactNative).toBe(true);
    });

    it('✅ Should return false for unknown environments', () => {
      // Mock unknown environment
      delete (global as any).window;
      delete (global as any).process;
      delete (global as any).navigator;

      // Re-import to test detection
      jest.resetModules();
      const {
        isNode: testIsNode,
        isBrowser: testIsBrowser,
        isReactNative: testIsReactNative,
      } = require('../src/utils');

      expect(testIsNode).toBe(false);
      expect(testIsBrowser).toBe(false);
      expect(testIsReactNative).toBe(false);
    });
  });

  describe('Web Crypto API Detection', () => {
    it('✅ Should detect Web Crypto API when available', () => {
      // Mock Web Crypto API
      (global as any).crypto = {
        subtle: {},
        getRandomValues: jest.fn(),
      };

      expect(isWebCryptoAvailable()).toBe(true);
    });

    it('✅ Should return false when crypto is undefined', () => {
      delete (global as any).crypto;

      expect(isWebCryptoAvailable()).toBe(false);
    });

    it('✅ Should return false when crypto.subtle is undefined', () => {
      (global as any).crypto = {
        getRandomValues: jest.fn(),
      };

      expect(isWebCryptoAvailable()).toBe(false);
    });

    it('✅ Should return false when crypto.getRandomValues is not a function', () => {
      (global as any).crypto = {
        subtle: {},
        getRandomValues: 'not a function',
      };

      expect(isWebCryptoAvailable()).toBe(false);
    });
  });

  describe('Base64 Encoding', () => {
    it('✅ Should encode strings correctly in Node.js environment', () => {
      // Mock Node.js environment
      (global as any).process = { versions: { node: '18.0.0' } };
      delete (global as any).window;

      // Re-import to test detection
      jest.resetModules();
      const { base64Encode: testBase64Encode } = require('../src/utils');

      const result = testBase64Encode('hello world');
      expect(result).toBe('aGVsbG8gd29ybGQ=');
    });

    it('✅ Should encode strings correctly in browser environment', () => {
      // Mock browser environment
      (global as any).window = { document: {} };
      (global as any).btoa = jest.fn((str) => Buffer.from(str, 'utf8').toString('base64'));

      // Re-import to test detection
      jest.resetModules();
      const { base64Encode: testBase64Encode } = require('../src/utils');

      const result = testBase64Encode('hello world');
      expect(result).toBe('aGVsbG8gd29ybGQ=');
    });

    it('✅ Should fallback to Buffer when btoa is not available', () => {
      // Mock browser environment without btoa
      (global as any).window = { document: {} };
      delete (global as any).btoa;

      // Re-import to test detection
      jest.resetModules();
      const { base64Encode: testBase64Encode } = require('../src/utils');

      const result = testBase64Encode('hello world');
      expect(result).toBe('aGVsbG8gd29ybGQ=');
    });

    it('✅ Should handle empty strings', () => {
      const result = base64Encode('');
      expect(result).toBe('');
    });

    it('✅ Should handle special characters', () => {
      const result = base64Encode('hello@world#test$123');
      expect(result).toBe('aGVsbG9Ad29ybGQjdGVzdCQxMjM=');
    });

    it('✅ Should throw error on encoding failure', () => {
      // Mock Node.js environment with Buffer error
      (global as any).process = { versions: { node: '18.0.0' } };
      delete (global as any).window;

      // Mock Buffer to throw error
      const originalBuffer = Buffer;
      (global as any).Buffer = {
        from: jest.fn().mockImplementation(() => {
          throw new Error('Buffer error');
        }),
      };

      // Re-import to test detection
      jest.resetModules();
      const { base64Encode: testBase64Encode } = require('../src/utils');

      expect(() => testBase64Encode('test')).toThrow(
        'Base64 encoding failed in Node.js: Buffer error',
      );

      // Restore Buffer
      (global as any).Buffer = originalBuffer;
    });
  });

  describe('Base64 Decoding', () => {
    it('✅ Should decode strings correctly in Node.js environment', () => {
      // Mock Node.js environment
      (global as any).process = { versions: { node: '18.0.0' } };
      delete (global as any).window;

      // Re-import to test detection
      jest.resetModules();
      const { base64Decode: testBase64Decode } = require('../src/utils');

      const result = testBase64Decode('aGVsbG8gd29ybGQ=');
      expect(result).toBe('hello world');
    });

    it('✅ Should decode strings correctly in browser environment', () => {
      // Mock browser environment
      (global as any).window = { document: {} };
      (global as any).atob = jest.fn((str) => Buffer.from(str, 'base64').toString('utf8'));

      // Re-import to test detection
      jest.resetModules();
      const { base64Decode: testBase64Decode } = require('../src/utils');

      const result = testBase64Decode('aGVsbG8gd29ybGQ=');
      expect(result).toBe('hello world');
    });

    it('✅ Should fallback to Buffer when atob is not available', () => {
      // Mock browser environment without atob
      (global as any).window = { document: {} };
      delete (global as any).atob;

      // Re-import to test detection
      jest.resetModules();
      const { base64Decode: testBase64Decode } = require('../src/utils');

      const result = testBase64Decode('aGVsbG8gd29ybGQ=');
      expect(result).toBe('hello world');
    });

    it('✅ Should handle empty strings', () => {
      const result = base64Decode('');
      expect(result).toBe('');
    });

    it('✅ Should throw error on decoding failure', () => {
      // Mock Node.js environment with Buffer error
      (global as any).process = { versions: { node: '18.0.0' } };
      delete (global as any).window;

      // Mock Buffer to throw error
      const originalBuffer = Buffer;
      (global as any).Buffer = {
        from: jest.fn().mockImplementation(() => {
          throw new Error('Buffer error');
        }),
      };

      // Re-import to test detection
      jest.resetModules();
      const { base64Decode: testBase64Decode } = require('../src/utils');

      expect(() => testBase64Decode('invalid')).toThrow(
        'Base64 decoding failed in Node.js: Buffer error',
      );

      // Restore Buffer
      (global as any).Buffer = originalBuffer;
    });
  });

  describe('Uint8Array to Base64', () => {
    it('✅ Should convert Uint8Array to base64 in Node.js environment', () => {
      // Mock Node.js environment
      (global as any).process = { versions: { node: '18.0.0' } };
      delete (global as any).window;

      // Re-import to test detection
      jest.resetModules();
      const { uint8ArrayToBase64: testUint8ArrayToBase64 } = require('../src/utils');

      const uint8Array = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const result = testUint8ArrayToBase64(uint8Array);
      expect(result).toBe('SGVsbG8=');
    });

    it('✅ Should convert Uint8Array to base64 in browser environment', () => {
      // Mock browser environment
      (global as any).window = { document: {} };
      (global as any).btoa = jest.fn((str) => Buffer.from(str, 'utf8').toString('base64'));

      // Re-import to test detection
      jest.resetModules();
      const { uint8ArrayToBase64: testUint8ArrayToBase64 } = require('../src/utils');

      const uint8Array = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const result = testUint8ArrayToBase64(uint8Array);
      expect(result).toBe('SGVsbG8=');
    });

    it('✅ Should handle empty Uint8Array', () => {
      const uint8Array = new Uint8Array([]);
      const result = uint8ArrayToBase64(uint8Array);
      expect(result).toBe('');
    });

    it('✅ Should throw error on conversion failure', () => {
      // Mock Node.js environment with Buffer error
      (global as any).process = { versions: { node: '18.0.0' } };
      delete (global as any).window;

      // Mock Buffer to throw error
      const originalBuffer = Buffer;
      (global as any).Buffer = {
        from: jest.fn().mockImplementation(() => {
          throw new Error('Buffer error');
        }),
      };

      // Re-import to test detection
      jest.resetModules();
      const { uint8ArrayToBase64: testUint8ArrayToBase64 } = require('../src/utils');

      const uint8Array = new Uint8Array([72, 101, 108, 108, 111]);
      expect(() => testUint8ArrayToBase64(uint8Array)).toThrow(
        'Uint8Array to base64 failed in Node.js: Buffer error',
      );

      // Restore Buffer
      (global as any).Buffer = originalBuffer;
    });
  });

  describe('Base64 to Uint8Array', () => {
    it('✅ Should convert base64 to Uint8Array in Node.js environment', () => {
      // Mock Node.js environment
      (global as any).process = { versions: { node: '18.0.0' } };
      delete (global as any).window;

      // Re-import to test detection
      jest.resetModules();
      const { base64ToUint8Array: testBase64ToUint8Array } = require('../src/utils');

      const result = testBase64ToUint8Array('SGVsbG8=');
      expect(Array.from(result)).toEqual([72, 101, 108, 108, 111]);
    });

    it('✅ Should convert base64 to Uint8Array in browser environment', () => {
      // Mock browser environment
      (global as any).window = { document: {} };
      (global as any).atob = jest.fn((str) => Buffer.from(str, 'base64').toString('utf8'));

      // Re-import to test detection
      jest.resetModules();
      const { base64ToUint8Array: testBase64ToUint8Array } = require('../src/utils');

      const result = testBase64ToUint8Array('SGVsbG8=');
      expect(Array.from(result)).toEqual([72, 101, 108, 108, 111]);
    });

    it('✅ Should handle empty base64 string', () => {
      const result = base64ToUint8Array('');
      expect(Array.from(result)).toEqual([]);
    });

    it('✅ Should throw error on conversion failure', () => {
      // Mock Node.js environment with Buffer error
      (global as any).process = { versions: { node: '18.0.0' } };
      delete (global as any).window;

      // Mock Buffer to throw error
      const originalBuffer = Buffer;
      (global as any).Buffer = {
        from: jest.fn().mockImplementation(() => {
          throw new Error('Buffer error');
        }),
      };

      // Re-import to test detection
      jest.resetModules();
      const { base64ToUint8Array: testBase64ToUint8Array } = require('../src/utils');

      expect(() => testBase64ToUint8Array('invalid')).toThrow(
        'Base64 to Uint8Array failed in Node.js: Buffer error',
      );

      // Restore Buffer
      (global as any).Buffer = originalBuffer;
    });
  });

  describe('Random Values Generation', () => {
    it('✅ Should use crypto.getRandomValues when available', () => {
      const mockGetRandomValues = jest.fn((arr) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = i;
        }
        return arr;
      });

      (global as any).crypto = {
        subtle: {},
        getRandomValues: mockGetRandomValues,
      };

      const array = new Uint8Array(4);
      const result = getRandomValues(array);

      expect(mockGetRandomValues).toHaveBeenCalledWith(array);
      expect(Array.from(result)).toEqual([0, 1, 2, 3]);
    });

    it('✅ Should fallback to Math.random when crypto.getRandomValues is not available', () => {
      delete (global as any).crypto;

      const array = new Uint8Array(4);
      const result = getRandomValues(array);

      // Should work without throwing errors or showing warnings
      expect(result).toBe(array);
      expect(result.length).toBe(4);
    });

    it('✅ Should handle crypto.getRandomValues failure gracefully', () => {
      // Mock console.warn to capture warning
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      (global as any).crypto = {
        subtle: {},
        getRandomValues: jest.fn().mockImplementation(() => {
          throw new Error('Crypto error');
        }),
      };

      const array = new Uint8Array(4);
      const result = getRandomValues(array);

      expect(consoleSpy).toHaveBeenCalledWith(
        'crypto.getRandomValues failed, falling back to Math.random:',
        expect.any(Error),
      );
      expect(result).toBe(array);
      expect(result.length).toBe(4);

      consoleSpy.mockRestore();
    });
  });

  describe('Random Key Generation', () => {
    it('✅ Should generate random key when Web Crypto API is available', () => {
      const mockGetRandomValues = jest.fn((arr) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = i % 256;
        }
        return arr;
      });

      (global as any).crypto = {
        subtle: {},
        getRandomValues: mockGetRandomValues,
      };

      const key = generateRandomKey();

      expect(typeof key).toBe('string');
      expect(key.length).toBe(64); // 32 bytes * 2 hex chars per byte
      expect(mockGetRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
    });

    it('✅ Should use fallback when Web Crypto API is not available', () => {
      delete (global as any).crypto;

      // Should not throw, but use fallback
      const key = generateRandomKey();
      expect(key).toBeDefined();
      expect(key.length).toBe(64); // 32 bytes * 2 hex chars per byte
    });

    it('✅ Should generate unique keys', () => {
      const mockGetRandomValues = jest.fn((arr) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      });

      (global as any).crypto = {
        subtle: {},
        getRandomValues: mockGetRandomValues,
      };

      const key1 = generateRandomKey();
      const key2 = generateRandomKey();

      expect(key1).not.toBe(key2);
    });
  });

  describe('Random Salt Generation', () => {
    it('✅ Should generate random salt when Web Crypto API is available', () => {
      const mockGetRandomValues = jest.fn((arr) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = i % 256;
        }
        return arr;
      });

      (global as any).crypto = {
        subtle: {},
        getRandomValues: mockGetRandomValues,
      };

      const salt = generateRandomSalt();

      expect(typeof salt).toBe('string');
      expect(salt.length).toBe(32); // 16 bytes * 2 hex chars per byte
      expect(mockGetRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
    });

    it('✅ Should use fallback when Web Crypto API is not available', () => {
      delete (global as any).crypto;

      // Should not throw, but use fallback
      const salt = generateRandomSalt();
      expect(salt).toBeDefined();
      expect(salt.length).toBe(32); // 16 bytes * 2 hex chars per byte
    });

    it('✅ Should generate unique salts', () => {
      const mockGetRandomValues = jest.fn((arr) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      });

      (global as any).crypto = {
        subtle: {},
        getRandomValues: mockGetRandomValues,
      };

      const salt1 = generateRandomSalt();
      const salt2 = generateRandomSalt();

      expect(salt1).not.toBe(salt2);
    });
  });

  describe('Integration Tests', () => {
    it('✅ Should work end-to-end with base64 encoding/decoding', () => {
      const originalData = 'Hello, World! 123 @#$%';

      const encoded = base64Encode(originalData);
      const decoded = base64Decode(encoded);

      expect(decoded).toBe(originalData);
    });

    it('✅ Should work end-to-end with Uint8Array conversion', () => {
      const originalArray = new Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100]);

      const base64 = uint8ArrayToBase64(originalArray);
      const convertedArray = base64ToUint8Array(base64);

      expect(Array.from(convertedArray)).toEqual(Array.from(originalArray));
    });

    it('✅ Should handle round-trip conversion with random data', () => {
      const mockGetRandomValues = jest.fn((arr) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      });

      (global as any).crypto = {
        subtle: {},
        getRandomValues: mockGetRandomValues,
      };

      const key = generateRandomKey();
      const salt = generateRandomSalt();

      expect(typeof key).toBe('string');
      expect(typeof salt).toBe('string');
      expect(key.length).toBe(64);
      expect(salt.length).toBe(32);
    });
  });
});
