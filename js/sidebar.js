(function(){
  const page = location.pathname.split('/').pop() || 'dashboard.html';

  const links = [
    { href:'dashboard.html', icon:'fa-gauge-high', label:'Founder Dashboard' },
    { href:'simulator.html', icon:'fa-code-compare', label:'What-If Simulator' },
    { href:'builder.html',   icon:'fa-hammer',       label:'Startup Builder' },
    { href:'investor.html',  icon:'fa-chart-pie',    label:'Investor View' },
  ];

  const html = `
    <a href="index.html" class="brand" style="padding:0 6px 4px;">
      <span class="brand-mark"><i class="fa-solid fa-gauge-high"></i></span> SSAI
    </a>
    <nav class="sidebar-nav">
      ${links.map(l => `
        <a href="${l.href}" class="${page === l.href ? 'active' : ''}">
          <i class="fa-solid ${l.icon}"></i> ${l.label}
        </a>`).join('')}
      <div style="height:1px; background:var(--line); margin:10px 4px;"></div>
      <a href="index.html"><i class="fa-solid fa-arrow-left"></i> Back to Home</a>
    </nav>
    <div class="sidebar-foot">
      <div style="display:flex; align-items:center; gap:10px;">
        <div style="width:30px; height:30px; border-radius:8px; background:var(--cyan-dim); color:var(--cyan); display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-user"></i></div>
        <div>
          <div style="font-size:12.5px; color:var(--text); font-weight:600;">Founder Seat</div>
          <div style="font-size:11px;">Demo workspace</div>
        </div>
      </div>
    </div>
  `;

  const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
  if (sidebar) sidebar.innerHTML = html;
})();
