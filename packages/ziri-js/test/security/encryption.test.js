import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EncryptionService, SimpleEncryption } from '../../lib/security/encryption.js';
import { SecurityConfig } from '../../lib/security/config.js';
import fs from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Encryption Service', () => {
  const testPassphrase = 'test-passphrase-123';
  const testData = 'This is sensitive test data that should be encrypted';
  
  it('should encrypt and decrypt data correctly', () => {
    const service = new EncryptionService(testPassphrase);
    
    // Encrypt data
    const encrypted = service.encrypt(testData);
    expect(encrypted).toBeDefined();
    expect(encrypted.data).toBeInstanceOf(Buffer);
    expect(encrypted.iv).toBeInstanceOf(Buffer);
    expect(encrypted.algorithm).toBe('aes-256-gcm');
    
    // Decrypt data
    const decrypted = service.decrypt(encrypted);
    expect(decrypted.toString('utf8')).toBe(testData);
  });
  
  it('should encrypt and decrypt JSON data', () => {
    const service = new EncryptionService(testPassphrase);
    const testObject = {
      name: 'test',
      value: 123,
      nested: {
        array: [1, 2, 3],
        boolean: true
      }
    };
    
    // Encrypt to JSON
    const encryptedJson = service.encryptToJson(testObject);
    expect(typeof encryptedJson).toBe('string');
    
    // Decrypt from JSON
    const decryptedObject = service.decryptFromJson(encryptedJson);
    expect(decryptedObject).toEqual(testObject);
  });
  
  it('should derive keys consistently', () => {
    const service1 = new EncryptionService(testPassphrase);
    const service2 = new EncryptionService(testPassphrase);
    
    // Same passphrase should produce same key info (when using same salt)
    expect(service1.getKeyInfo().algorithm).toBe(service2.getKeyInfo().algorithm);
    expect(service1.getKeyInfo().keyLength).toBe(service2.getKeyInfo().keyLength);
  });
  
  it('should handle SimpleEncryption utilities', () => {
    // Encrypt with simple utility
    const encrypted = SimpleEncryption.encrypt(testData, testPassphrase);
    expect(typeof encrypted).toBe('string');
    
    // Decrypt with simple utility
    const decrypted = SimpleEncryption.decrypt(encrypted, testPassphrase);
    expect(decrypted.toString('utf8')).toBe(testData);
  });
  
  it('should reject operations when encryption is not enabled', () => {
    const service = new EncryptionService(); // No passphrase
    
    expect(() => service.encrypt(testData)).toThrow();
    expect(() => service.encryptToJson(testData)).toThrow();
  });
});

describe('Security Configuration', () => {
  let tempDir;
  let configPath;
  
  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = join(tmpdir(), 'ziri-security-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
    configPath = join(tempDir, 'security.json');
  });
  
  afterEach(async () => {
    // Clean up temporary files
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  it('should manage encryption configuration', async () => {
    const config = new SecurityConfig();
    config.configPath = configPath;
    
    // Load default config
    await config.load();
    expect(config.isEncryptionEnabled()).toBe(false);
    
    // Enable encryption
    const passphrase = 'test-passphrase';
    await config.enableEncryption(passphrase);
    expect(config.isEncryptionEnabled()).toBe(true);
    
    // Verify passphrase
    expect(config.verifyPassphrase(passphrase)).toBe(true);
    expect(config.verifyPassphrase('wrong-passphrase')).toBe(false);
    
    // Disable encryption
    await config.disableEncryption();
    expect(config.isEncryptionEnabled()).toBe(false);
  });
  
  it('should reject weak passphrases', async () => {
    const config = new SecurityConfig();
    config.configPath = configPath;
    
    await config.load();
    
    // Should reject short passphrases
    await expect(config.enableEncryption('short')).rejects.toThrow();
  });
  
  it('should update configuration', async () => {
    const config = new SecurityConfig();
    config.configPath = configPath;
    
    await config.load();
    
    const newSettings = {
      access: {
        requireAuthentication: true,
        sessionTimeout: 1800
      }
    };
    
    await config.updateConfig(newSettings);
    const currentConfig = config.getConfig();
    expect(currentConfig.access.requireAuthentication).toBe(true);
    expect(currentConfig.access.sessionTimeout).toBe(1800);
  });
});