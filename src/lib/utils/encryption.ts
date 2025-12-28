/**
 * Encryption utilities for local storage
 * Uses Web Crypto API for secure encryption
 */

/**
 * Generate a key from password using PBKDF2
 */
async function deriveKey(password: string, salt: BufferSource): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const passwordBuffer = encoder.encode(password)
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  )
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt data using AES-GCM
 */
export async function encrypt(data: string, password: string): Promise<string> {
  try {
    // Generate random salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const iv = crypto.getRandomValues(new Uint8Array(12))
    
    // Derive key from password
    const key = await deriveKey(password, salt)
    
    // Encrypt data
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(data)
    
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      dataBuffer
    )
    
    // Combine salt, IV, and encrypted data
    const encryptedArray = new Uint8Array(encryptedBuffer)
    const combined = new Uint8Array(salt.length + iv.length + encryptedArray.length)
    combined.set(salt, 0)
    combined.set(iv, salt.length)
    combined.set(encryptedArray, salt.length + iv.length)
    
    // Convert to base64
    return btoa(String.fromCharCode(...combined))
  } catch (error) {
    console.error('Encryption failed:', error)
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypt data using AES-GCM
 */
export async function decrypt(encryptedData: string, password: string): Promise<string> {
  try {
    // Convert from base64
    const combined = new Uint8Array(
      atob(encryptedData)
        .split('')
        .map(char => char.charCodeAt(0))
    )
    
    // Extract salt, IV, and encrypted data
    const salt = combined.slice(0, 16)
    const iv = combined.slice(16, 28)
    const data = combined.slice(28)
    
    // Derive key from password
    const key = await deriveKey(password, salt)
    
    // Decrypt data
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      data
    )
    
    // Convert back to string
    const decoder = new TextDecoder()
    return decoder.decode(decryptedBuffer)
  } catch (error) {
    console.error('Decryption failed:', error)
    throw new Error('Failed to decrypt data')
  }
}

/**
 * Simple hash function for non-sensitive data
 */
export async function hash(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate random string for keys/IDs
 */
export function generateRandomString(length = 32): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Secure storage wrapper with encryption
 */
export class SecureStorage {
  private password: string
  
  constructor(password: string) {
    this.password = password
  }
  
  /**
   * Store encrypted data
   */
  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await encrypt(value, this.password)
    localStorage.setItem(key, encrypted)
  }
  
  /**
   * Retrieve and decrypt data
   */
  async getItem(key: string): Promise<string | null> {
    const encrypted = localStorage.getItem(key)
    
    if (!encrypted) {
      return null
    }
    
    try {
      return await decrypt(encrypted, this.password)
    } catch {
      // If decryption fails, remove corrupted data
      localStorage.removeItem(key)
      return null
    }
  }
  
  /**
   * Remove item
   */
  removeItem(key: string): void {
    localStorage.removeItem(key)
  }
  
  /**
   * Clear all items
   */
  clear(): void {
    localStorage.clear()
  }
}

/**
 * Get encryption key from environment or generate one
 */
export function getEncryptionKey(): string {
  if (typeof window === 'undefined') {
    return process.env.ENCRYPTION_SECRET_KEY || 'default-secret-key-change-in-production'
  }
  
  // In browser, use a key derived from multiple sources
  const key = localStorage.getItem('encryption_key')
  
  if (key) {
    return key
  }
  
  // Generate new key if not found
  const newKey = generateRandomString(32)
  localStorage.setItem('encryption_key', newKey)
  
  return newKey
}

