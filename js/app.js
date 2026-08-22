/* PRF JUCA — background + administrator data controls */
(function(){
  const css = `
    html, body { min-height:100%; }
    body {
      background-image: url('/forensic-bg.svg') !important;
      background-repeat: no-repeat !important;
      background-position: center center !important;
      background-size: cover !important;
      background-attachment: fixed !important;
      background-color: #020711 !important;
      position: relative !important;
    }
    body::before {
      content: '' !important;
      position: fixed !important;
      inset: 0 !important;
      pointer-events: none !important;
      z-index: 0 !important;
      background: linear-gradient(90deg, rgba(0,4,12,.70) 0%, rgba(0,5,14,.38) 38%, rgba(0,4,12,.24) 100%) !important;
    }
    .app { position: relative !important; z-index: 1 !important; }
    .side { background: rgba(2,9,20,.68) !important; backdrop-filter: blur(8px) !important; -webkit-backdrop-filter: blur(8px) !important; }
    .main { position: relative !important; }
    .card { background: linear-gradient(145deg, rgba(7,18,35,.60), rgba(5,12,27,.48)) !important; backdrop-filter: blur(5px) !important; -webkit-backdrop-filter: blur(5px) !important; }
    .top { background: rgba(2,9,20,.22) !important; backdrop-filter: blur(4px) !important; -webkit-backdrop-filter: blur(4px) !important; }
    .prf-admin-reset-btn { margin-left:8px !important; border:1px solid #ff8a9f !important; background:#5d1730 !important; color:#fff !important; border-radius:8px !important; padding:7px 10px !important; font-size:11px !important; font-weight:900 !important; cursor:pointer !important; white-space:nowrap !important; }
    .prf-admin-reset-btn:hover { filter:brightness(1.15) !important; box-shadow:0 0 14px rgba(255,77,109,.25) !important; }
    .prf-admin-reset-btn:disabled { opacity:.55 !important; cursor:wait !important; }
  `;
  const style = document.createElement('style');
  style.id = 'prf-juca-forensic-background';
  style.textContent = css;
  document.head.appendChild(style);
  console.log('PRF JUCA Study Tracker — background aplicado.');

  async function adminUsers(){
    const r = await fetch('/api/admin', { credentials:'same-origin', cache:'no-store' });
    if(!r.ok) return null;
    return await r.json();
  }

  function findUserRow(email){
    const candidates = [...document.querySelectorAll('tr')];
    return candidates.find(row => String(row.textContent || '').toLowerCase().includes(String(email).toLowerCase())) || null;
  }

  function addResetButtons(payload){
    if(!payload?.users) return;
    payload.users.filter(u => u.role !== 'admin').forEach(user => {
      const row = findUserRow(user.email);
      if(!row || row.querySelector('.prf-admin-reset-btn')) return;
      const cell = row.querySelector('td:last-child') || row;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'prf-admin-reset-btn';
      button.textContent = 'Zerar dados';
      button.title = `Zerar todos os dados da conta ${user.name}`;
      button.addEventListener('click', async () => {
        const ok = window.confirm(`ATENÇÃO\n\nVocê está prestes a zerar TODOS os dados da conta de ${user.name}.\n\nSerão apagados cronograma, disciplinas, sessões, questões, simulados, edital e demais dados pessoais dessa conta.\n\nEssa ação não apaga a conta e NÃO afeta outras contas.\n\nDeseja continuar?`);
        if(!ok) return;
        button.disabled = true;
        button.textContent = 'Zerando...';
        try{
          const r = await fetch('/api/admin', {
            method:'PUT',
            credentials:'same-origin',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({ userId:user.id, resetData:true })
          });
          const data = await r.json().catch(() => ({}));
          if(!r.ok) throw new Error(data.message || 'Não foi possível zerar os dados.');
          window.alert(data.message || 'Dados zerados com sucesso.');
          window.location.reload();
        }catch(error){
          window.alert(error.message || 'Não foi possível zerar os dados.');
          button.disabled = false;
          button.textContent = 'Zerar dados';
        }
      });
      cell.appendChild(button);
    });
  }

  let adminScanTimer = null;
  async function scanAdminPanel(){
    const text = String(document.body?.innerText || '').toLowerCase();
    if(!text.includes('administração de usuários') && !text.includes('usuários cadastrados')) return;
    try{
      const payload = await adminUsers();
      addResetButtons(payload);
    }catch(error){
      console.warn('PRF JUCA admin reset controls:', error);
    }
  }

  const observer = new MutationObserver(() => {
    clearTimeout(adminScanTimer);
    adminScanTimer = setTimeout(scanAdminPanel, 150);
  });
  observer.observe(document.documentElement, {childList:true, subtree:true});
  setTimeout(scanAdminPanel, 500);
})();
