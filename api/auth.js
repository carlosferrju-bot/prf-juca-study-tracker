import { configured, missingConfig, createSession, setSession, clearSession, validSession } from './_auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    return res.status(200).json({ configured: configured(), authenticated: configured() && validSession(req), missing: missingConfig() });
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Método não permitido.' });
  if (!configured()) return res.status(503).json({ ok: false, code: 'CLOUD_NOT_CONFIGURED', message: `Configure na Vercel: ${missingConfig().join(', ')}.` });

  const action = req.body?.action || 'login';
  if (action === 'logout') {
    clearSession(res);
    return res.status(200).json({ ok: true, authenticated: false });
  }

  const password = String(req.body?.password || '');
  if (!password || password !== process.env.APP_PASSWORD) {
    return res.status(401).json({ ok: false, message: 'Senha incorreta.' });
  }
  setSession(res, createSession());
  return res.status(200).json({ ok: true, authenticated: true });
}
