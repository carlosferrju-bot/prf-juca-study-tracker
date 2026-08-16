import crypto from 'node:crypto';
import { configured, missingConfig, createSession, setSession, clearSession, currentUser, readUsers, writeUsers, hashPassword, verifyPassword, findUserByEmail } from './_auth.js';

function publicUser(user) {
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
}

function cleanName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

function cleanEmail(value) {
  return String(value || '').trim().toLowerCase().slice(0, 160);
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!configured()) {
    return res.status(503).json({ ok: false, code: 'CLOUD_NOT_CONFIGURED', message: `Configure na Vercel: ${missingConfig().join(', ')}.` });
  }

  try {
    if (req.method === 'GET') {
      const user = await currentUser(req);
      return res.status(200).json({ ok: true, authenticated: !!user, user: publicUser(user) });
    }

    if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Método não permitido.' });

    const action = String(req.body?.action || 'login');

    if (action === 'logout') {
      clearSession(res);
      return res.status(200).json({ ok: true, authenticated: false });
    }

    if (action === 'register') {
      const name = cleanName(req.body?.name);
      const email = cleanEmail(req.body?.email);
      const password = String(req.body?.password || '');

      if (name.length < 2) return res.status(400).json({ ok: false, message: 'Informe seu nome.' });
      if (!validEmail(email)) return res.status(400).json({ ok: false, message: 'Informe um e-mail válido.' });
      if (password.length < 6) return res.status(400).json({ ok: false, message: 'A senha deve ter pelo menos 6 caracteres.' });

      const users = await readUsers();
      if (users.some(u => u.email === email)) {
        return res.status(409).json({ ok: false, code: 'EMAIL_EXISTS', message: 'Este e-mail já possui uma conta. Faça login.' });
      }

      const user = {
        id: crypto.randomUUID(),
        name,
        email,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString(),
        dataPath: users.length === 0 ? 'prf-juca/database.json' : `prf-juca/users/${crypto.randomUUID()}/database.json`
      };

      users.push(user);
      await writeUsers(users);
      setSession(res, createSession(user.id));
      return res.status(201).json({ ok: true, authenticated: true, user: publicUser(user), created: true });
    }

    if (action === 'login') {
      const email = cleanEmail(req.body?.email);
      const password = String(req.body?.password || '');
      const user = await findUserByEmail(email);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        return res.status(401).json({ ok: false, code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos.' });
      }
      setSession(res, createSession(user.id));
      return res.status(200).json({ ok: true, authenticated: true, user: publicUser(user) });
    }

    return res.status(400).json({ ok: false, message: 'Ação de autenticação inválida.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, message: 'Não foi possível concluir a autenticação.' });
  }
}
