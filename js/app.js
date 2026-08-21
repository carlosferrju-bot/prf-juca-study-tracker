/* PRF JUCA — background integration */
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
  `;
  const style = document.createElement('style');
  style.id = 'prf-juca-forensic-background';
  style.textContent = css;
  document.head.appendChild(style);
  console.log('PRF JUCA Study Tracker — forensic background aplicado.');
})();
