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
#prfJucaUserBar{position:fixed;right:18px;top:14px;z-index:9999;display:flex;align-items:center;gap:8px;background:#071321ee;border:1px solid #29455f;border-radius:12px;padding:7px 9px;box-shadow:0 12px 35px #0008;backdrop-filter:blur(10px);font:12px Arial,Segoe UI,sans-serif;color:#dcecff}
#prfJucaUserBar button{border:1px solid #466887;background:#173c62;color:#fff;border-radius:8px;padding:6px 9px;font-weight:800;cursor:pointer}
#prfJucaUserBar button:hover{border-color:#00e5ff}
/* Reserva espaço no conteúdo para que a barra fixa nunca cubra cards ou controles. */
#prfJucaUserBar ~ .app .main{padding-top:78px}
@media(max-width:950px){#prfJucaUserBar ~ .app .main{padding-top:78px}}
@media(max-width:650px){#prfJucaUserBar{position:fixed;top:10px;right:10px;margin:0}#prfJucaUserBar ~ .app .main{padding-top:74px}}
</style>
<div id="prfJucaUserBar"><span>👤 ${safeName}</span><button id="prfJucaLogout">Sair</button></div>
<script>
(function(){
 const b=document.getElementById('prfJucaLogout');
 if(!b)return;
 b.addEventListener('click',async()=>{
   b.disabled=true;
   try{await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});}
   finally{location.href='/';}
 });
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
