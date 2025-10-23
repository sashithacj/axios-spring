/**
 * Automatic polyfill setup for Web Crypto API and other required APIs
 * This module automatically configures polyfills for environments that don't support modern APIs
 */

/**
 * Setup TextEncoder/TextDecoder polyfill for environments that don't support it
 */
function setupTextEncodingPolyfill(): void {
  // Check if TextEncoder/TextDecoder are available
  if (typeof globalThis !== 'undefined' && (!globalThis.TextEncoder || !globalThis.TextDecoder)) {
    try {
      // Import the polyfill dynamically
      const { TextEncoder, TextDecoder } = require('fast-text-encoding');

      // Set up the polyfills
      if (!globalThis.TextEncoder) {
        globalThis.TextEncoder = TextEncoder;
      }
      if (!globalThis.TextDecoder) {
        globalThis.TextDecoder = TextDecoder;
      }

      // Also set up on global for Node.js environments
      if (typeof global !== 'undefined') {
        if (!global.TextEncoder) {
          (global as any).TextEncoder = TextEncoder;
        }
        if (!global.TextDecoder) {
          (global as any).TextDecoder = TextDecoder;
        }
      }

      // TextEncoder/TextDecoder polyfill loaded successfully
    } catch (error) {
      // Failed to load TextEncoder/TextDecoder polyfill
    }
  }
}

/**
 * Setup Buffer polyfill for environments that don't support it
 */
function setupBufferPolyfill(): void {
  // Check if Buffer is available
  if (typeof globalThis !== 'undefined' && !globalThis.Buffer) {
    try {
      // Import the polyfill dynamically
      const { Buffer } = require('buffer');

      // Set up the polyfill
      globalThis.Buffer = Buffer;

      // Also set up on global for Node.js environments
      if (typeof global !== 'undefined') {
        (global as any).Buffer = Buffer;
      }

      // Buffer polyfill loaded successfully
    } catch (error) {
      // Failed to load Buffer polyfill
    }
  }
}

/**
 * Setup Web Crypto API polyfill for environments that don't support it
 */
function setupWebCryptoPolyfill(): void {
  // Only setup polyfill if Web Crypto API is not available
  if (typeof globalThis !== 'undefined' && !globalThis.crypto) {
    try {
      // Import the polyfill dynamically to avoid issues in environments where it's not needed
      const { Crypto } = require('@peculiar/webcrypto');

      // Set up the polyfill
      globalThis.crypto = new Crypto() as any;

      // Also set up on global for Node.js environments
      if (typeof global !== 'undefined') {
        (global as any).crypto = globalThis.crypto;
      }

      // Web Crypto API polyfill loaded successfully
    } catch (error) {
      // Failed to load Web Crypto API polyfill
    }
  }
}

/**
 * Setup all required polyfills
 */
export function setupAllPolyfills(): void {
  setupTextEncodingPolyfill();
  setupBufferPolyfill();
  setupWebCryptoPolyfill();
}

// Legacy export for backward compatibility
export { setupAllPolyfills as setupWebCryptoPolyfill };

// Automatically setup all polyfills when this module is imported
setupAllPolyfills();
