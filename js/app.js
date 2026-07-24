function renderGauge(el, {
  value = 0, max = 100, size = 120, stroke = 10,
  color = 'var(--cyan)', label = '', suffix = '', decimals = 0
} = {}){
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  const dash = c * pct;

  el.style.width = size + 'px';
  el.style.height = size + 'px';
  el.innerHTML = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle class="gauge-track" cx="${size/2}" cy="${size/2}" r="${r}" stroke-width="${stroke}"></circle>
      <circle class="gauge-value" cx="${size/2}" cy="${size/2}" r="${r}" stroke-width="${stroke}"
        stroke="${color}" stroke-dasharray="${dash} ${c}"></circle>
    </svg>
    <div class="gauge-center">
      <div class="gauge-num" style="font-size:${size*0.2}px; color:${color}">${value.toFixed(decimals)}${suffix}</div>
      ${label ? `<div class="gauge-label">${label}</div>` : ''}
    </div>`;
}

/** Animates a number counting up — used for hero + KPI readouts. */
function animateCount(el, target, { duration = 1200, prefix = '', suffix = '', decimals = 0 } = {}){
  const start = performance.now();
  const from = 0;
  function tick(now){
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const val = from + (target - from) * eased;
    el.textContent = prefix + val.toFixed(decimals) + suffix;
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/** Lightweight scroll-reveal (stands in for AOS) */
function initReveal(){
  const items = document.querySelectorAll('[data-aos]');
  if (!('IntersectionObserver' in window)){ items.forEach(i=>i.classList.add('aos-in')); return; }
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if (entry.isIntersecting){
        const delay = entry.target.getAttribute('data-aos-delay') || 0;
        setTimeout(()=> entry.target.classList.add('aos-in'), delay);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  items.forEach(i=> io.observe(i));
}

/** Mobile sidebar / nav toggle */
function initMobileNav(){
  const toggle = document.querySelector('[data-nav-toggle]');
  const sidebar = document.querySelector('.sidebar');
  if (toggle && sidebar){
    toggle.addEventListener('click', ()=> sidebar.classList.toggle('open'));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initReveal();
  initMobileNav();
});
