import crypto from 'node:crypto';

const COOKIE = 'prf_juca_session';
const MAX_AGE = 60 * 60 * 24 * 30;

function secret() {
  return process.env.SESSION_SECRET || process.env.APP_PASSWORD || '';
}

export function missingConfig() {
  const missing = [];
  if (!process.env.APP_PASSWORD) missing.push('APP_PASSWORD');
  if (!process.env.BLOB_READ_WRITE_TOKEN) missing.push('BLOB_READ_WRITE_TOKEN');
  return missing;
}

export function configured() {
  return missingConfig().length === 0;
}

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function createSession() {
  const payload = `${Date.now()}.${crypto.randomBytes(18).toString('base64url')}`;
  return `${payload}.${sign(payload)}`;
}

export function validSession(req) {
  const header = req.headers.cookie || '';
  const match = header.match(new RegExp(`${COOKIE}=([^;]+)`));
  if (!match) return false;
  const token = decodeURIComponent(match[1]);
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [timestamp, nonce, sig] = parts;
  const payload = `${timestamp}.${nonce}`;
  const age = Date.now() - Number(timestamp);
  if (!Number.isFinite(age) || age < 0 || age > MAX_AGE * 1000) return false;
  const expected = sign(payload);
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function setSession(res, token) {
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`);
}

export function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

export function requireSession(req, res) {
  if (!configured()) {
    res.status(503).json({ ok: false, code: 'CLOUD_NOT_CONFIGURED', message: `Configure na Vercel: ${missingConfig().join(', ')}.` });
    return false;
  }
  if (!validSession(req)) {
    res.status(401).json({ ok: false, code: 'UNAUTHORIZED', message: 'Sessão expirada ou não autenticada.' });
    return false;
  }
  return true;
}
