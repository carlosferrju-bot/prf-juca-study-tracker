import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configured, currentUser } from './_auth.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!configured()) return res.status(503).send('O armazenamento do PRF JUCA ainda não está configurado na Vercel.');

  const user = await currentUser(req);
  if (!user) return res.redirect(302, '/');

  try {
    let html = await fs.readFile(path.join(root, 'index.html'), 'utf8');
    const safeName = String(user.name).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
    const adminOverlay = user.role === 'admin' ? `
<style>
#prfJucaAdminBtn{border-color:#8b3dff!important;background:linear-gradient(135deg,#5120a8,#243d9a)!important}
#prfJucaAdminModal{position:fixed;inset:0;z-index:10000;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.72);backdrop-filter:blur(8px);padding:20px}
#prfJucaAdminModal.open{display:flex}
#prfJucaAdminPanel{width:min(920px,96vw);max-height:86vh;overflow:auto;background:linear-gradient(145deg,#071525,#0b1326);border:1px solid #35506f;border-radius:18px;box-shadow:0 30px 90px #000b;padding:22px;color:#eef8ff}
#prfJucaAdminPanel h2{margin:0;font-size:22px}.prf-admin-sub{color:#8da3c0;margin:5px 0 18px}
.prf-admin-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}.prf-admin-stat{padding:13px;border:1px solid #263f5b;border-radius:12px;background:#081321}.prf-admin-stat b{display:block;font-size:22px}.prf-admin-stat span{font-size:11px;color:#8da3c0}
.prf-admin-table{width:100%;border-collapse:collapse}.prf-admin-table th,.prf-admin-table td{padding:11px 9px;border-bottom:1px solid #203957;text-align:left;vertical-align:middle}.prf-admin-table th{font-size:10px;color:#7f9bb5;text-transform:uppercase;letter-spacing:.7px}.prf-admin-pill{display:inline-flex;padding:4px 8px;border-radius:99px;font-size:10px;font-weight:900}.prf-admin-pill.active{background:#00f5a014;color:#00f5a0}.prf-admin-pill.blocked{background:#ff4d6d18;color:#ff7891}.prf-admin-pill.admin{background:#8b3dff18;color:#c5a5ff}
.prf-admin-action{border:1px solid #466887;background:#173c62;color:#fff;border-radius:8px;padding:7px 10px;font-weight:900;cursor:pointer}.prf-admin-action.block{background:#6f1f35;border-color:#ff7891}.prf-admin-action.unblock{background:#164f49;border-color:#00f5a0}.prf-admin-action.reset{background:#5b4315;border-color:#f6c453}.prf-admin-action:disabled{opacity:.55;cursor:not-allowed}
#prfJucaAdminClose{float:right;border:1px solid #466887;background:#111f31;color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer;font-weight:900}
@media(max-width:650px){.prf-admin-stats{grid-template-columns:1fr}.prf-admin-table th:nth-child(3),.prf-admin-table td:nth-child(3){display:none}.prf-admin-action{padding:8px 7px;font-size:11px}}
</style>
<div id="prfJucaAdminModal" aria-hidden="true">
  <div id="prfJucaAdminPanel">
    <button id="prfJucaAdminClose">Fechar</button>
    <h2>🛡️ Administração de usuários</h2>
    <div class="prf-admin-sub">Gerencie as contas que utilizam o PRF JUCA. Suspensão e limpeza de dados são ações independentes.</div>
    <div class="prf-admin-stats">
      <div class="prf-admin-stat"><b id="prfAdminTotal">—</b><span>Usuários cadastrados</span></div>
      <div class="prf-admin-stat"><b id="prfAdminActive">—</b><span>Contas liberadas</span></div>
      <div class="prf-admin-stat"><b id="prfAdminBlocked">—</b><span>Contas restringidas</span></div>
    </div>
    <div id="prfAdminStatus" class="prf-admin-sub">Carregando...</div>
    <div style="overflow:auto"><table class="prf-admin-table"><thead><tr><th>Usuário</th><th>E-mail</th><th>Cadastro</th><th>Status</th><th>Ações</th></tr></thead><tbody id="prfAdminUsers"></tbody></table></div>
  </div>
</div>
<script>
(function(){
  const modal=document.getElementById('prfJucaAdminModal');
  const close=document.getElementById('prfJucaAdminClose');
  const body=document.getElementById('prfAdminUsers');
  const status=document.getElementById('prfAdminStatus');
  const total=document.getElementById('prfAdminTotal');
  const active=document.getElementById('prfAdminActive');
  const blocked=document.getElementById('prfAdminBlocked');
  function esc(v){return String(v??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));}
  function render(users){
    total.textContent=users.length; active.textContent=users.filter(u=>u.active).length; blocked.textContent=users.filter(u=>!u.active).length;
    body.innerHTML=users.map(u=>{
      const admin=u.role==='admin', on=u.active, date=u.createdAt?new Date(u.createdAt).toLocaleDateString('pt-BR'):'—';
      return '<tr><td><strong>'+esc(u.name)+'</strong>'+(admin?' <span class="prf-admin-pill admin">ADMIN</span>':'')+'</td><td>'+esc(u.email)+'</td><td>'+date+'</td><td><span class="prf-admin-pill '+(on?'active':'blocked')+'">'+(on?'LIBERADO':'RESTRINGIDO')+'</span></td><td style="white-space:nowrap"><button class="prf-admin-action '+(on?'block':'unblock')+'" data-action="toggle" data-id="'+esc(u.id)+'" '+(admin?'disabled':'')+'>'+ (admin?'Protegido':(on?'Suspender':'Liberar')) +'</button> <button class="prf-admin-action reset" data-action="reset" data-id="'+esc(u.id)+'" '+(admin?'disabled':'')+'>Limpar dados</button></td></tr>';
    }).join('') || '<tr><td colspan="5">Nenhum usuário cadastrado.</td></tr>';
  }
  async function load(){status.textContent='Atualizando lista...';try{const r=await fetch('/api/admin',{cache:'no-store'}),d=await r.json();if(!r.ok)throw new Error(d.message||'Falha ao carregar usuários.');render(d.users||[]);status.textContent='Lista atualizada agora.';}catch(e){status.textContent=e.message||'Não foi possível carregar os usuários.';}}
  body.addEventListener('click',async e=>{
    const b=e.target.closest('button[data-id]'); if(!b)return;
    const id=b.dataset.id, action=b.dataset.action;
    if(action==='reset' && !confirm('ATENÇÃO: todos os dados de estudo desta conta serão apagados. A conta, login e cadastro permanecerão. Deseja continuar?'))return;
    b.disabled=true;
    try{
      const payload=action==='reset'?{userId:id,resetData:true}:{userId:id,active:b.classList.contains('block')?false:true};
      const r=await fetch('/api/admin',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),d=await r.json();
      if(!r.ok)throw new Error(d.message||'Não foi possível concluir a operação.');
      await load();
      if(action==='reset')alert(d.message||'Dados zerados com sucesso.');
    }catch(e){alert(e.message||'Erro ao executar a operação.');b.disabled=false;}
  });
  window.prfJucaOpenAdmin=()=>{modal.classList.add('open');modal.setAttribute('aria-hidden','false');load();};
  close.addEventListener('click',()=>{modal.classList.remove('open');modal.setAttribute('aria-hidden','true');});
  modal.addEventListener('click',e=>{if(e.target===modal)close.click();});
})();
</script>` : '';

    const adminButton = user.role === 'admin' ? '<button id="prfJucaAdminBtn">🛡️ Usuários</button>' : '';
    const overlay = `
<style>
/* PRF JUCA • TEMA PERÍCIA FORENSE / NEON LAB */
:root{--forensic-cyan:#00e5ff;--forensic-violet:#8b3dff}
html,body{min-height:100%;background:#020713!important}
body{position:relative;isolation:isolate;overflow-x:hidden}
body::before{content:"";position:fixed;inset:0;z-index:-2;pointer-events:none;background-image:linear-gradient(90deg,rgba(1,7,15,.94) 0%,rgba(1,8,17,.80) 28%,rgba(1,8,17,.58) 55%,rgba(2,4,13,.48) 100%),url('/assets/forensic-lab-bg.svg');background-size:cover;background-position:center right;background-repeat:no-repeat}
body::after{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(circle at 78% 22%,rgba(139,61,255,.13),transparent 27%),radial-gradient(circle at 72% 76%,rgba(0,229,255,.10),transparent 30%),linear-gradient(180deg,rgba(2,7,15,.12),rgba(2,7,15,.34))}
.app{position:relative;z-index:1;background:transparent!important}.side{background:linear-gradient(180deg,rgba(2,9,18,.96),rgba(3,10,20,.84))!important;border-right-color:rgba(0,229,255,.28)!important;box-shadow:12px 0 50px rgba(0,0,0,.38);backdrop-filter:blur(12px)}.main{background:transparent!important}.top h1{text-shadow:0 0 24px rgba(0,229,255,.12)}.card,.dashboard-modern-card{background:linear-gradient(145deg,rgba(7,18,32,.86),rgba(4,11,22,.74))!important;border-color:rgba(60,111,148,.62)!important;box-shadow:0 18px 45px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.025)!important;backdrop-filter:blur(10px)}.card:hover{border-color:rgba(0,229,255,.35)!important}.nav button{background:rgba(7,20,37,.72)!important;backdrop-filter:blur(8px)}.nav button:hover,.nav button.active{background:linear-gradient(135deg,rgba(15,57,91,.90),rgba(10,35,63,.88))!important}.progress,.chart,.study-calendar,.month-calendar{background-color:rgba(3,12,23,.62)!important}.calendar-month-bar,.calendar-head-row,.month-head{background:rgba(10,27,45,.78)!important}.calendar-cell,.month-cell{background:rgba(6,19,32,.72)!important}.calendar-cell.weekend,.month-cell.weekend{background:rgba(8,23,39,.76)!important}#dashboard>.grid:first-child>.card{position:relative;overflow:hidden}#dashboard>.grid:first-child>.card::after{content:"";position:absolute;right:-45px;top:-55px;width:150px;height:150px;border-radius:50%;background:radial-gradient(circle,rgba(0,229,255,.14),transparent 68%);pointer-events:none}#prfJucaUserBar{position:fixed;right:18px;top:14px;z-index:9999;display:flex;align-items:center;gap:8px;background:#071321ee;border:1px solid #29455f;border-radius:12px;padding:7px 9px;box-shadow:0 12px 35px rgba(0,0,0,.53);backdrop-filter:blur(10px);font:12px Arial,Segoe UI,sans-serif;color:#dcecff}#prfJucaUserBar button{border:1px solid #466887;background:#173c62;color:#fff;border-radius:8px;padding:6px 9px;font-weight:800;cursor:pointer}#prfJucaUserBar button:hover{border-color:#00e5ff}.app .main{padding-top:78px!important}@media(max-width:650px){body::before{background-position:68% center}.side{backdrop-filter:blur(14px)}#prfJucaUserBar{top:10px;right:10px;margin:0}.app .main{padding-top:74px!important}}
</style>
<div id="prfJucaUserBar"><span>${user.role==='admin'?'🛡️':''} 👤 ${safeName}</span>${adminButton}<button id="prfJucaLogout">Sair</button></div>
${adminOverlay}
<script>
(function(){const b=document.getElementById('prfJucaLogout'),a=document.getElementById('prfJucaAdminBtn');if(a)a.addEventListener('click',()=>window.prfJucaOpenAdmin&&window.prfJucaOpenAdmin());if(!b)return;b.addEventListener('click',async()=>{b.disabled=true;try{await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});}finally{location.href='/';}});})();
</script>`;
    html = html.replace('</body>', overlay + '</body>');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (error) { console.error(error); return res.status(500).send('Não foi possível carregar o PRF JUCA.'); }
}
