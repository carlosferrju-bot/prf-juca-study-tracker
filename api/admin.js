import { put } from '@vercel/blob';
import { configured, currentUser, readUsers, writeUsers, isAdmin, isActive, isApproved } from './_auth.js';

const EMPTY = {
  version: 3,
  sessions: [], lessons: [], questions: [], simulados: [], disciplines: [], syllabus: [],
  goals: { hours: 10, questions: 200, examDate: '' },
  schedule: { hours: 10, perDay: 1, completed: {} }
};

function publicUser(user) {
  return {
    id: user.id, name: user.name, email: user.email, createdAt: user.createdAt,
    role: isAdmin(user) ? 'admin' : 'user', active: isActive(user), approved: isApproved(user)
  };
}

async function resetUserData(target) {
  const path = `prf-juca/users/${target.id}/database.json`;
  const doc = { schema: 3, ownerId: target.id, revision: 1, updatedAt: new Date().toISOString(), db: structuredClone(EMPTY) };
  await put(path, JSON.stringify(doc), { access:'private', addRandomSuffix:false, allowOverwrite:true, contentType:'application/json', cacheControlMaxAge:0, token:process.env.BLOB_READ_WRITE_TOKEN });
  target.dataPath=path; target.dataInitialized=true; target.dataIsolationVersion=2; target.dataResetAt=doc.updatedAt;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  if (!configured()) return res.status(503).json({ok:false,code:'CLOUD_NOT_CONFIGURED',message:`Configure na Vercel: ${missingConfig().join(', ')}.`});
  const admin=await currentUser(req);
  if (!admin || !isAdmin(admin)) return res.status(403).json({ok:false,code:'ADMIN_ONLY',message:'Acesso restrito ao administrador.'});
  try {
    const users=await readUsers();
    if (req.method==='GET') return res.status(200).json({ok:true,admin:publicUser(admin),users:users.map(publicUser).sort((a,b)=>String(a.name).localeCompare(String(b.name),'pt-BR'))});
    if (req.method==='PUT') {
      const userId=String(req.body?.userId||''), active=req.body?.active, approved=req.body?.approved, resetData=req.body?.resetData===true;
      if (!userId || (typeof active!=='boolean' && typeof approved!=='boolean' && !resetData)) return res.status(400).json({ok:false,message:'Informe o usuário e a alteração desejada.'});
      const target=users.find(u=>u.id===userId);
      if (!target) return res.status(404).json({ok:false,message:'Usuário não encontrado.'});
      if (isAdmin(target)) return res.status(400).json({ok:false,code:'ADMIN_PROTECTED',message:'A conta administradora não pode ser alterada por este painel.'});
      if (resetData) await resetUserData(target);
      if (typeof approved==='boolean') target.approved=approved;
      if (typeof active==='boolean') target.active=active;
      // Liberar pelo painel significa liberar de fato o acesso. Contas pendentes
      // possuem approved:false, então active:true sozinho não era suficiente.
      if (active===true) target.approved=true;
      await writeUsers(users);
      return res.status(200).json({ok:true,resetData,message:resetData?`Os dados de ${target.name} foram zerados.`:(active===true?'Usuário liberado com sucesso.':'Usuário atualizado.'),user:publicUser(target)});
    }
    return res.status(405).json({ok:false,message:'Método não permitido.'});
  } catch(error) { console.error(error); return res.status(500).json({ok:false,message:'Não foi possível gerenciar os usuários.'}); }
}

function missingConfig() { const missing=[]; if(!process.env.BLOB_READ_WRITE_TOKEN) missing.push('BLOB_READ_WRITE_TOKEN'); return missing; }
