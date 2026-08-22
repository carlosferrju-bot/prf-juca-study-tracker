import { put } from '@vercel/blob';
import { configured, currentUser, readUsers, writeUsers, readAccess, writeAccess, applyAccess, isAdmin, isActive, isApproved } from './_auth.js';

const EMPTY={version:3,sessions:[],lessons:[],questions:[],simulados:[],disciplines:[],syllabus:[],goals:{hours:10,questions:200,examDate:''},schedule:{hours:10,perDay:1,completed:{}}};

function publicUser(user){return{id:user.id,name:user.name,email:user.email,createdAt:user.createdAt,role:isAdmin(user)?'admin':'user',active:isActive(user),approved:isApproved(user)};}

async function resetUserData(target){const path=`prf-juca/users/${target.id}/database.json`;const doc={schema:3,ownerId:target.id,revision:1,updatedAt:new Date().toISOString(),db:structuredClone(EMPTY)};await put(path,JSON.stringify(doc),{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json',cacheControlMaxAge:0,token:process.env.BLOB_READ_WRITE_TOKEN});target.dataPath=path;target.dataInitialized=true;target.dataIsolationVersion=2;target.dataResetAt=doc.updatedAt;}

async function userForPanel(user){return applyAccess(user,await readAccess(user.id));}
async function listUsersForPanel(users){const out=[];for(const user of users)out.push(publicUser(await userForPanel(user)));return out;}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, max-age=0');
  if(!configured())return res.status(503).json({ok:false,code:'CLOUD_NOT_CONFIGURED',message:'O armazenamento do PRF JUCA não está configurado.'});
  const admin=await currentUser(req);
  if(!admin||!isAdmin(admin))return res.status(403).json({ok:false,code:'ADMIN_ONLY',message:'Acesso restrito ao administrador.'});
  try{
    const users=await readUsers();
    if(req.method==='GET')return res.status(200).json({ok:true,admin:publicUser(admin),users:(await listUsersForPanel(users)).sort((a,b)=>String(a.name).localeCompare(String(b.name),'pt-BR'))});
    if(req.method!=='PUT')return res.status(405).json({ok:false,message:'Método não permitido.'});

    const userId=String(req.body?.userId||'');
    const requestedActive=req.body?.active;
    const requestedApproved=req.body?.approved;
    const resetData=req.body?.resetData===true;
    if(!userId||(typeof requestedActive!=='boolean'&&typeof requestedApproved!=='boolean'&&!resetData))return res.status(400).json({ok:false,message:'Informe o usuário e a alteração desejada.'});
    const target=users.find(u=>u.id===userId);
    if(!target)return res.status(404).json({ok:false,message:'Usuário não encontrado.'});
    if(isAdmin(target))return res.status(400).json({ok:false,code:'ADMIN_PROTECTED',message:'A conta administradora não pode ser alterada por este painel.'});

    if(resetData){await resetUserData(target);await writeUsers(users);return res.status(200).json({ok:true,resetData:true,message:`Os dados de ${target.name} foram zerados.`,user:publicUser(await userForPanel(target))});}

    // Access is stored in a per-user Blob document. This avoids lost updates caused
    // by two admin requests reading/writing the shared users.json concurrently.
    const current=await userForPanel(target);
    let desiredActive=typeof requestedActive==='boolean'?requestedActive:isActive(current);
    let desiredApproved=typeof requestedApproved==='boolean'?requestedApproved:isApproved(current);
    if(desiredActive===true){desiredActive=true;desiredApproved=true;}
    if(desiredActive===false){desiredActive=false;desiredApproved=true;}

    const savedAccess=await writeAccess(target.id,{active:desiredActive,approved:desiredApproved});
    const verify=await readAccess(target.id);
    if(!verify||verify.active!==desiredActive||verify.approved!==desiredApproved)throw new Error('A alteração de acesso não foi confirmada no armazenamento.');

    // Keep the legacy user record synchronized too, but the access document above is
    // authoritative for login and the admin panel.
    target.active=desiredActive;target.approved=desiredApproved;
    try{await writeUsers(users);}catch(error){console.warn('[PRF JUCA ADMIN] users.json sync failed:',error?.message||error);}

    const saved=applyAccess(target,verify);
    return res.status(200).json({ok:true,resetData:false,message:desiredActive?`Usuário ${target.name} liberado com sucesso.`:`Usuário ${target.name} suspenso com sucesso.`,user:publicUser(saved)});
  }catch(error){console.error('[PRF JUCA ADMIN]',error);return res.status(500).json({ok:false,code:'ADMIN_UPDATE_FAILED',message:error?.message||'Não foi possível gerenciar os usuários.'});}
}
