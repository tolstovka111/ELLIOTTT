/* ============================================================
   Общая логика: тема, появление при скролле, магнитные кнопки
   ============================================================ */

(() => {
  /* ---------- тема ---------- */
  const root = document.documentElement;
  const saved = localStorage.getItem('elliott-theme');
  if (saved === 'light') root.dataset.theme = 'light';

  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const light = root.dataset.theme === 'light';
      if (light) delete root.dataset.theme;
      else root.dataset.theme = 'light';
      localStorage.setItem('elliott-theme', light ? 'dark' : 'light');
    });
  }

  /* ---------- появление при скролле ---------- */
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    }
  }, { threshold: .12 });

  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

  /* ---------- магнитные кнопки ---------- */
  const fine = matchMedia('(pointer: fine)').matches;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (fine && !reduced) {
    document.querySelectorAll('.magnetic').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - r.left - r.width / 2;
        const dy = e.clientY - r.top - r.height / 2;
        el.style.transform = `translate(${dx * .18}px, ${dy * .3}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ---------- год в подвале ---------- */
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
