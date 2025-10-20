/**
 * Tests for automatic polyfill setup
 */

import { setupAllPolyfills, setupWebCryptoPolyfill } from '../src/polyfills';

describe('16. Polyfill Setup', () => {
  beforeEach(() => {
    // Don't clear polyfills - they should be loaded automatically
    // The tests should work with the existing state
  });

  afterEach(() => {
    // Restore original polyfills if they existed
    jest.restoreAllMocks();
  });

  describe('setupAllPolyfills', () => {
    it('✅ Should have all polyfills available', () => {
      // Setup all polyfills
      setupAllPolyfills();

      // Should have all polyfills available now
      expect(globalThis.crypto).toBeDefined();
      expect(globalThis.TextEncoder).toBeDefined();
      expect(globalThis.TextDecoder).toBeDefined();
      expect(globalThis.Buffer).toBeDefined();
    });

    it('✅ Should not override existing polyfills', () => {
      // Mock existing polyfills
      const mockCrypto = { getRandomValues: jest.fn(), subtle: {} };
      const mockTextEncoder = jest.fn();
      const mockTextDecoder = jest.fn();
      const mockBuffer = jest.fn();

      (globalThis as any).crypto = mockCrypto;
      (globalThis as any).TextEncoder = mockTextEncoder;
      (globalThis as any).TextDecoder = mockTextDecoder;
      (globalThis as any).Buffer = mockBuffer;

      // Setup all polyfills
      setupAllPolyfills();

      // Should still be the original polyfills
      expect(globalThis.crypto).toBe(mockCrypto);
      expect(globalThis.TextEncoder).toBe(mockTextEncoder);
      expect(globalThis.TextDecoder).toBe(mockTextDecoder);
      expect(globalThis.Buffer).toBe(mockBuffer);
    });
  });

  describe('TextEncoder/TextDecoder Polyfill', () => {
    it('✅ Should have TextEncoder/TextDecoder available', () => {
      // Should have TextEncoder/TextDecoder available (loaded automatically)
      expect(globalThis.TextEncoder).toBeDefined();
      expect(globalThis.TextDecoder).toBeDefined();
      expect(typeof globalThis.TextEncoder).toBe('function');
      expect(typeof globalThis.TextDecoder).toBe('function');
    });

    it('✅ Should not override existing TextEncoder/TextDecoder', () => {
      // Store original values
      const originalTextEncoder = globalThis.TextEncoder;
      const originalTextDecoder = globalThis.TextDecoder;

      // Mock existing TextEncoder/TextDecoder
      const mockTextEncoder = jest.fn();
      const mockTextDecoder = jest.fn();
      (globalThis as any).TextEncoder = mockTextEncoder;
      (globalThis as any).TextDecoder = mockTextDecoder;

      // Setup polyfill
      setupAllPolyfills();

      // Should still be the original TextEncoder/TextDecoder
      expect(globalThis.TextEncoder).toBe(mockTextEncoder);
      expect(globalThis.TextDecoder).toBe(mockTextDecoder);

      // Restore original values
      (globalThis as any).TextEncoder = originalTextEncoder;
      (globalThis as any).TextDecoder = originalTextDecoder;
    });

    it('✅ Should work in Node.js environment', () => {
      // Mock Node.js environment
      const originalGlobal = global;
      (global as any).global = globalThis;

      setupAllPolyfills();

      expect(globalThis.TextEncoder).toBeDefined();
      expect(globalThis.TextDecoder).toBeDefined();
      expect((global as any).TextEncoder).toBeDefined();
      expect((global as any).TextDecoder).toBeDefined();

      // Restore
      (global as any).global = originalGlobal;
    });

    it('✅ Should have TextEncoder/TextDecoder with proper methods', () => {
      // Test that TextEncoder/TextDecoder have the expected methods
      expect(globalThis.TextEncoder).toBeDefined();
      expect(globalThis.TextDecoder).toBeDefined();
      expect(typeof globalThis.TextEncoder).toBe('function');
      expect(typeof globalThis.TextDecoder).toBe('function');

      // Test that they can be instantiated
      const encoder = new globalThis.TextEncoder();
      const decoder = new globalThis.TextDecoder();

      expect(encoder).toBeDefined();
      expect(decoder).toBeDefined();
      expect(typeof encoder).toBe('object');
      expect(typeof decoder).toBe('object');
    });
  });

  describe('Buffer Polyfill', () => {
    it('✅ Should have Buffer available', () => {
      // Setup polyfill
      setupAllPolyfills();

      // Should have Buffer available now
      expect(globalThis.Buffer).toBeDefined();
      expect(typeof globalThis.Buffer).toBe('function');
    });

    it('✅ Should not override existing Buffer', () => {
      // Mock existing Buffer
      const mockBuffer = jest.fn();
      (globalThis as any).Buffer = mockBuffer;

      // Setup polyfill
      setupAllPolyfills();

      // Should still be the original Buffer
      expect(globalThis.Buffer).toBe(mockBuffer);
    });

    it('✅ Should work in Node.js environment', () => {
      // Mock Node.js environment
      const originalGlobal = global;
      (global as any).global = globalThis;

      setupAllPolyfills();

      expect(globalThis.Buffer).toBeDefined();
      expect((global as any).Buffer).toBeDefined();

      // Restore
      (global as any).global = originalGlobal;
    });
  });

  describe('Web Crypto API Polyfill', () => {
    it('✅ Should have Web Crypto API available', () => {
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

  describe('Error Handling', () => {
    it('✅ Should handle polyfill loading errors gracefully for all polyfills', () => {
      // Mock require to throw an error for all polyfills
      const originalRequire = require;
      (global as any).require = jest.fn(() => {
        throw new Error('Module not found');
      });

      // Should not throw for any polyfill
      expect(() => setupAllPolyfills()).not.toThrow();
      expect(() => setupWebCryptoPolyfill()).not.toThrow();

      // Restore original require
      (global as any).require = originalRequire;
    });
  });
});
