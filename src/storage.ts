import {
  isWebCryptoAvailable,
  base64Encode,
  base64Decode,
  uint8ArrayToBase64,
  base64ToUint8Array,
  getRandomValues,
  generateRandomKey,
  generateRandomSalt,
  isReactNative,
} from './utils';

type StorageInterface = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  clear: () => Promise<void>;
};

type SecureStorageConfig = {
  encryptionKey?: string;
  keyDerivationSalt?: string;
};

class SecureMemoryStorage {
  private store: Map<string, string> = new Map();

  constructor(private config: any = {}) {}

  async getItem(key: string): Promise<string | null> {
    const value = this.store.get(key);
    return value ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  destroy() {
    this.store.clear();
  }
}

class SecureEncryption {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12;
  private static readonly HMAC_ALGORITHM = 'HMAC';
  private static readonly HMAC_HASH = 'SHA-256';

  static async generateKey(): Promise<CryptoKey> {
    if (!isWebCryptoAvailable()) {
      throw new Error(
        'Web Crypto API is not available. Please ensure your environment supports Web Crypto API or provide polyfills.',
      );
    }

    return crypto.subtle.generateKey(
      {
        name: this.ALGORITHM,
        length: this.KEY_LENGTH,
      },
      true,
      ['encrypt', 'decrypt'],
    );
  }

  static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    if (!isWebCryptoAvailable()) {
      throw new Error(
        'Web Crypto API is not available. Please ensure your environment supports Web Crypto API or provide polyfills.',
      );
    }

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey'],
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt.buffer as ArrayBuffer,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt'],
    );
  }

  static async encrypt(plaintext: string, key: CryptoKey): Promise<string> {
    if (!isWebCryptoAvailable()) {
      throw new Error(
        'Web Crypto API is not available. Please ensure your environment supports Web Crypto API or provide polyfills.',
      );
    }

    const iv = new Uint8Array(this.IV_LENGTH);
    getRandomValues(iv);
    const encodedText = new TextEncoder().encode(plaintext);

    const encrypted = await crypto.subtle.encrypt(
      {
        name: this.ALGORITHM,
        iv: iv,
      },
      key,
      encodedText,
    );

    // Create HMAC for integrity verification
    const hmacKey = await crypto.subtle.importKey(
      'raw',
      await crypto.subtle.exportKey('raw', key),
      { name: this.HMAC_ALGORITHM, hash: this.HMAC_HASH },
      false,
      ['sign'],
    );

    const dataToSign = new Uint8Array(iv.length + encrypted.byteLength);
    dataToSign.set(iv);
    dataToSign.set(new Uint8Array(encrypted), iv.length);

    const signature = await crypto.subtle.sign(this.HMAC_ALGORITHM, hmacKey, dataToSign);

    // Combine IV, encrypted data, and HMAC signature
    const combined = new Uint8Array(iv.length + encrypted.byteLength + signature.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    combined.set(new Uint8Array(signature), iv.length + encrypted.byteLength);

    return uint8ArrayToBase64(combined);
  }

  static async decrypt(encryptedData: string, key: CryptoKey): Promise<string> {
    if (!isWebCryptoAvailable()) {
      throw new Error(
        'Web Crypto API is not available. Please ensure your environment supports Web Crypto API or provide polyfills.',
      );
    }

    const combined = base64ToUint8Array(encryptedData);

    // Extract components
    const iv = combined.slice(0, this.IV_LENGTH);
    const encrypted = combined.slice(this.IV_LENGTH, combined.length - 32); // 32 bytes for HMAC-SHA256
    const signature = combined.slice(combined.length - 32);

    // Verify HMAC signature for integrity
    const hmacKey = await crypto.subtle.importKey(
      'raw',
      await crypto.subtle.exportKey('raw', key),
      { name: this.HMAC_ALGORITHM, hash: this.HMAC_HASH },
      false,
      ['verify'],
    );

    const dataToVerify = new Uint8Array(iv.length + encrypted.length);
    dataToVerify.set(iv);
    dataToVerify.set(encrypted, iv.length);

    const isValid = await crypto.subtle.verify(
      this.HMAC_ALGORITHM,
      hmacKey,
      signature,
      dataToVerify,
    );

    if (!isValid) {
      throw new Error('Data integrity check failed - possible tampering detected');
    }

    const decrypted = await crypto.subtle.decrypt(
      {
        name: this.ALGORITHM,
        iv: iv,
      },
      key,
      encrypted,
    );

    return new TextDecoder().decode(decrypted);
  }
}

// Secure storage implementation
class SecureStorage implements StorageInterface {
  private memoryStorage: SecureMemoryStorage;
  private encryptionKey: CryptoKey | null = null;
  private isEncryptionAvailable: boolean = false;

  constructor(private config: any = {}) {
    this.memoryStorage = new SecureMemoryStorage(config);
    this.initializeEncryption();
  }

  private async initializeEncryption() {
    // Check if Web Crypto API is available
    if (isWebCryptoAvailable()) {
      this.isEncryptionAvailable = true;

      if (this.config.encryptionKey) {
        // Use provided key with PBKDF2 derivation
        const salt = this.config.keyDerivationSalt
          ? new TextEncoder().encode(this.config.keyDerivationSalt)
          : new Uint8Array(16); // Default salt
        this.encryptionKey = await SecureEncryption.deriveKey(this.config.encryptionKey, salt);
      } else {
        // Generate a new key (stored in memory only)
        this.encryptionKey = await SecureEncryption.generateKey();
      }
    } else {
      console.warn(
        'Web Crypto API is not available. Encryption will be disabled. Please ensure your environment supports Web Crypto API or provide polyfills.',
      );
    }
  }

  private async encryptValue(value: string): Promise<string> {
    if (!this.isEncryptionAvailable || !this.encryptionKey) {
      throw new Error(
        'Encryption is required but not available. Please ensure Web Crypto API is supported.',
      );
    }

    try {
      return await SecureEncryption.encrypt(value, this.encryptionKey);
    } catch (error) {
      throw new Error(
        `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private async decryptValue(encryptedValue: string): Promise<string> {
    if (!this.isEncryptionAvailable || !this.encryptionKey) {
      throw new Error(
        'Decryption is required but not available. Please ensure Web Crypto API is supported.',
      );
    }

    try {
      return await SecureEncryption.decrypt(encryptedValue, this.encryptionKey);
    } catch (error) {
      throw new Error(
        `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getItem(key: string): Promise<string | null> {
    const encryptedValue = await this.memoryStorage.getItem(key);
    if (!encryptedValue) return null;

    return this.decryptValue(encryptedValue);
  }

  async setItem(key: string, value: string): Promise<void> {
    const encryptedValue = await this.encryptValue(value);
    return this.memoryStorage.setItem(key, encryptedValue);
  }

  async removeItem(key: string): Promise<void> {
    return this.memoryStorage.removeItem(key);
  }

  async clear(): Promise<void> {
    return this.memoryStorage.clear();
  }

  destroy() {
    this.memoryStorage.destroy();
  }
}

// Platform-specific secure storage implementations
class BrowserSecureStorage implements StorageInterface {
  private encryptionKey: CryptoKey | null = null;
  private isEncryptionAvailable: boolean = false;

  constructor(private config: any = {}) {
    this.initializeEncryption();
  }

  private async initializeEncryption() {
    if (isWebCryptoAvailable()) {
      this.isEncryptionAvailable = true;

      if (this.config.encryptionKey) {
        const salt = this.config.keyDerivationSalt
          ? new TextEncoder().encode(this.config.keyDerivationSalt)
          : new Uint8Array(16);
        this.encryptionKey = await SecureEncryption.deriveKey(this.config.encryptionKey, salt);
      } else {
        this.encryptionKey = await SecureEncryption.generateKey();
      }
    } else {
      console.warn(
        'Web Crypto API is not available. Encryption will be disabled. Please ensure your environment supports Web Crypto API or provide polyfills.',
      );
    }
  }

  private async encryptValue(value: string): Promise<string> {
    if (
      !this.isEncryptionAvailable ||
      !this.encryptionKey ||
      this.config.enableEncryption === false
    ) {
      return value;
    }

    try {
      return await SecureEncryption.encrypt(value, this.encryptionKey);
    } catch (error) {
      console.warn('Encryption failed, storing as plain text:', error);
      return value;
    }
  }

  private async decryptValue(encryptedValue: string): Promise<string> {
    if (!this.isEncryptionAvailable || !this.encryptionKey) {
      return encryptedValue;
    }

    try {
      return await SecureEncryption.decrypt(encryptedValue, this.encryptionKey);
    } catch (error) {
      console.warn('Decryption failed, returning as plain text:', error);
      return encryptedValue;
    }
  }

  async getItem(key: string): Promise<string | null> {
    const localValue = localStorage.getItem(key);
    if (localValue) {
      return this.decryptValue(localValue);
    }
    return null;
  }

  async setItem(key: string, value: string): Promise<void> {
    const encryptedValue = await this.encryptValue(value);
    localStorage.setItem(key, encryptedValue);
  }

  async removeItem(key: string): Promise<void> {
    localStorage.removeItem(key);
  }

  async clear(): Promise<void> {
    localStorage.clear();
  }

  destroy() {}
}

class ReactNativeSecureStorage implements StorageInterface {
  private encryptionKey: CryptoKey | null = null;
  private isEncryptionAvailable: boolean = false;
  private AsyncStorage: any;

  constructor(private config: any = {}) {
    this.AsyncStorage = require('@react-native-async-storage/async-storage');
    this.initializeEncryption();
  }

  private async initializeEncryption() {
    if (isWebCryptoAvailable()) {
      this.isEncryptionAvailable = true;

      if (this.config.encryptionKey) {
        const salt = this.config.keyDerivationSalt
          ? new TextEncoder().encode(this.config.keyDerivationSalt)
          : new Uint8Array(16);
        this.encryptionKey = await SecureEncryption.deriveKey(this.config.encryptionKey, salt);
      } else {
        this.encryptionKey = await SecureEncryption.generateKey();
      }
    } else {
      console.warn(
        'Web Crypto API is not available. Encryption will be disabled. Please ensure your environment supports Web Crypto API or provide polyfills.',
      );
    }
  }

  private async encryptValue(value: string): Promise<string> {
    if (
      !this.isEncryptionAvailable ||
      !this.encryptionKey ||
      this.config.enableEncryption === false
    ) {
      return value;
    }

    try {
      return await SecureEncryption.encrypt(value, this.encryptionKey);
    } catch (error) {
      console.warn('Encryption failed, storing as plain text:', error);
      return value;
    }
  }

  private async decryptValue(encryptedValue: string): Promise<string> {
    if (!this.isEncryptionAvailable || !this.encryptionKey) {
      return encryptedValue;
    }

    try {
      return await SecureEncryption.decrypt(encryptedValue, this.encryptionKey);
    } catch (error) {
      console.warn('Decryption failed, returning as plain text:', error);
      return encryptedValue;
    }
  }

  async getItem(key: string): Promise<string | null> {
    const asyncValue = await this.AsyncStorage.getItem(key);
    if (asyncValue) {
      return this.decryptValue(asyncValue);
    }
    return null;
  }

  async setItem(key: string, value: string): Promise<void> {
    const encryptedValue = await this.encryptValue(value);
    await this.AsyncStorage.setItem(key, encryptedValue);
  }

  async removeItem(key: string): Promise<void> {
    await this.AsyncStorage.removeItem(key);
  }

  async clear(): Promise<void> {
    await this.AsyncStorage.clear();
  }

  destroy() {}
}

let Storage: StorageInterface;
let currentStorageConfig: any = {};

// Function to initialize storage with custom configuration
export function initializeSecureStorage(config: SecureStorageConfig = {}) {
  currentStorageConfig = {
    ...config,
  } as any;

  // Check for browser environment (React/Next.js)
  if (typeof window !== 'undefined' && window.localStorage) {
    Storage = new BrowserSecureStorage(currentStorageConfig);
    return Storage;
  }

  // Check for React Native environment
  if (isReactNative) {
    try {
      require('@react-native-async-storage/async-storage');
      Storage = new ReactNativeSecureStorage(currentStorageConfig);
      return Storage;
    } catch {
      // AsyncStorage not available, fallback to secure memory storage
    }
  }

  // Fallback to secure memory storage (for testing or unsupported environments)
  Storage = new SecureStorage(currentStorageConfig);
  return Storage;
}

// Default initialization with secure defaults
(function initializeStorage() {
  Storage = initializeSecureStorage();
})();

export default Storage;
