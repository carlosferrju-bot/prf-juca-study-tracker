import { put, list, get } from '@vercel/blob';
import { requireSession, isAdmin, readUsers, writeUsers } from './_auth.js';

const LEGACY_PATH = 'prf-juca/database.json';
const EMPTY = {
  version: 3,
  sessions: [], lessons: [], questions: [], simulados: [], disciplines: [], syllabus: [],
  goals: { hours: 10, questions: 200, examDate: '' },
  schedule: { hours: 10, perDay: 1, completed: {} }
};

function normalize(d) {
  if (!d || typeof d !== 'object') return structuredClone(EMPTY);
  const out = { ...structuredClone(EMPTY), ...d };
  for (const k of ['sessions','lessons','questions','simulados','disciplines','syllabus']) if (!Array.isArray(out[k])) out[k] = [];
  if (!out.goals || typeof out.goals !== 'object') out.goals = structuredClone(EMPTY.goals);
  if (!out.schedule || typeof out.schedule !== 'object') out.schedule = structuredClone(EMPTY.schedule);
  if (!out.schedule.completed || typeof out.schedule.completed !== 'object' || Array.isArray(out.schedule.completed)) out.schedule.completed = {};
  out.version = 3;
  return out;
}

async function findBlob(path) {
  const result = await list({ prefix: path, limit: 20, token: process.env.BLOB_READ_WRITE_TOKEN });
  return result.blobs.find(b => b.pathname === path || b.pathname.startsWith(path + '-')) || null;
}

async function readPath(path) {
  const blob = await findBlob(path);
  if (!blob) return { db: null, revision: 0, updatedAt: null, ownerId: null };
  const result = await get(blob.pathname, { access: 'private', token: process.env.BLOB_READ_WRITE_TOKEN });
  if (!result?.stream) throw new Error('Não foi possível ler o banco na Vercel Blob.');
  const text = await new Response(result.stream).text();
  const doc = JSON.parse(text);
  return {
    db: normalize(doc.db || doc),
    revision: Number(doc.revision) || 1,
    updatedAt: doc.updatedAt || null,
    ownerId: doc.ownerId || null
  };
}

async function writePath(path, db, revision, ownerId) {
  const doc = {
    schema: 3,
    ownerId,
    revision,
    updatedAt: new Date().toISOString(),
    db: normalize(db)
  };
  const result = await put(path, JSON.stringify(doc), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 0,
    token: process.env.BLOB_READ_WRITE_TOKEN
  });
  return { revision, updatedAt: doc.updatedAt, url: result.url };
}

async function initializeUserDatabase(user, path) {
  // Every non-admin account gets a completely fresh database exactly once.
  // This also repairs accounts created before the isolation fix whose database
  // may have been initialized from the administrator's legacy data.
  const users = await readUsers();
  const target = users.find(u => u.id === user.id);
  if (!target || isAdmin(target) || target.dataInitialized === true) return false;

  await writePath(path, EMPTY, 1, user.id);
  target.dataPath = path;
  target.dataInitialized = true;
  target.dataResetAt = new Date().toISOString();
  await writeUsers(users);
  return true;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const user = await requireSession(req, res);
  if (!user) return;

  // The administrator may keep the historical database. Every other account
  // is forced onto its own immutable namespace based on its user id.
  const path = isAdmin(user)
    ? (user.dataPath || LEGACY_PATH)
    : `prf-juca/users/${user.id}/database.json`;

  try {
    // New/repaired user accounts are initialized with EMPTY before any read.
    // Therefore no records, disciplines, schedule, questions, etc. can leak
    // from the administrator or another account.
    if (!isAdmin(user)) {
      await initializeUserDatabase(user, path);
    }

    if (req.method === 'GET') {
      const cloud = await readPath(path);

      if (cloud.ownerId && cloud.ownerId !== user.id) {
        return res.status(403).json({ ok: false, code: 'DATA_OWNER_MISMATCH', message: 'Os dados deste armazenamento pertencem a outra conta.' });
      }

      if (cloud.db && !cloud.ownerId) {
        if (!isAdmin(user)) {
          // Never adopt an unowned/legacy database for a normal user.
          await writePath(path, EMPTY, 1, user.id);
          return res.status(200).json({ ok: true, db: normalize(EMPTY), revision: 1, updatedAt: new Date().toISOString(), ownerId: user.id, user: { id: user.id, name: user.name, email: user.email } });
        }
        await writePath(path, cloud.db, cloud.revision || 1, user.id);
        cloud.ownerId = user.id;
      }

      return res.status(200).json({ ok: true, ...cloud, user: { id: user.id, name: user.name, email: user.email } });
    }

    if (req.method === 'PUT') {
      const current = await readPath(path);
      const baseRevision = Number(req.body?.baseRevision) || 0;
      const db = normalize(req.body?.db);
      if (!req.body?.db || typeof req.body.db !== 'object') return res.status(400).json({ ok: false, message: 'Banco inválido.' });

      if (current.ownerId && current.ownerId !== user.id) {
        return res.status(403).json({ ok: false, code: 'DATA_OWNER_MISMATCH', message: 'Os dados deste armazenamento pertencem a outra conta.' });
      }

      if (current.revision && baseRevision && baseRevision !== current.revision) {
        return res.status(409).json({ ok: false, code: 'REVISION_CONFLICT', ...current });
      }

      const nextRevision = Math.max(current.revision || 0, baseRevision || 0) + 1;
      const saved = await writePath(path, db, nextRevision, user.id);
      return res.status(200).json({ ok: true, ...saved, ownerId: user.id });
    }

    return res.status(405).json({ ok: false, message: 'Método não permitido.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, message: 'Erro ao acessar o banco online.', detail: String(error?.message || error) });
  }
}
