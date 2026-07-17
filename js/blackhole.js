/* ============================================================
   Чёрная дыра «Singularity» — аккреционный диск из точек,
   ASCII-глифов и пиксельных блоков с глитч-переходами.
   Курсор вращает камеру, клик схлопывает дыру.
   ============================================================ */

(() => {
  'use strict';

  const canvas = document.getElementById('blackhole');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, DPR = 1;
  let cx = 0, cy = 0;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // на широких экранах дыра справа от текста, на узких — по центру
    cx = W > 900 ? W * 0.72 : W / 2;
    cy = H / 2 - H * 0.04;
  }
  window.addEventListener('resize', resize);
  resize();

  /* --- детерминированный хэш (стабильные глифы и глитч-строки) --- */
  function hash2(a, b) {
    let h = (a * 374761393 + b * 668265263) | 0;
    h = (h ^ (h >> 13)) | 0;
    h = Math.imul(h, 1274126177);
    h = (h ^ (h >> 16)) >>> 0;
    return h / 4294967295;
  }

  /* --- модель аккреционного диска --- */
  const N = 3600;
  const R_IN = 1.15;
  const R_OUT = 3.6;
  const particles = [];

  function buildDisk() {
    particles.length = 0;
    for (let i = 0; i < N; i++) {
      const u = Math.random();
      const r = R_IN + (R_OUT - R_IN) * Math.pow(u, 1.6);
      particles.push({
        r: r,
        a: Math.random() * Math.PI * 2,
        y: (Math.random() - 0.5) * 0.05 * r,
        speed: 0.55 / Math.pow(r, 1.5),
        flick: Math.random() * Math.PI * 2,
        jitter: Math.random()
      });
    }
  }
  buildDisk();

  /* --- тёплая плазменная палитра: 0 = внешний край, 1 = ядро --- */
  const STOPS = [
    [58, 15, 4],
    [138, 44, 8],
    [217, 106, 16],
    [245, 166, 35],
    [255, 215, 94],
    [255, 248, 224]
  ];
  function palette(t, bright) {
    t = Math.max(0, Math.min(1, t));
    const f = t * (STOPS.length - 1);
    const i = Math.min(STOPS.length - 2, Math.floor(f));
    const k = f - i;
    const c0 = STOPS[i], c1 = STOPS[i + 1];
    const b = Math.max(0, Math.min(1.35, bright));
    const r = Math.min(255, (c0[0] + (c1[0] - c0[0]) * k) * b);
    const g = Math.min(255, (c0[1] + (c1[1] - c0[1]) * k) * b);
    const bl = Math.min(255, (c0[2] + (c1[2] - c0[2]) * k) * b);
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (bl | 0) + ')';
  }

  /* --- состояние --- */
  let time = 0;
  let last = performance.now();

  let phase = 'forming';           // forming -> interactive -> collapsing
  let phaseT = 0;
  let bloom = 0;
  let bloomTarget = 1;
  let collapse = 0;

  let autoRotY = 0;
  let autoRotZ = 0;
  let mouseRotX = 0, mouseRotY = 0;
  let targetMouseRotX = 0, targetMouseRotY = 0;
  const BASE_TILT = -0.30;

  // режимы текстуры: 0 = точки, 1 = ascii-глифы, 2 = пиксельные блоки
  let renderMode = 0;
  let modeT = 1;
  let densTimer = 0;
  let densDir = 0;
  let grid = 11;
  let gridTarget = 11;
  let glyphEpoch = 1;
  let glitchT = 0;

  const GLYPHS = '$&@OPRLVWXHBGSAD790?%#+=*';

  function triggerGlitch() {
    glitchT = 0.35;
    glyphEpoch++;
  }

  /* --- ввод: курсор вращает, клик схлопывает --- */
  let mouseX = W / 2, mouseY = H / 2;
  let moveAccum = 0;

  function onMove(x, y) {
    const rect = canvas.getBoundingClientRect();
    x -= rect.left; y -= rect.top;
    moveAccum += Math.abs(x - mouseX) + Math.abs(y - mouseY);
    mouseX = x;
    mouseY = y;
  }
  window.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
  window.addEventListener('touchmove', e => {
    if (e.touches.length) onMove(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  canvas.addEventListener('pointerdown', () => {
    triggerGlitch();
    if (phase === 'interactive') { phase = 'collapsing'; phaseT = 0; }
  });

  /* --- буферы сетки --- */
  let gw = 0, gh = 0;
  let cellB = new Float32Array(0);
  let cellT = new Float32Array(0);
  let cellN = new Float32Array(0);

  function ensureGrid(g) {
    const nw = Math.ceil(W / g) + 2;
    const nh = Math.ceil(H / g) + 2;
    if (nw !== gw || nh !== gh || cellB.length < nw * nh) {
      gw = nw; gh = nh;
      cellB = new Float32Array(gw * gh);
      cellT = new Float32Array(gw * gh);
      cellN = new Float32Array(gw * gh);
    } else {
      cellB.fill(0); cellT.fill(0); cellN.fill(0);
    }
  }

  /* --- главный цикл --- */
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    time += dt;

    targetMouseRotX = ((mouseY - H / 2) / H) * 0.9;
    targetMouseRotY = ((mouseX - cx) / W) * 1.4;
    mouseRotX += (targetMouseRotX - mouseRotX) * Math.min(1, 3.2 * dt);
    mouseRotY += (targetMouseRotY - mouseRotY) * Math.min(1, 3.2 * dt);

    autoRotY += 0.045 * dt;
    autoRotZ = 0.16 * Math.sin(time * 0.13) - 0.24;

    const rotX = BASE_TILT + mouseRotX;
    const rotY = autoRotY + mouseRotY;
    const rotZ = autoRotZ + mouseRotY * 0.45;

    if (phase === 'forming') {
      bloom += (bloomTarget - bloom) * 0.8 * dt;
      phaseT += dt;
      if (bloom > 0.98) { bloom = 1; phase = 'interactive'; phaseT = 0; }
    }
    if (phase === 'interactive') {
      phaseT += dt;
      if (phaseT > 25) { phase = 'collapsing'; phaseT = 0; triggerGlitch(); }
    }
    if (phase === 'collapsing') {
      phaseT += dt;
      collapse = Math.min(1, phaseT / 2.2);
      if (collapse >= 1) {
        phase = 'forming'; phaseT = 0;
        bloom = 0; collapse = 0;
        buildDisk();
        triggerGlitch();
      }
    } else {
      collapse = 0;
    }

    densTimer += dt + Math.min(0.05, moveAccum * 0.0006);
    moveAccum *= Math.pow(0.02, dt);
    if (densTimer > 3.4 && phase === 'interactive') {
      densTimer = 0;
      triggerGlitch();
      renderMode = (renderMode + 1) % 3;
      modeT = 0;
      densDir = (densDir + 1) % 2;
      gridTarget = densDir === 1 ? 15 : 9;
    }
    modeT = Math.min(1, modeT + dt * 3);
    grid += (gridTarget - grid) * Math.min(1, 2.5 * dt);
    if (glitchT > 0) glitchT = Math.max(0, glitchT - dt);

    render(rotX, rotY, rotZ);
    requestAnimationFrame(frame);
  }

  /* --- рендер --- */
  function render(rotX, rotY, rotZ) {
    ctx.clearRect(0, 0, W, H);

    const scale = Math.min(W, H) * 0.13 * (0.35 + 0.65 * easeOut(bloom)) * (1 - 0.85 * easeIn(collapse));
    const shadowR = scale * 0.92;

    // тень дыры рисуем явно, чтобы её было видно и на светлой теме
    if (shadowR > 1) {
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(cx, cy, shadowR, 0, 6.2832);
      ctx.fill();
    }

    const sX = Math.sin(rotX), cX = Math.cos(rotX);
    const sY = Math.sin(rotY), cY = Math.cos(rotY);
    const sZ = Math.sin(rotZ), cZ = Math.cos(rotZ);

    // проекция нормали диска — направление линзированной арки
    let nx = 0, ny = 1, nz = 0;
    {
      let y1 = ny * cX - nz * sX, z1 = ny * sX + nz * cX;
      let x2 = nx * cY + z1 * sY, z2 = -nx * sY + z1 * cY;
      let x3 = x2 * cZ - y1 * sZ, y3 = x2 * sZ + y1 * cZ;
      nx = x3; ny = y3; nz = z2;
    }
    let nl = Math.hypot(nx, ny);
    let ndx = 0, ndy = -1;
    if (nl > 1e-4) { ndx = nx / nl; ndy = ny / nl; }
    ndy = -ndy;
    const faceOn = Math.abs(nz);
    const udx = -ndy, udy = ndx;

    const g = Math.max(6, grid);
    ensureGrid(g);

    const col = collapse;
    const flickT = time * 7;

    for (let i = 0; i < N; i++) {
      const p = particles[i];
      const rr = p.r * (1 - col * (0.55 + 0.45 * p.jitter));
      const ang = p.a + time * p.speed * (1 + col * 6);

      const px = Math.cos(ang) * rr;
      const py = p.y;
      const pz = Math.sin(ang) * rr;

      let y1 = py * cX - pz * sX;
      let z1 = py * sX + pz * cX;
      let x2 = px * cY + z1 * sY;
      let z2 = -px * sY + z1 * cY;
      let x3 = x2 * cZ - y1 * sZ;
      let y3 = x2 * sZ + y1 * cZ;

      const persp = 5 / (5 + z2);
      let sx = x3 * persp * scale;
      let sy = -y3 * persp * scale;

      const tCol = 1 - (p.r - R_IN) / (R_OUT - R_IN);

      // доплеровское усиление: летящее к нам вещество ярче
      const tvx = -Math.sin(ang), tvz = Math.cos(ang);
      let vz = tvx * (-sY) + tvz * cX * cY;
      const beam = 1 + 0.85 * Math.max(-1, Math.min(1, -vz));

      let bright = (0.28 + 0.85 * tCol * tCol) * beam
                 * (0.82 + 0.18 * Math.sin(flickT + p.flick))
                 * easeOut(bloom) * (1 + col * 1.6);

      const behind = z2 > 0;
      if (behind) {
        // линзирование: дальняя сторона диска загибается в фотонное кольцо
        const bend = Math.min(1, z2 / (rr * 0.75 + 0.001));
        const ringR = shadowR * (1.06 + 0.45 * (1 - tCol));
        let along = sx * udx + sy * udy;
        const xi = Math.max(-1, Math.min(1, along / ringR));
        const lift = Math.sqrt(1 - xi * xi) * ringR;
        const ax = udx * xi * ringR + ndx * lift;
        const ay = udy * xi * ringR + ndy * lift;
        const mix = bend * (1 - faceOn * 0.85);
        sx = sx + (ax - sx) * mix;
        sy = sy + (ay - sy) * mix;
        bright *= 0.75 + 0.45 * tCol;
        if (sx * sx + sy * sy < shadowR * shadowR * 0.94) continue;

        // слабое вторичное изображение под тенью
        if (p.jitter > 0.72 && !faceOn) {
          const r2 = shadowR * 1.02;
          const l2 = Math.sqrt(Math.max(0, 1 - xi * xi)) * r2;
          const bx = udx * xi * r2 - ndx * l2;
          const by = udy * xi * r2 - ndy * l2;
          stamp(bx + cx, by + cy, bright * 0.30 * mix, tCol, g);
        }
      }

      stamp(sx + cx, sy + cy, bright, tCol, g);
    }

    drawCells(g);
  }

  function stamp(x, y, bright, tCol, g) {
    if (x < 0 || y < 0 || x >= W || y >= H || bright <= 0) return;
    const ix = (x / g) | 0;
    const iy = (y / g) | 0;
    const idx = iy * gw + ix;
    cellB[idx] += bright;
    cellT[idx] += tCol * bright;
    cellN[idx] += 1;
  }

  function drawCells(g) {
    const glitch = glitchT > 0;
    const gAmp = glitch ? glitchT / 0.35 : 0;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (renderMode === 1) {
      ctx.font = (g * 1.15).toFixed(1) + 'px "Pixeloid Sans", "Courier New", monospace';
    }

    for (let iy = 0; iy < gh; iy++) {
      let rowOff = 0;
      if (glitch && hash2(iy, glyphEpoch * 7 + ((time * 30) | 0)) > 0.72) {
        rowOff = (hash2(iy * 3 + 1, (time * 60) | 0) - 0.5) * g * 9 * gAmp;
      }
      for (let ix = 0; ix < gw; ix++) {
        const idx = iy * gw + ix;
        const n = cellN[idx];
        if (!n) continue;
        let b = cellB[idx] / (1 + n * 0.28);
        if (b < 0.09) continue;
        const t = cellT[idx] / cellB[idx];

        let x = ix * g + g / 2 + rowOff;
        let y = iy * g + g / 2;

        if (glitch && hash2(idx, glyphEpoch) < 0.18 * gAmp) continue;

        const clip = Math.min(1.35, b);
        const white = Math.max(0, clip - 1) * 2;
        ctx.fillStyle = palette(Math.min(1, t + white * 0.4), 0.55 + clip * 0.75);

        if (renderMode === 0) {
          const rad = g * 0.42 * Math.min(1, 0.35 + b * 0.75);
          ctx.beginPath();
          ctx.arc(x, y, rad, 0, 6.2832);
          ctx.fill();
        } else if (renderMode === 1) {
          const ch = GLYPHS[(hash2(ix * 31 + iy, glyphEpoch) * GLYPHS.length) | 0];
          ctx.fillText(ch, x, y);
        } else {
          const s = g * Math.min(1, 0.45 + b * 0.7);
          ctx.fillRect(x - s / 2, y - s / 2, s * 0.96, s * 0.96);
        }

        if (glitch && gAmp > 0.4 && hash2(idx * 5 + 2, glyphEpoch) > 0.86) {
          ctx.fillStyle = 'rgba(255,40,40,0.55)';
          ctx.fillRect(x - g * 0.3 + 3, y - g * 0.3, g * 0.6, g * 0.6);
          ctx.fillStyle = 'rgba(40,220,255,0.4)';
          ctx.fillRect(x - g * 0.3 - 3, y - g * 0.3, g * 0.6, g * 0.6);
        }
      }
    }

    if (glitch) {
      const bars = 3 + ((gAmp * 5) | 0);
      for (let i = 0; i < bars; i++) {
        const ry = hash2(i + 9, (time * 40) | 0) * H;
        const rh = 1 + hash2(i + 40, (time * 50) | 0) * 3;
        ctx.fillStyle = 'rgba(255,255,255,' + (0.03 + 0.05 * gAmp) + ')';
        ctx.fillRect(0, ry, W, rh);
      }
    }
  }

  function easeOut(t) { return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3); }
  function easeIn(t) { const c = Math.max(0, Math.min(1, t)); return c * c * c; }

  if (reduced) {
    // статичный кадр без анимации
    const scale = Math.min(W, H) * 0.13;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(cx, cy, scale * 0.92, 0, 6.2832); ctx.fill();
    for (let i = 0; i < 400; i++) {
      const a = Math.random() * 6.2832;
      const r = scale * (1.1 + Math.random() * 1.6);
      const t = 1 - (r / scale - 1.1) / 1.6;
      ctx.fillStyle = palette(t, 0.9);
      ctx.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.42, 3, 3);
    }
  } else {
    requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
  }
})();
