/**
 * AES-256 Encryption Utilities for Ziri
 * Provides at-rest encryption for sensitive embedding data
 */

import crypto from 'node:crypto';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Encryption configuration
 */
const DEFAULT_ALGORITHM = 'aes-256-gcm';
const DEFAULT_KEY_LENGTH = 32; // 256 bits
const DEFAULT_IV_LENGTH = 12;  // 96 bits for GCM
const DEFAULT_AUTH_TAG_LENGTH = 16;

/**
 * Ziri Encryption Service
 */
export class EncryptionService {
  /**
   * Create new encryption service
   * @param {string} passphrase - User passphrase for key derivation
   */
  constructor(passphrase = null) {
    this.passphrase = passphrase;
    this.encryptionKey = passphrase ? this.deriveKey(passphrase) : null;
    this.isEnabled = !!passphrase;
  }

  /**
   * Derive encryption key from passphrase using PBKDF2
   * @param {string} passphrase - User passphrase
   * @param {Buffer} salt - Optional salt (generated if not provided)
   * @returns {Buffer} Derived key
   */
  deriveKey(passphrase, salt = null) {
    if (!salt) {
      salt = randomBytes(16);
    }
    
    const key = crypto.pbkdf2Sync(
      passphrase,
      salt,
      100000, // iterations
      DEFAULT_KEY_LENGTH,
      'sha256'
    );
    
    return { key, salt };
  }

  /**
   * Encrypt data using AES-256-GCM
   * @param {Buffer|string} data - Data to encrypt
   * @param {Buffer} key - Encryption key (optional, uses derived key if not provided)
   * @returns {Object} Encrypted data with metadata
   */
  encrypt(data, key = null) {
    if (!this.isEnabled && !key) {
      throw new Error('Encryption is not enabled. Provide a passphrase or key.');
    }

    const encryptionKey = key || this.encryptionKey.key;
    const iv = randomBytes(DEFAULT_IV_LENGTH);
    const cipher = createCipheriv(DEFAULT_ALGORITHM, encryptionKey, iv);
    
    // Convert string to buffer if needed
    if (typeof data === 'string') {
      data = Buffer.from(data, 'utf8');
    }
    
    const encrypted = cipher.update(data);
    cipher.final();
    
    const authTag = cipher.getAuthTag();
    
    return {
      data: Buffer.concat([encrypted, authTag]),
      iv: iv,
      algorithm: DEFAULT_ALGORITHM,
      timestamp: Date.now()
    };
  }

  /**
   * Decrypt data using AES-256-GCM
   * @param {Object} encryptedData - Encrypted data object
   * @param {Buffer} key - Decryption key (optional, uses derived key if not provided)
   * @returns {Buffer} Decrypted data
   */
  decrypt(encryptedData, key = null) {
    if (!this.isEnabled && !key) {
      throw new Error('Encryption is not enabled. Provide a passphrase or key.');
    }

    const encryptionKey = key || this.encryptionKey.key;
    const { data, iv, algorithm } = encryptedData;
    
    if (algorithm !== DEFAULT_ALGORITHM) {
      throw new Error(`Unsupported encryption algorithm: ${algorithm}`);
    }
    
    // Extract auth tag from the end of data
    const authTag = data.subarray(-DEFAULT_AUTH_TAG_LENGTH);
    const encryptedContent = data.subarray(0, -DEFAULT_AUTH_TAG_LENGTH);
    
    const decipher = createDecipheriv(algorithm, encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    const decrypted = decipher.update(encryptedContent);
    decipher.final();
    
    return decrypted;
  }

  /**
   * Encrypt and serialize data to JSON
   * @param {any} data - Data to encrypt and serialize
   * @returns {string} JSON string of encrypted data
   */
  encryptToJson(data) {
    if (!this.isEnabled) {
      throw new Error('Encryption is not enabled.');
    }

    const serialized = JSON.stringify(data);
    const encrypted = this.encrypt(serialized);
    
    // Include salt for key derivation
    return JSON.stringify({
      ...encrypted,
      salt: this.encryptionKey.salt,
      data: encrypted.data.toString('base64'),
      iv: encrypted.iv.toString('base64')
    });
  }

  /**
   * Decrypt and deserialize data from JSON
   * @param {string} json - JSON string of encrypted data
   * @returns {any} Decrypted and deserialized data
   */
  decryptFromJson(json) {
    if (!this.isEnabled) {
      throw new Error('Encryption is not enabled.');
    }

    const encryptedData = JSON.parse(json);
    
    // Reconstruct buffers from base64
    encryptedData.data = Buffer.from(encryptedData.data, 'base64');
    encryptedData.iv = Buffer.from(encryptedData.iv, 'base64');
    
    // If salt is present, re-derive key
    if (encryptedData.salt) {
      const salt = Buffer.from(encryptedData.salt, 'base64');
      const derivedKey = this.deriveKey(this.passphrase, salt);
      const decrypted = this.decrypt(encryptedData, derivedKey.key);
      return JSON.parse(decrypted.toString('utf8'));
    }
    
    const decrypted = this.decrypt(encryptedData);
    return JSON.parse(decrypted.toString('utf8'));
  }

  /**
   * Check if encryption is enabled
   * @returns {boolean} True if encryption is enabled
   */
  isEncryptionEnabled() {
    return this.isEnabled;
  }

  /**
   * Get encryption key information (without exposing the key)
   * @returns {Object} Key information
   */
  getKeyInfo() {
    return {
      algorithm: DEFAULT_ALGORITHM,
      keyLength: DEFAULT_KEY_LENGTH,
      hasKey: !!this.encryptionKey
    };
  }
}

/**
 * Simple encryption utilities for backward compatibility
 */
export const SimpleEncryption = {
  /**
   * Encrypt data with a passphrase
   * @param {string|Buffer} data - Data to encrypt
   * @param {string} passphrase - Passphrase for encryption
   * @returns {string} Base64 encoded encrypted data
   */
  encrypt(data, passphrase) {
    const service = new EncryptionService(passphrase);
    const encrypted = service.encrypt(data);
    
    return JSON.stringify({
      data: encrypted.data.toString('base64'),
      iv: encrypted.iv.toString('base64'),
      salt: service.encryptionKey.salt.toString('base64')
    });
  },

  /**
   * Decrypt data with a passphrase
   * @param {string} encryptedJson - Base64 encoded encrypted data
   * @param {string} passphrase - Passphrase for decryption
   * @returns {Buffer} Decrypted data
   */
  decrypt(encryptedJson, passphrase) {
    const encryptedData = JSON.parse(encryptedJson);
    const service = new EncryptionService(passphrase);
    
    // Reconstruct buffers
    encryptedData.data = Buffer.from(encryptedData.data, 'base64');
    encryptedData.iv = Buffer.from(encryptedData.iv, 'base64');
    const salt = Buffer.from(encryptedData.salt, 'base64');
    
    // Re-derive key
    const derivedKey = service.deriveKey(passphrase, salt);
    const decrypted = service.decrypt(encryptedData, derivedKey.key);
    
    return decrypted;
  }
};

/**
 * File encryption utilities
 */
export class FileEncryption {
  /**
   * Create file encryption service
   * @param {string} passphrase - Passphrase for encryption
   */
  constructor(passphrase) {
    this.encryptionService = new EncryptionService(passphrase);
  }

  /**
   * Encrypt file content
   * @param {Buffer} fileContent - File content to encrypt
   * @returns {Buffer} Encrypted file content
   */
  encryptFile(fileContent) {
    const encrypted = this.encryptionService.encrypt(fileContent);
    return Buffer.concat([
      Buffer.from(JSON.stringify({
        iv: encrypted.iv.toString('base64'),
        algorithm: encrypted.algorithm,
        timestamp: encrypted.timestamp
      })),
      Buffer.from('\n'),
      encrypted.data
    ]);
  }

  /**
   * Decrypt file content
   * @param {Buffer} encryptedFileContent - Encrypted file content
   * @returns {Buffer} Decrypted file content
   */
  decryptFile(encryptedFileContent) {
    const newlineIndex = encryptedFileContent.indexOf('\n');
    if (newlineIndex === -1) {
      throw new Error('Invalid encrypted file format');
    }
    
    const header = JSON.parse(encryptedFileContent.subarray(0, newlineIndex).toString('utf8'));
    const encryptedData = {
      data: encryptedFileContent.subarray(newlineIndex + 1),
      iv: Buffer.from(header.iv, 'base64'),
      algorithm: header.algorithm
    };
    
    return this.encryptionService.decrypt(encryptedData);
  }
}