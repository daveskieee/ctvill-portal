/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * RFC 6238 Time-Based One-Time Password (TOTP) & QR Code URI Generator
 * Compatible with Google Authenticator, Microsoft Authenticator, Authy, and Apple Passwords.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// Default deterministic Base32 secrets per role account so backend & frontend stay in sync
const DEFAULT_ACCOUNT_SECRETS: Record<string, string> = {
  'om@ldmconstruction.ph': 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
  'pm@ldmconstruction.ph': 'KRSXG5CTMVRXEZLUKRSXG5CTMVRXEZLU',
  'finance@ldmconstruction.ph': 'MFRGGZDFMZTWQ2LKMFRGGZDFMZTWQ2LK',
  'timekeeper@ldmconstruction.ph': 'ORUW2ZLLMVSXAZLSORUW2ZLLMVSXAZLS',
};

/**
 * Normalize an email to the canonical @ldmconstruction.ph domain.
 */
function normalizeAccountKey(email: string): string {
  const clean = (email || '').trim().toLowerCase();
  const atIndex = clean.indexOf('@');
  if (atIndex > 0) {
    const localPart = clean.slice(0, atIndex);
    const domain = clean.slice(atIndex + 1);
    if (domain !== 'ldmconstruction.ph' && ['om', 'pm', 'finance', 'timekeeper', 'admin'].includes(localPart)) {
      return `${localPart}@ldmconstruction.ph`;
    }
  }
  return clean;
}

/**
 * Retrieve or generate a valid 32-character Base32 TOTP secret for an account.
 */
export function getOrCreateTotpSecret(email: string): string {
  const clean = normalizeAccountKey(email);
  if (!clean) return 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(`ldm_totp_secret_${clean}`);
      if (saved && saved.length >= 16) return saved;
    } catch {
      /* ignore */
    }
  }

  if (DEFAULT_ACCOUNT_SECRETS[clean]) {
    return DEFAULT_ACCOUNT_SECRETS[clean];
  }

  // Generate deterministic Base32 secret from email characters if unknown user
  let seed = '';
  for (let i = 0; i < 32; i++) {
    const charCode = clean.charCodeAt(i % clean.length) + i * 7;
    seed += BASE32_ALPHABET[charCode % 32];
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`ldm_totp_secret_${clean}`, seed);
    } catch {
      /* ignore */
    }
  }
  return seed;
}

/**
 * Format secret in readable 4-character blocks for manual entry.
 */
export function formatTotpSecretDisplay(secret: string): string {
  return secret.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Build standard otpauth:// URI for QR code scanners (Google/Microsoft Authenticator).
 */
export function buildOtpAuthUri(email: string, secret?: string): string {
  const cleanEmail = normalizeAccountKey(email || 'om@ldmconstruction.ph');
  const resolvedSecret = (secret || getOrCreateTotpSecret(cleanEmail)).replace(/\s+/g, '');
  const issuer = 'LDM Construction ERP';
  const label = `${ encodeURIComponent(issuer) }:${ encodeURIComponent(cleanEmail) }`;
  return `otpauth://totp/${label}?secret=${resolvedSecret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Decode a Base32 string into a Uint8Array for HMAC-SHA1 computation.
 */
function base32ToBytes(base32: string): Uint8Array {
  const cleaned = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (let i = 0; i < cleaned.length; i++) {
    const val = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (val >= 0) {
      bits += val.toString(2).padStart(5, '0');
    }
  }
  const byteCount = Math.floor(bits.length / 8);
  const bytes = new Uint8Array(byteCount);
  for (let i = 0; i < byteCount; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  return bytes;
}

/**
 * Compute RFC 6238 6-digit TOTP code for a given Base32 secret and time step offset.
 */
export async function generateTotpCode(secret: string, windowOffset = 0): Promise<string> {
  const keyBytes = base32ToBytes(secret);
  const epochSeconds = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epochSeconds / 30) + windowOffset;

  // 8-byte big-endian counter buffer
  const counterBuf = new ArrayBuffer(8);
  const view = new DataView(counterBuf);
  view.setUint32(0, Math.floor(counter / 0x100000000), false);
  view.setUint32(4, counter >>> 0, false);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, counterBuf);
  const hmac = new Uint8Array(signature);
  const offset = hmac[hmac.length - 1] & 0x0f;

  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = (binary % 1000000).toString().padStart(6, '0');
  return otp;
}

/**
 * Verify a 6-digit TOTP code from Google/Microsoft Authenticator (checks -1, 0, +1 30s windows).
 */
export async function verifyTotpCode(email: string, code: string): Promise<boolean> {
  const cleanCode = (code || '').replace(/\D/g, '');
  if (cleanCode.length !== 6) return false;

  const secret = getOrCreateTotpSecret(email);
  try {
    for (const offset of [-1, 0, 1]) {
      const expected = await generateTotpCode(secret, offset);
      if (expected === cleanCode) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

// ============================================================================
// DYNAMIC SINGLE-USE EMERGENCY BACKUP RECOVERY CODES
// ============================================================================

export interface BackupRecoveryCode {
  code: string;
  used: boolean;
  usedAt?: string;
}

const BACKUP_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function randomBlock(length = 4): string {
  const arr = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
  }
  let out = '';
  for (let i = 0; i < length; i++) {
    out += BACKUP_ALPHABET[arr[i] % BACKUP_ALPHABET.length];
  }
  return out;
}

/**
 * Generate a fresh batch of single-use backup recovery codes for an account.
 * Calling this invalidates any previously generated codes for that account.
 */
export function generateBackupRecoveryCodes(email: string, count = 4): BackupRecoveryCode[] {
  const clean = normalizeAccountKey(email);
  const generated = new Set<string>();
  const list: BackupRecoveryCode[] = [];

  while (list.length < count) {
    const candidate = `LDM-${randomBlock(4)}-${randomBlock(4)}`;
    if (!generated.has(candidate)) {
      generated.add(candidate);
      list.push({ code: candidate, used: false });
    }
  }

  if (typeof window !== 'undefined' && clean) {
    try {
      localStorage.setItem(`ldm_2fa_backup_codes_${clean}`, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  }
  return list;
}

/**
 * Retrieve existing backup recovery codes for an account, or generate an initial batch if none exist.
 */
export function getBackupRecoveryCodes(email: string): BackupRecoveryCode[] {
  const clean = normalizeAccountKey(email);
  if (typeof window !== 'undefined' && clean) {
    try {
      const raw = localStorage.getItem(`ldm_2fa_backup_codes_${clean}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0]?.code === 'string') {
          return parsed;
        }
      }
    } catch {
      /* ignore */
    }
  }
  return generateBackupRecoveryCodes(clean, 4);
}

/**
 * Verify and consume a single-use backup recovery code.
 * Once consumed, the code is permanently marked as `used: true` and cannot be reused.
 */
export function consumeBackupRecoveryCode(
  email: string,
  submittedCode: string
): { valid: boolean; reason?: 'USED' | 'INVALID'; remaining: number } {
  const clean = normalizeAccountKey(email);
  const normalizedCode = (submittedCode || '').trim().toUpperCase();
  const codes = getBackupRecoveryCodes(clean);

  const match = codes.find((item) => item.code.toUpperCase() === normalizedCode);
  if (!match) {
    const remaining = codes.filter((c) => !c.used).length;
    return { valid: false, reason: 'INVALID', remaining };
  }

  if (match.used) {
    const remaining = codes.filter((c) => !c.used).length;
    return { valid: false, reason: 'USED', remaining };
  }

  // Mark as used (single-use burn)
  match.used = true;
  match.usedAt = new Date().toISOString();

  if (typeof window !== 'undefined' && clean) {
    try {
      localStorage.setItem(`ldm_2fa_backup_codes_${clean}`, JSON.stringify(codes));
    } catch {
      /* ignore */
    }
  }

  const remaining = codes.filter((c) => !c.used).length;
  return { valid: true, remaining };
}

/**
 * Clear stored TOTP secret and backup recovery codes for an account when unlinking 2FA.
 */
export function clearAccountTotpData(email: string): void {
  if (typeof window === 'undefined') return;
  const clean = normalizeAccountKey(email);
  const rawLower = (email || '').trim().toLowerCase();
  const localPart = clean.split('@')[0];
  try {
    const keysToRemove = [
      `ldm_totp_secret_${clean}`,
      `ldm_totp_secret_${rawLower}`,
      `ldm_2fa_backup_codes_${clean}`,
      `ldm_2fa_backup_codes_${rawLower}`,
      `ldm_2fa_enrolled_${clean}`,
      `ldm_2fa_enrolled_${rawLower}`,
      `ldm_2fa_enrolled_${localPart}@ldmconstruction.ph`,
      `ldm_2fa_enrolled_${localPart}@ctvill.com`,
    ];
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}


