/**
 * Automatic polyfill setup for Web Crypto API
 * This module automatically configures polyfills for environments that don't support Web Crypto API
 */

/**
 * Setup Web Crypto API polyfill for environments that don't support it
 * This function is automatically called when the module is imported
 */
export function setupWebCryptoPolyfill(): void {
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

      console.log('🔐 axios-spring: Web Crypto API polyfill loaded successfully');
    } catch (error) {
      console.warn(
        '⚠️ axios-spring: Failed to load Web Crypto API polyfill. ' +
          'Some features may not work in this environment. ' +
          'Error:',
        error,
      );
    }
  }
}

// Automatically setup polyfill when this module is imported
setupWebCryptoPolyfill();
