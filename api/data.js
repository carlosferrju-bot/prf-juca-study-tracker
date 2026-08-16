import { put, list, get } from '@vercel/blob';
import { requireSession } from './_auth.js';

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
  if (!blob) return { db: null, revision: 0, updatedAt: null };
  const result = await get(blob.pathname, { access: 'private', token: process.env.BLOB_READ_WRITE_TOKEN });
  if (!result?.stream) throw new Error('Não foi possível ler o banco na Vercel Blob.');
  const text = await new Response(result.stream).text();
  const doc = JSON.parse(text);
  return { db: normalize(doc.db || doc), revision: Number(doc.revision) || 1, updatedAt: doc.updatedAt || null };
}

async function writePath(path, db, revision) {
  const doc = {
    schema: 2,
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

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const user = await requireSession(req, res);
  if (!user) return;

  const path = user.dataPath || `prf-juca/users/${user.id}/database.json`;

  try {
    if (req.method === 'GET') {
      let cloud = await readPath(path);

      // A primeira conta preserva automaticamente o banco antigo já existente.
      if (!cloud.db && path !== LEGACY_PATH) {
        const legacy = await readPath(LEGACY_PATH);
        if (legacy.db) {
          cloud = legacy;
          await writePath(path, legacy.db, legacy.revision || 1);
        }
      }

      return res.status(200).json({ ok: true, ...cloud, user: { id: user.id, name: user.name, email: user.email } });
    }

    if (req.method === 'PUT') {
      const current = await readPath(path);
      const baseRevision = Number(req.body?.baseRevision) || 0;
      const db = normalize(req.body?.db);
      if (!req.body?.db || typeof req.body.db !== 'object') return res.status(400).json({ ok: false, message: 'Banco inválido.' });
      if (current.revision && baseRevision && baseRevision !== current.revision) {
        return res.status(409).json({ ok: false, code: 'REVISION_CONFLICT', ...current });
      }
      const nextRevision = Math.max(current.revision || 0, baseRevision || 0) + 1;
      const saved = await writePath(path, db, nextRevision);
      return res.status(200).json({ ok: true, ...saved });
    }

    return res.status(405).json({ ok: false, message: 'Método não permitido.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, message: 'Erro ao acessar o banco online.', detail: String(error?.message || error) });
  }
}
