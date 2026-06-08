import crypto from 'node:crypto';

const ITERATIONS = 210000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';
const SESSION_DIGEST = 'sha256';
export const PASSWORD_MIN_LENGTH = 3;
export const PASSWORD_MAX_LENGTH = 128;

export function createPasswordRecord(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return {
    salt,
    iterations: ITERATIONS,
    digest: DIGEST,
    hash: hashPassword(password, salt, ITERATIONS, DIGEST)
  };
}

export function hashPassword(password, salt, iterations = ITERATIONS, digest = DIGEST) {
  return crypto.pbkdf2Sync(String(password), salt, iterations, KEY_LENGTH, digest).toString('hex');
}

export function verifyPassword(password, record) {
  if (!record?.salt || !record?.hash) return false;
  const actual = hashPassword(password, record.salt, record.iterations || ITERATIONS, record.digest || DIGEST);
  const expected = Buffer.from(record.hash, 'hex');
  const candidate = Buffer.from(actual, 'hex');
  if (expected.length !== candidate.length) return false;
  return crypto.timingSafeEqual(expected, candidate);
}

export function validateNewPassword(password, { currentPassword = null } = {}) {
  const value = String(password ?? '');
  if (value.length < PASSWORD_MIN_LENGTH) return 'password_too_short';
  if (value.length > PASSWORD_MAX_LENGTH) return 'password_too_long';
  if (!/\p{L}/u.test(value)) return 'password_missing_letter';
  if (!/\p{N}/u.test(value)) return 'password_missing_number';
  if (currentPassword !== null && value === String(currentPassword)) return 'password_same_as_current';
  return null;
}

export function createSessionSecret(record, explicitSecret = '') {
  if (explicitSecret) return String(explicitSecret);
  if (!record?.hash || !record?.salt) return '';
  return [record.hash, record.salt, record.iterations || ITERATIONS, record.digest || DIGEST].join('.');
}

function signSessionPayload(payload, secret) {
  return crypto.createHmac(SESSION_DIGEST, secret).update(payload).digest('base64url');
}

export function createSessionToken({ username, expiresAt }, secret) {
  if (!secret) throw new Error('missing_session_secret');
  const payload = Buffer.from(JSON.stringify({
    username: String(username || ''),
    expiresAt: Number(expiresAt) || Date.now()
  })).toString('base64url');
  return `${payload}.${signSessionPayload(payload, secret)}`;
}

export function verifySessionToken(token, secret) {
  if (!token || !secret) return null;
  const [payload, signature] = String(token).split('.');
  if (!payload || !signature) return null;
  const expected = signSessionPayload(payload, secret);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length) return null;
  if (!crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!parsed?.username || !Number.isFinite(parsed.expiresAt)) return null;
    if (parsed.expiresAt < Date.now()) return null;
    return {
      username: String(parsed.username),
      expiresAt: Number(parsed.expiresAt)
    };
  } catch {
    return null;
  }
}
