(() => {
  'use strict';

  const STYLE_ID = 'prf-juca-analytics-style';
  const ROOT_ID = 'prf-juca-analytics';
  let rangeDays = 14;
  let lastSignature = '';

  function esc(v) {
    return String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  }
  function localKey(d) {
    return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
  }
  function fmtMin(min) {
    min = Math.max(0, Number(min)||0);
    const h = Math.floor(min/60), m = min%60;
    return h ? `${h}h ${String(m).padStart(2,'0')}min` : `${m}min`;
  }
  function shortMin(min) {
    min = Math.round(Number(min)||0);
    if (min >= 60) return `${(min/60).toFixed(min%60 ? 1 : 0)}h`;
    return `${min}m`;
  }
  function allStudy() {
    const a = Array.isArray(db?.sessions) ? db.sessions : [];
    const b = Array.isArray(db?.lessons) ? db.lessons : [];
    return [...a, ...b].map(x => ({...x, minutes:Number(x.minutes)||0}));
  }
  function getStats() {
    const study = allStudy();
    const today = new Date(); today.setHours(0,0,0,0);
    const days = [];
    for (let i = rangeDays-1; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate()-i);
      const key = localKey(d);
      const value = study.filter(x => x.date === key).reduce((s,x)=>s+x.minutes,0);
      days.push({key, label:`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`, value});
    }
    const bySubject = {};
    study.forEach(x => { const n=x.subject||'Sem disciplina'; bySubject[n]=(bySubject[n]||0)+x.minutes; });
    const subjects = Object.entries(bySubject).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
    const total = study.reduce((s,x)=>s+x.minutes,0);
    const activeDays = days.filter(x=>x.value>0).length;
    const avg = rangeDays ? total / rangeDays : 0;
    const sessions = Array.isArray(db?.sessions) ? db.sessions.length : 0;
    const lessons = Array.isArray(db?.lessons) ? db.lessons.length : 0;
    const questions = Array.isArray(db?.questions) ? db.questions : [];
    const qTotal = questions.reduce((s,x)=>s+(Number(x.total)||0),0);
    const qCorrect = questions.reduce((s,x)=>s+(Number(x.correct ?? x.acertos ?? x.right ?? 0)||0),0);
    const qPct = qTotal ? Math.round(qCorrect/qTotal*100) : null;
    return {days,subjects,total,activeDays,avg,sessions,lessons,qTotal,qCorrect,qPct};
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style=document.createElement('style'); style.id=STYLE_ID;
    style.textContent=`
      #${ROOT_ID}{margin-top:18px}
      .pj-a-head{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-bottom:14px;flex-wrap:wrap}
      .pj-a-title{font-size:22px;font-weight:950;margin:0}.pj-a-sub{margin:5px 0 0;color:var(--muted);font-size:12px}
      .pj-a-actions{display:flex;gap:6px;flex-wrap:wrap}.pj-a-btn{border:1px solid #31506d;background:#0b1a2c;color:#dbeeff;border-radius:9px;padding:8px 11px;font-weight:900;cursor:pointer}.pj-a-btn.active{background:linear-gradient(135deg,#00b9d4,#2878ff);border-color:var(--cyan);color:#fff}
      .pj-a-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}.pj-a-kpi{background:linear-gradient(145deg,#0c1527f5,#08111ff5);border:1px solid #203957;border-radius:15px;padding:14px}.pj-a-kpi small{color:var(--muted);font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.7px}.pj-a-kpi strong{display:block;font-size:25px;margin-top:5px}.pj-a-kpi span{font-size:10px;color:#7891ab}
      .pj-a-grid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(300px,.85fr);gap:14px}.pj-a-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}.pj-a-panel{background:linear-gradient(145deg,#0c1527f5,#08111ff5);border:1px solid #203957;border-radius:15px;padding:15px;min-width:0}.pj-a-panel h3{font-size:14px;margin:0}.pj-a-panel p{margin:4px 0 10px;color:var(--muted);font-size:10px}
      .pj-a-chart{width:100%;height:260px;display:block}.pj-a-chart text{font-family:Arial,Segoe UI,sans-serif}.pj-a-legend{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px}.pj-a-legend span{font-size:10px;color:#8da3c0}.pj-a-legend b{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;background:var(--cyan)}
      .pj-a-donut-wrap{display:grid;grid-template-columns:170px 1fr;gap:14px;align-items:center;min-height:260px}.pj-a-donut{width:170px;height:170px;border-radius:50%;position:relative}.pj-a-donut:after{content:'';position:absolute;inset:34px;border-radius:50%;background:#091423;border:1px solid #203957}.pj-a-donut-center{position:absolute;inset:0;display:grid;place-items:center;text-align:center;z-index:2}.pj-a-donut-center strong{font-size:20px}.pj-a-donut-center span{font-size:9px;color:var(--muted)}
      .pj-a-subject-list{display:grid;gap:8px}.pj-a-subject-row{display:grid;grid-template-columns:1fr auto;gap:8px}.pj-a-subject-row strong{font-size:10px}.pj-a-subject-row small{color:#7f97b0;font-size:9px}.pj-a-track{height:7px;background:#07111f;border:1px solid #263f5b;border-radius:99px;overflow:hidden;margin-top:4px}.pj-a-track i{display:block;height:100%;background:linear-gradient(90deg,#00b9d4,#2878ff);border-radius:99px}
      .pj-a-table{width:100%;border-collapse:collapse}.pj-a-table td{padding:7px 0;border-bottom:1px solid #203957;font-size:10px}.pj-a-table td:last-child{text-align:right;font-weight:900}.pj-a-insight{padding:10px;border-left:3px solid var(--cyan);background:#0a1b2a;border-radius:8px;font-size:10px;line-height:1.5;color:#c8dbed;margin-top:10px}
      @media(max-width:900px){.pj-a-kpis{grid-template-columns:repeat(2,1fr)}.pj-a-grid,.pj-a-grid2{grid-template-columns:1fr}.pj-a-donut-wrap{grid-template-columns:150px 1fr}.pj-a-donut{width:150px;height:150px}}
      @media(max-width:560px){.pj-a-kpis{grid-template-columns:1fr 1fr}.pj-a-chart{height:230px}.pj-a-donut-wrap{grid-template-columns:1fr}.pj-a-donut{margin:auto}.pj-a-subject-list{margin-top:5px}}
    `;
    document.head.appendChild(style);
  }

  function findStatsView() {
    const btn=[...document.querySelectorAll('.nav button')].find(b => /estat/i.test(b.textContent||''));
    if (!btn) return null;
    const id=btn.dataset.view;
    return id ? document.getElementById(id) : null;
  }

  function svgLine(data) {
    const W=760,H=250,L=46,R=14,T=18,B=38,iw=W-L-R,ih=H-T-B;
    const max=Math.max(60,...data.map(d=>d.value));
    const x=i=>L+(data.length===1?iw/2:i*iw/(data.length-1));
    const y=v=T+ih-(v/max)*ih;
    const path=data.map((d,i)=>`${i?'L':'M'} ${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(' ');
    const grid=[0,.25,.5,.75,1].map(p=>{const yy=T+ih-p*ih;return `<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="#203957" stroke-width="1"/><text x="${L-8}" y="${yy+3}" fill="#6f87a2" font-size="9" text-anchor="end">${shortMin(max*p)}</text>`}).join('');
    const labels=data.map((d,i)=> i%Math.ceil(data.length/7)===0 || i===data.length-1 ? `<text x="${x(i)}" y="${H-12}" fill="#718aa4" font-size="9" text-anchor="middle">${esc(d.label)}</text>`:'').join('');
    const points=data.map((d,i)=>`<circle cx="${x(i)}" cy="${y(d.value)}" r="3.5" fill="var(--cyan)" stroke="#07111f" stroke-width="2"><title>${d.label}: ${fmtMin(d.value)}</title></circle>`).join('');
    return `<svg class="pj-a-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Linha de horas estudadas por dia">${grid}<path d="${path}" fill="none" stroke="var(--cyan)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${points}${labels}</svg>`;
  }

  function svgBars(subjects) {
    const data=subjects.slice(0,8), W=760,H=Math.max(240,data.length*31+30),L=155,R=30,T=18,B=20,iw=W-L-R,max=Math.max(1,...data.map(d=>d.value));
    const rows=data.map((d,i)=>{const y=T+i*31;const w=d.value/max*iw;return `<text x="${L-9}" y="${y+16}" fill="#c7d8e8" font-size="10" text-anchor="end">${esc(d.name).slice(0,24)}</text><rect x="${L}" y="${y+5}" width="${iw}" height="16" rx="6" fill="#0a1726"/><rect x="${L}" y="${y+5}" width="${w}" height="16" rx="6" fill="url(#pjGrad)"/><text x="${Math.min(W-2,L+w+7)}" y="${y+17}" fill="#00e5ff" font-size="9">${fmtMin(d.value)}</text>`}).join('');
    return `<svg class="pj-a-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Horas estudadas por disciplina"><defs><linearGradient id="pjGrad" x1="0" x2="1"><stop offset="0" stop-color="#00b9d4"/><stop offset="1" stop-color="#2878ff"/></linearGradient></defs>${rows||'<text x="20" y="30" fill="#6f87a2" font-size="11">Sem registros de estudo ainda.</text>'}</svg>`;
  }

  function donut(subjects,total) {
    if (!total) return `<div class="pj-a-donut-wrap"><div class="pj-a-donut" style="background:#12243a"></div><div class="pj-a-insight">Ainda não há horas registradas por disciplina. Assim que você registrar estudos, a distribuição aparecerá aqui.</div></div>`;
    let cursor=0; const stops=subjects.slice(0,8).map((d,i)=>{const a=d.value/total*360;const s=`hsl(${185+i*28} 75% ${55-i*2}%)`;const out=`${s} ${cursor}deg ${cursor+a}deg`;cursor+=a;return out}).join(',');
    const legend=subjects.slice(0,8).map((d,i)=>`<div><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:hsl(${185+i*28} 75% ${55-i*2}%);margin-right:6px"></span><b>${esc(d.name)}</b><small> • ${Math.round(d.value/total*100)}%</small></div>`).join('');
    return `<div class="pj-a-donut-wrap"><div class="pj-a-donut" style="background:conic-gradient(${stops})"><div class="pj-a-donut-center"><div><strong>${fmtMin(total)}</strong><br><span>total analisado</span></div></div></div><div class="pj-a-subject-list">${legend}</div></div>`;
  }

  function build(root) {
    const s=getStats();
    const best=s.days.reduce((a,b)=>b.value>a.value?b:a,s.days[0]||{value:0,label:'-' });
    const q=s.qPct==null?'—':`${s.qPct}%`;
    const target=Number(db?.goals?.weeklyHours ?? db?.goals?.weekly ?? db?.goals?.hours ?? 0)*60;
    const currentWeek=s.days.slice(-7).reduce((a,b)=>a+b.value,0);
    const targetPct=target?Math.min(100,Math.round(currentWeek/target*100)):null;
    const sig=JSON.stringify([rangeDays,s.total,s.subjects.map(x=>[x.name,x.value]),s.days.map(x=>x.value),s.qTotal,s.qCorrect,target]);
    if(sig===lastSignature && root.dataset.ready==='1') return;
    lastSignature=sig;
    root.innerHTML=`
      <div class="pj-a-head"><div><h2 class="pj-a-title">Análise de desempenho</h2><p class="pj-a-sub">Gráficos parametrizados diretamente pelos registros do seu estudo.</p></div><div class="pj-a-actions"><button class="pj-a-btn ${rangeDays===7?'active':''}" data-range="7">7 dias</button><button class="pj-a-btn ${rangeDays===14?'active':''}" data-range="14">14 dias</button><button class="pj-a-btn ${rangeDays===30?'active':''}" data-range="30">30 dias</button></div></div>
      <div class="pj-a-kpis">
        <div class="pj-a-kpi"><small>Horas no período</small><strong>${fmtMin(s.total)}</strong><span>${s.activeDays} dias com estudo</span></div>
        <div class="pj-a-kpi"><small>Média diária</small><strong>${fmtMin(Math.round(s.avg))}</strong><span>considerando ${rangeDays} dias</span></div>
        <div class="pj-a-kpi"><small>Melhor dia</small><strong>${shortMin(best.value)}</strong><span>${esc(best.label||'Sem registro')}</span></div>
        <div class="pj-a-kpi"><small>Questões registradas</small><strong>${s.qTotal}</strong><span>${q}${s.qPct==null?' de acerto ainda não calculado':' de acerto'}</span></div>
      </div>
      <div class="pj-a-grid">
        <section class="pj-a-panel"><h3>Ritmo de estudos</h3><p>Minutos estudados por dia no período selecionado.</p>${svgLine(s.days)}<div class="pj-a-legend"><span><b></b>Tempo efetivamente registrado</span></div></section>
        <section class="pj-a-panel"><h3>Distribuição por disciplina</h3><p>Participação de cada disciplina no tempo analisado.</p>${donut(s.subjects,s.total)}</section>
      </div>
      <div class="pj-a-grid2">
        <section class="pj-a-panel"><h3>Ranking de disciplinas</h3><p>Onde seu tempo de estudo está concentrado.</p>${svgBars(s.subjects)}</section>
        <section class="pj-a-panel"><h3>Parâmetros de desempenho</h3><p>Indicadores para acompanhar constância e carga de estudo.</p>
          <table class="pj-a-table"><tr><td>Registros de sessões</td><td>${s.sessions}</td></tr><tr><td>Aulas/conteúdos registrados</td><td>${s.lessons}</td></tr><tr><td>Dias ativos no período</td><td>${s.activeDays}/${rangeDays}</td></tr><tr><td>Questões cadastradas</td><td>${s.qTotal}</td></tr><tr><td>Acertos contabilizados</td><td>${s.qCorrect}</td></tr>${target?`<tr><td>Meta semanal</td><td>${fmtMin(target)}</td></tr><tr><td>Semana atual</td><td>${fmtMin(currentWeek)} (${targetPct}%)</td></tr>`:''}</table>
          <div class="pj-a-insight">${target?`Sua semana está em <b>${targetPct}%</b> da meta configurada. ${targetPct>=100?'Meta atingida.':'Continue aumentando a constância para aproximar-se da meta.'}`:`Ainda não há uma meta semanal de horas identificada nos parâmetros. O painel continuará analisando sua constância real automaticamente.`}</div>
        </section>
      </div>`;
    root.querySelectorAll('[data-range]').forEach(b=>b.addEventListener('click',()=>{rangeDays=Number(b.dataset.range);lastSignature='';build(root)}));
    root.dataset.ready='1';
  }

  function mount() {
    injectStyle();
    const view=findStatsView();
    if(!view) return;
    let root=document.getElementById(ROOT_ID);
    if(!root){root=document.createElement('div');root.id=ROOT_ID;view.appendChild(root);}
    build(root);
  }

  let tries=0;
  const boot=setInterval(()=>{tries++;if(typeof db!=='undefined' && document.querySelector('.nav')){mount();if(tries>20)clearInterval(boot)}else if(tries>80)clearInterval(boot)},300);
  document.addEventListener('click',e=>{if(e.target.closest('.nav button')) setTimeout(mount,30);});
  setInterval(()=>{const root=document.getElementById(ROOT_ID);if(root && root.closest('.view.active')) build(root)},2000);
})();
