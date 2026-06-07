import crypto from 'node:crypto';

const ITERATIONS = 210000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

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

export class SessionManager {
  constructor({ ttlMs = 1000 * 60 * 60 * 24 * 14 } = {}) {
    this.ttlMs = ttlMs;
    this.sessions = new Map();
  }

  create(username) {
    const id = crypto.randomBytes(32).toString('base64url');
    const now = Date.now();
    this.sessions.set(id, {
      username,
      createdAt: now,
      expiresAt: now + this.ttlMs
    });
    return id;
  }

  get(id) {
    if (!id) return null;
    const session = this.sessions.get(id);
    if (!session) return null;
    if (session.expiresAt < Date.now()) {
      this.sessions.delete(id);
      return null;
    }
    session.expiresAt = Date.now() + this.ttlMs;
    return session;
  }

  destroy(id) {
    if (id) this.sessions.delete(id);
  }
}
