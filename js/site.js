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

  /* ---------- анимация печати ---------- */
  const noMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function typeEl(el) {
    const speed = +el.dataset.typeSpeed || 30;
    // собираем все текстовые узлы (включая вложенные span с градиентом)
    const nodes = [];
    (function walk(n) {
      n.childNodes.forEach((c) => {
        if (c.nodeType === 3) nodes.push(c);
        else walk(c);
      });
    })(el);
    const full = nodes.map((n) => n.nodeValue.replace(/\s+/g, ' '));
    // фиксируем высоту, чтобы страница не прыгала
    el.style.minHeight = el.offsetHeight + 'px';
    nodes.forEach((n) => { n.nodeValue = ''; });
    el.classList.add('is-typing');

    let ni = 0, ci = 0;
    const timer = setInterval(() => {
      while (ni < nodes.length && full[ni].length === 0) ni++;
      if (ni >= nodes.length) {
        clearInterval(timer);
        el.classList.remove('is-typing');
        el.classList.add('is-typed');
        return;
      }
      ci++;
      nodes[ni].nodeValue = full[ni].slice(0, ci);
      if (ci >= full[ni].length) { ni++; ci = 0; }
    }, speed);
  }

  if (noMotion) {
    document.querySelectorAll('.type').forEach((el) => el.classList.add('is-typed'));
  } else {
    const typeIO = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          typeIO.unobserve(e.target);
          typeEl(e.target);
        }
      }
    }, { threshold: .35 });
    document.querySelectorAll('.type').forEach((el) => typeIO.observe(el));
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
