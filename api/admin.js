import { configured, currentUser, readUsers, writeUsers, isAdmin, isActive, isApproved } from './_auth.js';

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    role: isAdmin(user) ? 'admin' : 'user',
    active: isActive(user),
    approved: isApproved(user)
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!configured()) {
    return res.status(503).json({ ok: false, code: 'CLOUD_NOT_CONFIGURED', message: `Configure na Vercel: ${missingConfig().join(', ')}.` });
  }

  const admin = await currentUser(req);
  if (!admin || !isAdmin(admin)) {
    return res.status(403).json({ ok: false, code: 'ADMIN_ONLY', message: 'Acesso restrito ao administrador.' });
  }

  try {
    const users = await readUsers();

    if (req.method === 'GET') {
      return res.status(200).json({
        ok: true,
        admin: publicUser(admin),
        users: users.map(publicUser).sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'))
      });
    }

    if (req.method === 'PUT') {
      const userId = String(req.body?.userId || '');
      const active = req.body?.active;
      const approved = req.body?.approved;
      if (!userId || (typeof active !== 'boolean' && typeof approved !== 'boolean')) {
        return res.status(400).json({ ok: false, message: 'Informe o usuário e a alteração desejada.' });
      }

      const target = users.find(u => u.id === userId);
      if (!target) return res.status(404).json({ ok: false, message: 'Usuário não encontrado.' });
      if (isAdmin(target)) {
        return res.status(400).json({ ok: false, code: 'ADMIN_PROTECTED', message: 'A conta administradora não pode ser alterada por este painel.' });
      }

      if (typeof approved === 'boolean') {
        target.approved = approved;
        if (approved === true) {
          target.active = true;
          // Force a clean initialization on the first access after approval.
          // Existing/corrupted data is never carried into the approved account.
          target.dataInitialized = false;
          target.dataPath = `prf-juca/users/${target.id}/database.json`;
        }
      }

      if (typeof active === 'boolean') target.active = active;

      await writeUsers(users);
      return res.status(200).json({ ok: true, user: publicUser(target) });
    }

    return res.status(405).json({ ok: false, message: 'Método não permitido.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, message: 'Não foi possível gerenciar os usuários.' });
  }
}

function missingConfig() {
  const missing = [];
  if (!process.env.BLOB_READ_WRITE_TOKEN) missing.push('BLOB_READ_WRITE_TOKEN');
  return missing;
}
