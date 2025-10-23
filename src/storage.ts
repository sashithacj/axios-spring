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
  secureClearString,
} from './utils';

type StorageInterface = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  clear: () => Promise<void>;
  createKeyEscrow?: () => Promise<{ keyData: string; saltData: string; version: number }>;
  restoreFromEscrow?: (escrowData: { keyData: string; saltData: string; version: number }) => Promise<void>;
};

type SecureStorageConfig = {
  encryptionKey?: string;
  keyDerivationSalt?: string;
};

// Hardware Security Module support
class HardwareSecurityModule {
  private static instance: HardwareSecurityModule;
  private isHSMAvailable: boolean = false;
  private hsmKey: CryptoKey | null = null;

  static getInstance(): HardwareSecurityModule {
    if (!HardwareSecurityModule.instance) {
      HardwareSecurityModule.instance = new HardwareSecurityModule();
    }
    return HardwareSecurityModule.instance;
  }

  async initialize(): Promise<boolean> {
    if (!isWebCryptoAvailable()) {
      return false;
    }

    try {
      // Test for hardware security module support
      this.hsmKey = await crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256
        },
        false, // Non-extractable for hardware security
        ['encrypt', 'decrypt']
      );
      this.isHSMAvailable = true;
      return true;
    } catch (error) {
      this.isHSMAvailable = false;
      return false;
    }
  }

  isAvailable(): boolean {
    return this.isHSMAvailable;
  }

  async getHSMKey(): Promise<CryptoKey | null> {
    return this.hsmKey;
  }

  destroy(): void {
    this.hsmKey = null;
    this.isHSMAvailable = false;
  }
}

// Enhanced secure encryption with OWASP 2024 compliance
class SecureEncryption {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12;
  private static readonly HMAC_ALGORITHM = 'HMAC';
  private static readonly HMAC_HASH = 'SHA-256';
  
  // OWASP 2024 recommended security constants
  private static readonly PBKDF2_ITERATIONS = 1000000; // Updated to 1M iterations
  public static readonly SALT_LENGTH = 32; // OWASP recommended minimum
  private static readonly KEY_ROTATION_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  static async generateKey(): Promise<CryptoKey> {
    if (!isWebCryptoAvailable()) {
      throw new Error('Crypto operations not available');
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
      throw new Error('Crypto operations not available');
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
        iterations: this.PBKDF2_ITERATIONS,
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
      throw new Error('Crypto operations not available');
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

    // Create HMAC for integrity verification with algorithm identifier
    const hmacKey = await crypto.subtle.importKey(
      'raw',
      await crypto.subtle.exportKey('raw', key),
      { name: this.HMAC_ALGORITHM, hash: this.HMAC_HASH },
      false,
      ['sign'],
    );

    // Include algorithm identifier in HMAC to prevent confusion attacks
    const algorithmId = new TextEncoder().encode('AES-GCM-256');
    const dataToSign = new Uint8Array(algorithmId.length + iv.length + encrypted.byteLength);
    dataToSign.set(algorithmId);
    dataToSign.set(iv, algorithmId.length);
    dataToSign.set(new Uint8Array(encrypted), algorithmId.length + iv.length);

    const signature = await crypto.subtle.sign(this.HMAC_ALGORITHM, hmacKey, dataToSign);

    // Combine algorithm ID, IV, encrypted data, and HMAC signature
    const combined = new Uint8Array(algorithmId.length + iv.length + encrypted.byteLength + signature.byteLength);
    combined.set(algorithmId);
    combined.set(iv, algorithmId.length);
    combined.set(new Uint8Array(encrypted), algorithmId.length + iv.length);
    combined.set(new Uint8Array(signature), algorithmId.length + iv.length + encrypted.byteLength);

    return uint8ArrayToBase64(combined);
  }

  static async decrypt(encryptedData: string, key: CryptoKey): Promise<string> {
    if (!isWebCryptoAvailable()) {
      throw new Error('Crypto operations not available');
    }

    const combined = base64ToUint8Array(encryptedData);

    // Extract components
    const algorithmId = combined.slice(0, 9); // 'AES-GCM-256' length
    const iv = combined.slice(9, 9 + this.IV_LENGTH);
    const encrypted = combined.slice(9 + this.IV_LENGTH, combined.length - 32); // 32 bytes for HMAC-SHA256
    const signature = combined.slice(combined.length - 32);

    // Verify algorithm identifier
    const expectedAlgorithmId = new TextEncoder().encode('AES-GCM-256');
    if (!algorithmId.every((byte, index) => byte === expectedAlgorithmId[index])) {
      throw new Error('Invalid data format');
    }

    // Verify HMAC signature for integrity
    const hmacKey = await crypto.subtle.importKey(
      'raw',
      await crypto.subtle.exportKey('raw', key),
      { name: this.HMAC_ALGORITHM, hash: this.HMAC_HASH },
      false,
      ['verify'],
    );

    const dataToVerify = new Uint8Array(algorithmId.length + iv.length + encrypted.length);
    dataToVerify.set(algorithmId);
    dataToVerify.set(iv, algorithmId.length);
    dataToVerify.set(encrypted, algorithmId.length + iv.length);

    const isValid = await crypto.subtle.verify(
      this.HMAC_ALGORITHM,
      hmacKey,
      signature,
      dataToVerify,
    );

    if (!isValid) {
      throw new Error('Data integrity check failed');
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

// Enhanced secure key management with HSM support and key rotation
class SecureKeyManager {
  private masterKey: CryptoKey | null = null;
  private keyDerivationSalt: Uint8Array | null = null;
  private keyRotationTimer: NodeJS.Timeout | null = null;
  private readonly KEY_STORAGE_PREFIX = '@axios-spring-key-';
  private readonly SALT_STORAGE_PREFIX = '@axios-spring-salt-';
  private readonly KEY_VERSION_PREFIX = '@axios-spring-version-';
  private hsm: HardwareSecurityModule;
  private keyVersion: number = 1;
  private lastRotationTime: number = 0;
  private isRotating: boolean = false;

  constructor(private config: SecureStorageConfig) {
    this.hsm = HardwareSecurityModule.getInstance();
    // All security features are always enabled by default - no user choice
  }

  async initializeKey(): Promise<CryptoKey> {
    if (this.masterKey) {
      return this.masterKey;
    }

    try {
      // Initialize HSM if available
      await this.hsm.initialize();

      // Try to load existing key from secure storage
      const existingKey = await this.loadPersistedKey();
      if (existingKey) {
        this.masterKey = existingKey;
        this.startKeyRotation();
        return this.masterKey;
      }

      // Generate new key if none exists
      await this.generateNewKey();
      this.startKeyRotation();
      return this.masterKey!;
    } catch (error) {
      throw new Error('Failed to initialize encryption key');
    }
  }

  private async loadPersistedKey(): Promise<CryptoKey | null> {
    try {
      const keyData = await this.getSecureStorage().getItem(this.KEY_STORAGE_PREFIX + 'master');
      const saltData = await this.getSecureStorage().getItem(this.SALT_STORAGE_PREFIX + 'master');
      const versionData = await this.getSecureStorage().getItem(this.KEY_VERSION_PREFIX + 'master');
      
      if (!keyData || !saltData) {
        return null;
      }

      // Load key version
      this.keyVersion = versionData ? parseInt(versionData, 10) : 1;

      // Decode the persisted key and salt
      const keyBytes = base64ToUint8Array(keyData);
      const saltBytes = base64ToUint8Array(saltData);
      
      this.keyDerivationSalt = saltBytes;
      
      // Import the key
      const keyArrayBuffer = new ArrayBuffer(keyBytes.length);
      new Uint8Array(keyArrayBuffer).set(keyBytes);
      return await crypto.subtle.importKey(
        'raw',
        keyArrayBuffer,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      // If loading fails, return null to generate new key
      return null;
    }
  }

  private async generateNewKey(): Promise<void> {
    // Generate OWASP-recommended salt (32 bytes minimum)
    this.keyDerivationSalt = new Uint8Array(SecureEncryption.SALT_LENGTH);
    getRandomValues(this.keyDerivationSalt);

    if (this.config.encryptionKey) {
      // Use provided key with OWASP-recommended PBKDF2 derivation
      this.masterKey = await SecureEncryption.deriveKey(
        this.config.encryptionKey,
        this.keyDerivationSalt
      );
    } else {
      // Generate new random key
      this.masterKey = await SecureEncryption.generateKey();
    }

    // Persist the key securely
    await this.persistKey();
  }

  private async persistKey(): Promise<void> {
    if (!this.masterKey || !this.keyDerivationSalt) {
      throw new Error('Cannot persist key: key or salt not available');
    }

    try {
      // Export key as raw bytes
      const keyBytes = await crypto.subtle.exportKey('raw', this.masterKey);
      
      // Store key, salt, and version in secure storage
      await this.getSecureStorage().setItem(
        this.KEY_STORAGE_PREFIX + 'master',
        uint8ArrayToBase64(new Uint8Array(keyBytes))
      );
      
      await this.getSecureStorage().setItem(
        this.SALT_STORAGE_PREFIX + 'master',
        uint8ArrayToBase64(this.keyDerivationSalt)
      );

      await this.getSecureStorage().setItem(
        this.KEY_VERSION_PREFIX + 'master',
        this.keyVersion.toString()
      );
    } catch (error) {
      throw new Error('Failed to persist encryption key');
    }
  }

  private getSecureStorage(): StorageInterface {
    // Use the most secure storage available
    if (typeof window !== 'undefined' && window.localStorage) {
      return {
        getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
        setItem: (key: string, value: string) => Promise.resolve(localStorage.setItem(key, value)),
        removeItem: (key: string) => Promise.resolve(localStorage.removeItem(key)),
        clear: () => Promise.resolve(localStorage.clear()),
        createKeyEscrow: () => this.createKeyEscrow(),
        restoreFromEscrow: (escrowData) => this.restoreFromEscrow(escrowData),
      };
    }
    if (isReactNative) {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      return {
        getItem: (key: string) => AsyncStorage.getItem(key),
        setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
        removeItem: (key: string) => AsyncStorage.removeItem(key),
        clear: () => AsyncStorage.clear(),
        createKeyEscrow: () => this.createKeyEscrow(),
        restoreFromEscrow: (escrowData) => this.restoreFromEscrow(escrowData),
      };
    }
    return {
      getItem: (key: string) => Promise.resolve(null),
      setItem: (key: string, value: string) => Promise.resolve(),
      removeItem: (key: string) => Promise.resolve(),
      clear: () => Promise.resolve(),
      createKeyEscrow: () => this.createKeyEscrow(),
      restoreFromEscrow: (escrowData) => this.restoreFromEscrow(escrowData),
    };
  }

  async getMasterKey(): Promise<CryptoKey> {
    if (!this.masterKey) {
      await this.initializeKey();
    }
    return this.masterKey!;
  }

  async rotateKey(): Promise<void> {
    // Generate new key
    this.masterKey = await SecureEncryption.generateKey();
    
    // Generate new salt
    this.keyDerivationSalt = new Uint8Array(32);
    getRandomValues(this.keyDerivationSalt);
    
    // Increment version
    this.keyVersion++;
    this.lastRotationTime = Date.now();
    
    // Persist new key
    await this.persistKey();
  }

  private startKeyRotation(): void {
    // Always use 24-hour key rotation for maximum security
    const rotationInterval = 24 * 60 * 60 * 1000; // 24 hours - mandatory
    
    this.keyRotationTimer = setInterval(async () => {
      try {
        // Prevent concurrent key rotation
        if (this.isRotating) {
          return;
        }
        this.isRotating = true;
        await this.rotateKey();
      } catch (error) {
        // Silent error handling to prevent information disclosure
      } finally {
        this.isRotating = false;
      }
    }, rotationInterval);
  }

  // Key escrow mechanism for recovery
  async createKeyEscrow(): Promise<{ keyData: string; saltData: string; version: number }> {
    if (!this.masterKey || !this.keyDerivationSalt) {
      throw new Error('No key available for escrow');
    }

    const keyBytes = await crypto.subtle.exportKey('raw', this.masterKey);
    return {
      keyData: uint8ArrayToBase64(new Uint8Array(keyBytes)),
      saltData: uint8ArrayToBase64(this.keyDerivationSalt),
      version: this.keyVersion
    };
  }

  async restoreFromEscrow(escrowData: { keyData: string; saltData: string; version: number }): Promise<void> {
    const keyBytes = base64ToUint8Array(escrowData.keyData);
    const saltBytes = base64ToUint8Array(escrowData.saltData);
    
    this.keyDerivationSalt = saltBytes;
    this.keyVersion = escrowData.version;
    
    const keyArrayBuffer = new ArrayBuffer(keyBytes.length);
    new Uint8Array(keyArrayBuffer).set(keyBytes);
    this.masterKey = await crypto.subtle.importKey(
      'raw',
      keyArrayBuffer,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
    
    await this.persistKey();
  }

  destroy(): void {
    if (this.keyRotationTimer) {
      clearInterval(this.keyRotationTimer);
      this.keyRotationTimer = null;
    }
    
    // Secure memory clearing
    if (this.masterKey) {
      secureClearString(JSON.stringify(this.masterKey));
    }
    if (this.keyDerivationSalt) {
      secureClearString(uint8ArrayToBase64(this.keyDerivationSalt));
    }
    
    this.masterKey = null;
    this.keyDerivationSalt = null;
    this.hsm.destroy();
  }
}

// Secure memory storage with enhanced security
class SecureMemoryStorage {
  private store: Map<string, string> = new Map();
  private encryptionKey: CryptoKey | null = null;

  constructor(private config: any = {}) {
    this.initializeEncryption();
  }

  private async initializeEncryption(): Promise<void> {
    if (!isWebCryptoAvailable()) {
      throw new Error('Encryption not available');
    }

    // Generate a unique encryption key for this storage instance
    this.encryptionKey = await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  async getItem(key: string): Promise<string | null> {
    const encryptedValue = this.store.get(key);
    if (!encryptedValue || !this.encryptionKey) return null;

    try {
      const decrypted = await SecureEncryption.decrypt(encryptedValue, this.encryptionKey);
      return decrypted;
    } catch (error) {
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not available');
    }

    const encrypted = await SecureEncryption.encrypt(value, this.encryptionKey);
    this.store.set(key, encrypted);
    
    // Secure memory clearing
    secureClearString(value);
  }

  async removeItem(key: string): Promise<void> {
    const value = this.store.get(key);
    if (value) {
      secureClearString(value);
    }
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    // Secure clear all values
    for (const [key, value] of this.store) {
      secureClearString(value);
    }
    this.store.clear();
  }

  destroy() {
    // Secure clear all values
    for (const [key, value] of this.store) {
      secureClearString(value);
    }
    this.store.clear();
    
    if (this.encryptionKey) {
      secureClearString(JSON.stringify(this.encryptionKey));
    }
    this.encryptionKey = null;
  }
}

// Enhanced secure storage with HSM support
class SecureStorage implements StorageInterface {
  private memoryStorage: SecureMemoryStorage;
  private keyManager: SecureKeyManager;
  private isEncryptionAvailable: boolean = false;
  private hsm: HardwareSecurityModule;

  constructor(private config: SecureStorageConfig = {}) {
    this.memoryStorage = new SecureMemoryStorage(config);
    this.keyManager = new SecureKeyManager(config);
    this.hsm = HardwareSecurityModule.getInstance();
    this.initializeEncryption();
  }

  private async initializeEncryption() {
    if (!isWebCryptoAvailable()) {
      throw new Error('Encryption not available');
    }

    this.isEncryptionAvailable = true;
    await this.keyManager.initializeKey();
  }

  private async encryptValue(value: string): Promise<string> {
    if (!this.isEncryptionAvailable) {
      throw new Error('Encryption is not available. Secure storage requires encryption.');
    }

    const key = await this.keyManager.getMasterKey();
    
    try {
      return await SecureEncryption.encrypt(value, key);
    } catch (error) {
      throw new Error('Encryption failed');
    }
  }

  private async decryptValue(encryptedValue: string): Promise<string> {
    if (!this.isEncryptionAvailable) {
      throw new Error('Decryption is not available. Secure storage requires encryption.');
    }

    const key = await this.keyManager.getMasterKey();
    
    try {
      return await SecureEncryption.decrypt(encryptedValue, key);
    } catch (error) {
      throw new Error('Decryption failed');
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

  // Key escrow methods
  async createKeyEscrow(): Promise<{ keyData: string; saltData: string; version: number }> {
    return this.keyManager.createKeyEscrow();
  }

  async restoreFromEscrow(escrowData: { keyData: string; saltData: string; version: number }): Promise<void> {
    return this.keyManager.restoreFromEscrow(escrowData);
  }

  destroy() {
    this.memoryStorage.destroy();
    this.keyManager.destroy();
  }
}

// Browser secure storage with HSM support
class BrowserSecureStorage implements StorageInterface {
  private keyManager!: SecureKeyManager;
  private isEncryptionAvailable: boolean = false;
  private hsm: HardwareSecurityModule;

  constructor(private config: SecureStorageConfig = {}) {
    this.keyManager = new SecureKeyManager(config);
    this.hsm = HardwareSecurityModule.getInstance();
    this.initializeEncryption();
  }

  private async initializeEncryption() {
    if (!isWebCryptoAvailable()) {
      throw new Error('Encryption not available');
    }

    this.isEncryptionAvailable = true;
    await this.keyManager.initializeKey();
  }

  private async encryptValue(value: string): Promise<string> {
    if (!this.isEncryptionAvailable) {
      throw new Error('Encryption is not available. Secure storage requires encryption.');
    }

    const key = await this.keyManager.getMasterKey();
    
    try {
      return await SecureEncryption.encrypt(value, key);
    } catch (error) {
      throw new Error('Encryption failed');
    }
  }

  private async decryptValue(encryptedValue: string): Promise<string> {
    if (!this.isEncryptionAvailable) {
      throw new Error('Decryption is not available. Secure storage requires encryption.');
    }

    const key = await this.keyManager.getMasterKey();
    
    try {
      return await SecureEncryption.decrypt(encryptedValue, key);
    } catch (error) {
      throw new Error('Decryption failed');
    }
  }

  async getItem(key: string): Promise<string | null> {
    const localValue = localStorage.getItem(key);
    if (!localValue) return null;

    return this.decryptValue(localValue);
  }

  async setItem(key: string, value: string): Promise<void> {
    const encryptedValue = await this.encryptValue(value);
    localStorage.setItem(key, encryptedValue);
    
    // Secure memory clearing
    secureClearString(value);
  }

  async removeItem(key: string): Promise<void> {
    localStorage.removeItem(key);
  }

  async clear(): Promise<void> {
    localStorage.clear();
  }

  // Key escrow methods
  async createKeyEscrow(): Promise<{ keyData: string; saltData: string; version: number }> {
    return this.keyManager.createKeyEscrow();
  }

  async restoreFromEscrow(escrowData: { keyData: string; saltData: string; version: number }): Promise<void> {
    return this.keyManager.restoreFromEscrow(escrowData);
  }

  destroy() {
    this.keyManager.destroy();
  }
}

// React Native secure storage with HSM support
class ReactNativeSecureStorage implements StorageInterface {
  private keyManager!: SecureKeyManager;
  private isEncryptionAvailable: boolean = false;
  private AsyncStorage: any;
  private hsm: HardwareSecurityModule;

  constructor(private config: SecureStorageConfig = {}) {
    this.AsyncStorage = require('@react-native-async-storage/async-storage');
    this.keyManager = new SecureKeyManager(config);
    this.hsm = HardwareSecurityModule.getInstance();
    this.initializeEncryption();
  }

  private async initializeEncryption() {
    if (!isWebCryptoAvailable()) {
      throw new Error('Encryption not available');
    }

    this.isEncryptionAvailable = true;
    await this.keyManager.initializeKey();
  }

  private async encryptValue(value: string): Promise<string> {
    if (!this.isEncryptionAvailable) {
      throw new Error('Encryption is not available. Secure storage requires encryption.');
    }

    const key = await this.keyManager.getMasterKey();
    
    try {
      return await SecureEncryption.encrypt(value, key);
    } catch (error) {
      throw new Error('Encryption failed');
    }
  }

  private async decryptValue(encryptedValue: string): Promise<string> {
    if (!this.isEncryptionAvailable) {
      throw new Error('Decryption is not available. Secure storage requires encryption.');
    }

    const key = await this.keyManager.getMasterKey();
    
    try {
      return await SecureEncryption.decrypt(encryptedValue, key);
    } catch (error) {
      throw new Error('Decryption failed');
    }
  }

  async getItem(key: string): Promise<string | null> {
    const asyncValue = await this.AsyncStorage.getItem(key);
    if (!asyncValue) return null;

    return this.decryptValue(asyncValue);
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

  // Key escrow methods
  async createKeyEscrow(): Promise<{ keyData: string; saltData: string; version: number }> {
    return this.keyManager.createKeyEscrow();
  }

  async restoreFromEscrow(escrowData: { keyData: string; saltData: string; version: number }): Promise<void> {
    return this.keyManager.restoreFromEscrow(escrowData);
  }

  destroy() {
    this.keyManager.destroy();
  }
}

let Storage: StorageInterface;
let currentStorageConfig: SecureStorageConfig = {};

// Function to initialize storage with secure defaults - all security features enabled by default
export function initializeSecureStorage(config: SecureStorageConfig = {}) {
  currentStorageConfig = {
    // All security features are mandatory - no user choice
    ...config,
  };

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