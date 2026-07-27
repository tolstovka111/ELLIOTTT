/* ============================================================
   Elliot Design — интерактивное «разбитое стекло»
   Каждый осколок — полноэкранный слой с копией контента,
   обрезанный полигоном. Осколки по-разному следуют за
   курсором, дрейфуют и вздрагивают по клику — текст ломается
   на швах, как в референсе.
   ============================================================ */

'use strict';

(function glassStage() {
  const stage = document.getElementById('stage');
  const template = document.getElementById('pane-content');

  /* осколки: полигон (в % сцены), сила сдвига за мышью,
     наклоны и фаза дрейфа */
  const PANES = [
    { poly: [[0, 0], [30, 0], [24, 78], [0, 92]],                 k: [8, 5],    rot: [3.2, -2.4], z: 0,   phase: 0.0 },
    { poly: [[30, 0], [58, 0], [50, 52], [24, 78]],               k: [-13, 9],  rot: [-4.4, 3.4], z: -38, phase: 1.3 },
    { poly: [[58, 0], [88, 0], [78, 44], [50, 52]],               k: [16, -7],  rot: [5.2, 4.2],  z: 52,  phase: 2.1 },
    { poly: [[88, 0], [100, 0], [100, 60], [78, 44]],             k: [-20, 13], rot: [-6.4, -4.6], z: -62, phase: 3.4 },
    { poly: [[0, 92], [24, 78], [50, 52], [64, 100], [0, 100]],   k: [11, -11], rot: [4.0, -3.4], z: 30,  phase: 4.2 },
    { poly: [[50, 52], [78, 44], [100, 60], [100, 100], [64, 100]], k: [-15, -9], rot: [-5.2, 5.6], z: -46, phase: 5.0 },
  ];

  // сжимаем полигон к центроиду — образуются тонкие швы
  function insetPoly(poly, inset) {
    const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
    const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
    return poly.map(([x, y]) => {
      const dx = cx - x, dy = cy - y;
      const len = Math.hypot(dx, dy) || 1;
      return [x + dx / len * inset * 2.2, y + dy / len * inset * 2.2];
    });
  }

  // общая наклонённая 3D-поверхность
  const surface = document.createElement('div');
  surface.className = 'glass-surface';
  stage.appendChild(surface);

  /* скруглённый контур плиты (как в референсе): углы полигона
     срезаются дугами радиуса r — clip-path: path() в пикселях */
  function roundedPath(pts, r) {
    const n = pts.length;
    let d = '';
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
      const v1 = [p1[0] - p0[0], p1[1] - p0[1]];
      const v2 = [p2[0] - p1[0], p2[1] - p1[1]];
      const l1 = Math.hypot(v1[0], v1[1]) || 1;
      const l2 = Math.hypot(v2[0], v2[1]) || 1;
      const r1 = Math.min(r, l1 / 2.4), r2 = Math.min(r, l2 / 2.4);
      const a = [p1[0] - v1[0] / l1 * r1, p1[1] - v1[1] / l1 * r1];
      const b = [p1[0] + v2[0] / l2 * r2, p1[1] + v2[1] / l2 * r2];
      d += (i ? 'L' : 'M') + a[0].toFixed(1) + ' ' + a[1].toFixed(1) + ' ';
      d += 'Q' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) + ' ' + b[0].toFixed(1) + ' ' + b[1].toFixed(1) + ' ';
    }
    return d + 'Z';
  }

  const panes = PANES.map((cfg, i) => {
    const pane = document.createElement('div');
    pane.className = 'pane';

    const shadow = document.createElement('div');
    shadow.className = 'pane__shadow';
    pane.appendChild(shadow);

    const clip = document.createElement('div');
    clip.className = 'pane__clip';

    const inner = document.createElement('div');
    inner.className = 'pane__inner';
    inner.style.setProperty('--tint-angle', (130 + i * 22) + 'deg');
    inner.style.setProperty('--glint-delay', (i * 1.1) + 's');
    inner.appendChild(template.content.cloneNode(true));

    clip.appendChild(inner);
    pane.appendChild(clip);
    surface.appendChild(pane);

    const cx = cfg.poly.reduce((s, p) => s + p[0], 0) / cfg.poly.length;
    const cy = cfg.poly.reduce((s, p) => s + p[1], 0) / cfg.poly.length;
    return { el: pane, cfg, shadow, clip, inner, cx, cy, imp: 0, impX: 0, impY: 0 };
  });

  // контуры в пикселях — пересчитываются при изменении окна
  function setClips() {
    const w = surface.offsetWidth, h = surface.offsetHeight;
    for (const p of panes) {
      const px = inset => insetPoly(p.cfg.poly, inset).map(([x, y]) => [x / 100 * w, y / 100 * h]);
      const outer = `path('${roundedPath(px(0.22), 34)}')`;
      const inner = `path('${roundedPath(px(0.55), 30)}')`;
      p.shadow.style.clipPath = outer;
      p.clip.style.clipPath = outer;
      p.inner.style.clipPath = inner;
    }
  }
  setClips();
  addEventListener('resize', setClips);

  /* реальные кликабельные кнопки поверх стекла — контент в осколках
     декоративный (дублируется), поэтому ссылки кладём отдельным слоем */
  const actions = document.createElement('div');
  actions.className = 'stage-actions';
  actions.innerHTML = '<a href="index.html">IMG Editor</a><a href="audio.html">Audio Mixer&nbsp;→</a>';
  stage.appendChild(actions);

  function placeActions() {
    const ref = panes[0].el.querySelector('.content__actions');
    if (!ref) return;
    const r = ref.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    actions.style.left = (r.left - s.left) + 'px';
    actions.style.top = (r.top - s.top) + 'px';
  }
  placeActions();
  addEventListener('resize', placeActions);

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  /* движение: параллакс за курсором + медленный дрейф + импульс от клика */
  let tx = 0, ty = 0;   // цель (курсор), -1..1
  let mx = 0, my = 0;   // сглаженное значение

  stage.addEventListener('mousemove', e => {
    const r = stage.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width) * 2 - 1;
    ty = ((e.clientY - r.top) / r.height) * 2 - 1;
    stage.style.setProperty('--mx', ((tx + 1) * 50) + '%');
    stage.style.setProperty('--my', ((ty + 1) * 50) + '%');
  });

  stage.addEventListener('mouseleave', () => { tx = 0; ty = 0; });

  // клик — осколки разлетаются от точки удара и возвращаются
  stage.addEventListener('click', e => {
    const r = stage.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * 100;
    const py = ((e.clientY - r.top) / r.height) * 100;
    panes.forEach(p => {
      const dx = p.cx - px, dy = p.cy - py;
      const len = Math.hypot(dx, dy) || 1;
      p.imp = 1;
      p.impX = dx / len;
      p.impY = dy / len;
    });
    clink();
  });

  function frame(now) {
    const t = now / 1000;
    mx += (tx - mx) * 0.06;
    my += (ty - my) * 0.06;

    // вся поверхность наклонена в перспективе и следует за курсором
    surface.style.transform =
      `rotateX(${9 - my * 3.4}deg) rotateY(${-4 + mx * 4.5}deg)`;

    for (const p of panes) {
      const { k, rot, phase, z } = p.cfg;
      p.imp *= 0.92;
      const ix = p.impX * p.imp * 46;
      const iy = p.impY * p.imp * 46;
      const iz = p.imp * 90;
      const dx = mx * k[0] + Math.sin(t * 0.5 + phase) * 4 + ix;
      const dy = my * k[1] + Math.cos(t * 0.42 + phase * 1.7) * 4 + iy;
      const dz = z + Math.sin(t * 0.45 + phase) * 14 + iz;
      const ry = mx * rot[0] + Math.sin(t * 0.35 + phase) * 0.9;
      const rx = -my * rot[1] + Math.cos(t * 0.3 + phase) * 0.9;
      p.el.style.transform = `translate3d(${dx}px, ${dy}px, ${dz}px) rotateY(${ry}deg) rotateX(${rx}deg)`;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* автодеградация: если рендер не тянет, убираем блеск и тени */
  (function watchFps() {
    let n = 0;
    const t0 = performance.now();
    (function tick() {
      n++;
      if (performance.now() - t0 < 2500) requestAnimationFrame(tick);
      else if (n / 2.5 < 20) document.body.classList.add('glass-lite');
    })();
  })();

  /* короткий стеклянный «дзынь» на клик */
  let audioCtx = null;
  function clink() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch { return; }
    const t0 = audioCtx.currentTime;
    [2300, 3100, 4200].forEach((f, i) => {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t0);
      const g = audioCtx.createGain();
      g.gain.setValueAtTime(0.045 / (i + 1), t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
      osc.connect(g).connect(audioCtx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.24);
    });
  }
})();
