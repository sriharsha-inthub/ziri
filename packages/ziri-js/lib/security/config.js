/**
 * Security Configuration Manager for Ziri
 * Manages encryption settings and security policies
 */

import { readFile, writeFile, access } from 'fs/promises';
import { join } from 'path';
import { resolveHome } from '../home.js';

/**
 * Security Configuration Manager
 */
export class SecurityConfig {
  constructor() {
    this.configPath = join(resolveHome(), 'config', 'security.json');
    this.config = {
      encryption: {
        enabled: false,
        algorithm: 'aes-256-gcm',
        keyDerivation: {
          iterations: 100000,
          hash: 'sha256'
        }
      },
      access: {
        requireAuthentication: false,
        sessionTimeout: 900 // 15 minutes
      },
      logging: {
        audit: false,
        redactSensitive: true
      }
    };
  }

  /**
   * Load security configuration from file
   */
  async load() {
    try {
      const data = await readFile(this.configPath, 'utf8');
      this.config = { ...this.config, ...JSON.parse(data) };
    } catch (error) {
      // Config file doesn't exist, use defaults
      await this.save();
    }
    return this.config;
  }

  /**
   * Save security configuration to file
   */
  async save() {
    const configDir = join(resolveHome(), 'config');
    try {
      await access(configDir);
    } catch {
      // Create config directory if it doesn't exist
      const { mkdir } = await import('fs/promises');
      await mkdir(configDir, { recursive: true });
    }
    
    await writeFile(this.configPath, JSON.stringify(this.config, null, 2));
    return this.config;
  }

  /**
   * Enable encryption with passphrase
   * @param {string} passphrase - User passphrase
   */
  async enableEncryption(passphrase) {
    if (!passphrase || passphrase.length < 8) {
      throw new Error('Passphrase must be at least 8 characters long');
    }
    
    this.config.encryption.enabled = true;
    this.config.encryption.passphraseHash = this.hashPassphrase(passphrase);
    await this.save();
  }

  /**
   * Disable encryption
   */
  async disableEncryption() {
    this.config.encryption.enabled = false;
    delete this.config.encryption.passphraseHash;
    await this.save();
  }

  /**
   * Check if encryption is enabled
   */
  isEncryptionEnabled() {
    return this.config.encryption.enabled;
  }

  /**
   * Verify passphrase
   * @param {string} passphrase - Passphrase to verify
   */
  verifyPassphrase(passphrase) {
    if (!this.config.encryption.passphraseHash) {
      return false;
    }
    return this.hashPassphrase(passphrase) === this.config.encryption.passphraseHash;
  }

  /**
   * Hash passphrase for storage
   * @param {string} passphrase - Passphrase to hash
   */
  hashPassphrase(passphrase) {
    const crypto = require('node:crypto');
    return crypto.createHash('sha256').update(passphrase).digest('hex');
  }

  /**
   * Get current security configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Update security configuration
   * @param {Object} newConfig - New configuration values
   */
  async updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    await this.save();
  }

  /**
   * Get encryption settings
   */
  getEncryptionSettings() {
    return { ...this.config.encryption };
  }

  /**
   * Set access control settings
   * @param {Object} accessSettings - Access control settings
   */
  async setAccessSettings(accessSettings) {
    this.config.access = { ...this.config.access, ...accessSettings };
    await this.save();
  }
}