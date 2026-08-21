import crypto from 'node:crypto';
import { get, put } from '@vercel/blob';

const COOKIE = 'prf_juca_session';
const USERS_PATH = 'prf-juca/users.json';
const MAX_AGE = 60 * 60 * 24 * 30;
const ADMIN_EMAIL = 'carlosferrjr@outlook.com.br';

function signingSecret() {
  return process.env.SESSION_SECRET || process.env.BLOB_READ_WRITE_TOKEN || 'prf-juca-development-secret';
}

export function missingConfig() {
  const missing = [];
  if (!process.env.BLOB_READ_WRITE_TOKEN) missing.push('BLOB_READ_WRITE_TOKEN');
  return missing;
}

export function configured() {
  return missingConfig().length === 0;
}

export function isAdmin(user) {
  return String(user?.email || '').trim().toLowerCase() === ADMIN_EMAIL;
}

export function isActive(user) {
  return user?.active !== false;
}

export function decorateUser(user) {
  if (!user) return null;
  return { ...user, role: isAdmin(user) ? 'admin' : 'user', active: isActive(user) };
}

function sign(payload) {
  return crypto.createHmac('sha256', signingSecret()).update(payload).digest('base64url');
}

export function createSession(userId) {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(18).toString('base64url');
  const payload = `${userId}.${timestamp}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

export function setSession(res, token) {
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`);
}

export function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

function readCookie(req) {
  const header = req.headers.cookie || '';
  const match = header.match(new RegExp(`${COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : '';
}

export function sessionUserId(req) {
  const token = readCookie(req);
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [userId, timestamp, nonce, signature] = parts;
  const age = Date.now() - Number(timestamp);
  if (!userId || !nonce || !Number.isFinite(age) || age < 0 || age > MAX_AGE * 1000) return null;
  const payload = `${userId}.${timestamp}.${nonce}`;
  const expected = sign(payload);
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b) ? userId : null;
  } catch {
    return null;
  }
}

async function blobAt(path) {
  const result = await get(path, { access: 'private', token: process.env.BLOB_READ_WRITE_TOKEN });
  if (!result?.stream) return null;
  return JSON.parse(await new Response(result.stream).text());
}

export async function readUsers() {
  try {
    const doc = await blobAt(USERS_PATH);
    if (Array.isArray(doc)) return doc;
    if (Array.isArray(doc?.users)) return doc.users;
  } catch {}
  return [];
}

export async function writeUsers(users) {
  await put(USERS_PATH, JSON.stringify({ version: 2, users }), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 0,
    token: process.env.BLOB_READ_WRITE_TOKEN
  });
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString('base64url')}.${hash.toString('base64url')}`;
}

export function verifyPassword(password, stored) {
  try {
    const [saltText, hashText] = String(stored || '').split('.');
    const salt = Buffer.from(saltText, 'base64url');
    const expected = Buffer.from(hashText, 'base64url');
    const actual = crypto.scryptSync(password, salt, expected.length || 64);
    return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function findUserByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  const users = await readUsers();
  return users.find(u => String(u.email || '').toLowerCase() === normalized) || null;
}

export async function currentUser(req) {
  const userId = sessionUserId(req);
  if (!userId) return null;
  const users = await readUsers();
  const user = users.find(u => u.id === userId) || null;
  if (!user || !isActive(user)) return null;
  return decorateUser(user);
}

export async function requireSession(req, res) {
  if (!configured()) {
    res.status(503).json({ ok: false, code: 'CLOUD_NOT_CONFIGURED', message: `Configure na Vercel: ${missingConfig().join(', ')}.` });
    return null;
  }
  const user = await currentUser(req);
  if (!user) {
    clearSession(res);
    res.status(401).json({ ok: false, code: 'UNAUTHORIZED', message: 'Faça login para continuar.' });
    return null;
  }
  return user;
}

export { USERS_PATH, ADMIN_EMAIL };
