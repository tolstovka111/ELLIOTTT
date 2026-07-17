/* ============================================================
   Интерактивная чёрная дыра (canvas 2D)
   — аккреционный диск из частиц, фотонное кольцо, линзирование
   — курсор наклоняет систему, клик по дыре — вспышка и волна
   ============================================================ */

(() => {
  const canvas = document.getElementById('blackhole');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, DPR = 1;
  let cx = 0, cy = 0;          // центр дыры
  let R = 0;                   // радиус горизонта событий
  let mouseX = 0, mouseY = 0;  // -1..1 от центра
  let tiltX = 0, tiltY = 0;    // сглаженный наклон
  let flash = 0;               // вспышка при клике
  let shock = 0;               // ударная волна
  let t = 0;

  const isLight = () => document.documentElement.dataset.theme === 'light';

  function resize() {
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // на широких экранах дыра живёт справа от текста, на узких — по центру
    cx = W > 900 ? W * 0.72 : W / 2;
    cy = H / 2 - H * 0.04;
    R = Math.min(W, H) * (W > 900 ? 0.13 : 0.11);
  }

  /* ---------- частицы диска ---------- */
  const N = reduced ? 0 : 520;
  const parts = [];

  function spawn(p, fresh) {
    p.a = Math.random() * Math.PI * 2;                 // угол на орбите
    p.r = R * (1.25 + Math.pow(Math.random(), 1.6) * 3.4); // радиус орбиты
    p.size = .6 + Math.random() * 1.7;
    p.decay = 0;                                       // 0 = стабильная орбита
    if (Math.random() < .18) p.decay = .12 + Math.random() * .3; // падающие в дыру
    p.hue = Math.random();                             // 0..1: фиолет → тёплый
    if (!fresh) p.r = R * (1.25 + Math.random() * 3.4);
  }

  for (let i = 0; i < N; i++) { const p = {}; spawn(p, false); parts.push(p); }

  /* ---------- звёзды фона ---------- */
  const stars = [];
  for (let i = 0; i < 90; i++) {
    stars.push({ x: Math.random(), y: Math.random(), s: Math.random() * 1.4 + .3, tw: Math.random() * Math.PI * 2 });
  }

  function colorOf(p, alpha) {
    // от фиолетового к тёплому белому ближе к дыре
    const near = Math.max(0, 1 - (p.r - R) / (R * 3));
    const mix = Math.min(1, p.hue * .6 + near * .8);
    const r = Math.round(124 + mix * 131);
    const g = Math.round(108 + mix * 90);
    const b = Math.round(255 - mix * 100);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function frame() {
    t += 0.016;
    tiltX += (mouseX - tiltX) * 0.045;
    tiltY += (mouseY - tiltY) * 0.045;
    flash *= 0.93;
    if (shock > 0) shock += 7;
    if (shock > Math.max(W, H)) shock = 0;

    ctx.clearRect(0, 0, W, H);
    const light = isLight();

    /* звёзды (только в тёмной теме) */
    if (!light) {
      ctx.fillStyle = '#fff';
      for (const s of stars) {
        const a = .25 + .55 * Math.abs(Math.sin(t * .7 + s.tw));
        ctx.globalAlpha = a;
        ctx.fillRect(s.x * W + tiltX * 14, s.y * H + tiltY * 14, s.s, s.s);
      }
      ctx.globalAlpha = 1;
    }

    const ox = cx + tiltX * 26;
    const oy = cy + tiltY * 20;
    const squash = 0.36 + tiltY * 0.07; // "наклон" диска

    /* мягкое гало вокруг дыры */
    const halo = ctx.createRadialGradient(ox, oy, R * .8, ox, oy, R * 4.6);
    const haloA = light ? .25 : .5;
    halo.addColorStop(0, `rgba(124,108,255,${haloA * (0.55 + flash)})`);
    halo.addColorStop(.5, `rgba(124,108,255,${haloA * .16})`);
    halo.addColorStop(1, 'rgba(124,108,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(ox - R * 5, oy - R * 5, R * 10, R * 10);

    ctx.globalCompositeOperation = light ? 'source-over' : 'lighter';

    /* частицы диска — задняя половина рисуется до дыры, передняя после */
    const back = [], front = [];
    for (const p of parts) {
      // кеплеровская скорость: ближе — быстрее
      p.a += 0.014 * Math.pow(R * 2.2 / p.r, 1.5);
      if (p.decay) {
        p.r -= p.decay * (1 + (shock ? .8 : 0));
        if (p.r < R * 1.02) { spawn(p, true); p.r = R * (3.6 + Math.random()); }
      }
      (Math.sin(p.a) < 0 ? back : front).push(p);
    }

    const drawParts = (list) => {
      for (const p of list) {
        const px = ox + Math.cos(p.a) * p.r;
        const py = oy + Math.sin(p.a) * p.r * squash;
        const near = Math.max(0, 1 - (p.r - R) / (R * 3.4));
        // доплер: приближающаяся к нам сторона ярче
        const dopp = .55 + .45 * Math.cos(p.a);
        const a = (.14 + near * .75) * dopp + flash * .3;
        ctx.fillStyle = colorOf(p, Math.min(1, a));
        const s = p.size * (0.7 + near * 1.3);
        ctx.beginPath();
        ctx.arc(px, py, s, 0, 7);
        ctx.fill();
      }
    };

    drawParts(back);

    /* линзированная арка над дырой (свет из-за дыры) */
    ctx.strokeStyle = `rgba(214,190,255,${(light ? .5 : .75) + flash * .2})`;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(ox, oy, R * 1.45, R * 1.45, 0, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();

    ctx.globalCompositeOperation = 'source-over';

    /* сам горизонт событий */
    const hole = ctx.createRadialGradient(ox - R * .2, oy - R * .2, R * .1, ox, oy, R);
    hole.addColorStop(0, '#000');
    hole.addColorStop(1, '#000');
    ctx.fillStyle = hole;
    ctx.beginPath();
    ctx.arc(ox, oy, R, 0, 7);
    ctx.fill();

    /* фотонное кольцо */
    const ringGrad = ctx.createRadialGradient(ox, oy, R * .96, ox, oy, R * 1.22);
    ringGrad.addColorStop(0, 'rgba(255,220,170,0)');
    ringGrad.addColorStop(.45, `rgba(255,210,150,${.85 + flash})`);
    ringGrad.addColorStop(.7, `rgba(179,157,255,${.5 + flash * .4})`);
    ringGrad.addColorStop(1, 'rgba(124,108,255,0)');
    ctx.strokeStyle = ringGrad;
    ctx.lineWidth = R * .16;
    ctx.beginPath();
    ctx.arc(ox, oy, R * 1.08, 0, 7);
    ctx.stroke();

    ctx.globalCompositeOperation = light ? 'source-over' : 'lighter';
    drawParts(front);

    /* ударная волна от клика */
    if (shock > 0) {
      ctx.strokeStyle = `rgba(179,157,255,${Math.max(0, 1 - shock / (Math.max(W, H)))})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(ox, oy, shock, shock * squash * 1.6, 0, 0, 7);
      ctx.stroke();
    }

    ctx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(frame);
  }

  /* ---------- события ---------- */
  addEventListener('resize', resize);

  addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = ((e.clientX - rect.left) / rect.width - .5) * 2;
    mouseY = ((e.clientY - rect.top) / rect.height - .5) * 2;
  });

  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const dx = e.clientX - rect.left - (cx + tiltX * 26);
    const dy = e.clientY - rect.top - (cy + tiltY * 20);
    flash = 1;
    shock = 1;
    // часть частиц срывается с орбит
    for (const p of parts) if (Math.random() < .3) p.decay = .3 + Math.random() * .5;
    void dx; void dy;
  });

  resize();
  if (reduced) {
    // статичный кадр без анимации
    t = 1; frame && null;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,210,150,.9)';
    ctx.lineWidth = R * .14;
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.08, 0, 7); ctx.stroke();
  } else {
    requestAnimationFrame(frame);
  }
})();
