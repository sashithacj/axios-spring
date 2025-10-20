/**
 * Tests for automatic polyfill setup
 */

import { setupWebCryptoPolyfill } from '../src/polyfills';

describe('16. Polyfill Setup', () => {
  beforeEach(() => {
    // Clear any existing crypto setup
    delete (globalThis as any).crypto;
    delete (global as any).crypto;
  });

  afterEach(() => {
    // Restore original crypto if it existed
    jest.restoreAllMocks();
  });

  describe('Web Crypto API Polyfill', () => {
    it('✅ Should setup polyfill when Web Crypto API is not available', () => {
      // Ensure crypto is not available
      expect(globalThis.crypto).toBeUndefined();

      // Setup polyfill
      setupWebCryptoPolyfill();

      // Should have crypto available now
      expect(globalThis.crypto).toBeDefined();
      expect(typeof globalThis.crypto.getRandomValues).toBe('function');
    });

    it('✅ Should not override existing Web Crypto API', () => {
      // Mock existing crypto
      const mockCrypto = {
        getRandomValues: jest.fn(),
        subtle: {},
      };
      (globalThis as any).crypto = mockCrypto;

      // Setup polyfill
      setupWebCryptoPolyfill();

      // Should still be the original crypto
      expect(globalThis.crypto).toBe(mockCrypto);
    });

    it('✅ Should handle polyfill loading errors gracefully', () => {
      // Mock require to throw an error
      const originalRequire = require;
      (global as any).require = jest.fn(() => {
        throw new Error('Module not found');
      });

      // Should not throw
      expect(() => setupWebCryptoPolyfill()).not.toThrow();

      // Restore original require
      (global as any).require = originalRequire;
    });

    it('✅ Should work in Node.js environment', () => {
      // Mock Node.js environment
      const originalGlobal = global;
      (global as any).global = globalThis;

      setupWebCryptoPolyfill();

      expect(globalThis.crypto).toBeDefined();
      expect((global as any).crypto).toBeDefined();

      // Restore
      (global as any).global = originalGlobal;
    });
  });
});
