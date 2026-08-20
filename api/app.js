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
    const overlay = `
<style>
/* PRF JUCA • TEMA PERÍCIA FORENSE / NEON LAB */
:root{--forensic-cyan:#00e5ff;--forensic-violet:#8b3dff}
html,body{min-height:100%;background:#020713!important}
body{position:relative;isolation:isolate;overflow-x:hidden}
body::before{content:"";position:fixed;inset:0;z-index:-2;pointer-events:none;background-image:linear-gradient(90deg,rgba(1,7,15,.94) 0%,rgba(1,8,17,.80) 28%,rgba(1,8,17,.58) 55%,rgba(2,4,13,.48) 100%),url('/assets/forensic-lab-bg.svg');background-size:cover;background-position:center right;background-repeat:no-repeat}
body::after{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(circle at 78% 22%,rgba(139,61,255,.13),transparent 27%),radial-gradient(circle at 72% 76%,rgba(0,229,255,.10),transparent 30%),linear-gradient(180deg,rgba(2,7,15,.12),rgba(2,7,15,.34))}
.app{position:relative;z-index:1;background:transparent!important}
.side{background:linear-gradient(180deg,rgba(2,9,18,.96),rgba(3,10,20,.84))!important;border-right-color:rgba(0,229,255,.28)!important;box-shadow:12px 0 50px rgba(0,0,0,.38);backdrop-filter:blur(12px)}
.main{background:transparent!important}
.top h1{text-shadow:0 0 24px rgba(0,229,255,.12)}
.card,.dashboard-modern-card{background:linear-gradient(145deg,rgba(7,18,32,.86),rgba(4,11,22,.74))!important;border-color:rgba(60,111,148,.62)!important;box-shadow:0 18px 45px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.025)!important;backdrop-filter:blur(10px)}
.card:hover{border-color:rgba(0,229,255,.35)!important}
.nav button{background:rgba(7,20,37,.72)!important;backdrop-filter:blur(8px)}
.nav button:hover,.nav button.active{background:linear-gradient(135deg,rgba(15,57,91,.90),rgba(10,35,63,.88))!important}
.progress,.chart,.study-calendar,.month-calendar{background-color:rgba(3,12,23,.62)!important}
.calendar-month-bar,.calendar-head-row,.month-head{background:rgba(10,27,45,.78)!important}
.calendar-cell,.month-cell{background:rgba(6,19,32,.72)!important}
.calendar-cell.weekend,.month-cell.weekend{background:rgba(8,23,39,.76)!important}
#dashboard>.grid:first-child>.card{position:relative;overflow:hidden}
#dashboard>.grid:first-child>.card::after{content:"";position:absolute;right:-45px;top:-55px;width:150px;height:150px;border-radius:50%;background:radial-gradient(circle,rgba(0,229,255,.14),transparent 68%);pointer-events:none}
#prfJucaUserBar{position:fixed;right:18px;top:14px;z-index:9999;display:flex;align-items:center;gap:8px;background:#071321ee;border:1px solid #29455f;border-radius:12px;padding:7px 9px;box-shadow:0 12px 35px #0008;backdrop-filter:blur(10px);font:12px Arial,Segoe UI,sans-serif;color:#dcecff}
#prfJucaUserBar button{border:1px solid #466887;background:#173c62;color:#fff;border-radius:8px;padding:6px 9px;font-weight:800;cursor:pointer}
#prfJucaUserBar button:hover{border-color:#00e5ff}
.app .main{padding-top:78px!important}
@media(max-width:650px){body::before{background-position:68% center}.side{backdrop-filter:blur(14px)}#prfJucaUserBar{top:10px;right:10px;margin:0}.app .main{padding-top:74px!important}}
</style>
<div id="prfJucaUserBar"><span>👤 ${safeName}</span><button id="prfJucaLogout">Sair</button></div>
<script>
(function(){
 const b=document.getElementById('prfJucaLogout');
 if(!b)return;
 b.addEventListener('click',async()=>{b.disabled=true;try{await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});}finally{location.href='/';}});
})();
</script>`;
    html = html.replace('</body>', overlay + '</body>');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (error) {
    console.error(error);
    return res.status(500).send('Não foi possível carregar o PRF JUCA.');
  }
}
