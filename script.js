'use strict';

(function liquidGoldBackground() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false })
    || canvas.getContext('experimental-webgl', { antialias: false, alpha: false });
  if (!gl) { document.body.classList.add('no-webgl'); return; }

  const VERT = `
    attribute vec2 a_pos;
    void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
  `;

  const FRAG = `
    precision highp float;
    uniform vec2 u_res;
    uniform float u_time;

    float hash(vec2 p) {
      p = fract(p * vec2(234.34, 435.345));
      p += dot(p, p + 34.23);
      return fract(p.x * p.y);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float amp = 0.55;
      mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
      for (int i = 0; i < 5; i++) {
        v += amp * noise(p);
        p = rot * p * 2.03;
        amp *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);
      float t = u_time * 0.055;

      vec2 q = vec2(
        fbm(uv * 1.6 + vec2(0.0, t)),
        fbm(uv * 1.6 + vec2(5.2, 1.3) - t * 0.7)
      );
      vec2 r = vec2(
        fbm(uv * 1.6 + 2.6 * q + vec2(1.7, 9.2) + t * 0.4),
        fbm(uv * 1.6 + 2.6 * q + vec2(8.3, 2.8) - t * 0.3)
      );
      float f = fbm(uv * 1.6 + 2.8 * r);

      float ridge = 1.0 - abs(2.0 * f - 1.0);
      float veins = pow(ridge, 7.0);
      float body  = pow(max(f - 0.25, 0.0), 3.2) * 0.9;

      float lum = clamp(veins * 1.5 + body, 0.0, 1.0);
      lum = pow(lum, 1.5);

      vec3 col = vec3(0.0);
      col = mix(col, vec3(0.28, 0.13, 0.01), smoothstep(0.05, 0.4, lum));
      col = mix(col, vec3(0.95, 0.62, 0.05), smoothstep(0.35, 0.75, lum));
      col = mix(col, vec3(1.0, 0.92, 0.62), smoothstep(0.75, 1.0, lum));

      col += (hash(gl_FragCoord.xy + u_time) - 0.5) * 0.03;

      col *= 0.72;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { document.body.classList.add('no-webgl'); return; }

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(prog));
    document.body.classList.add('no-webgl');
    return;
  }
  gl.useProgram(prog);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'u_res');
  const uTime = gl.getUniformLocation(prog, 'u_time');

  const MAX_PIXELS = 640 * 360;
  let raf = 0;

  function resize() {
    const scale = Math.min(0.5, Math.sqrt(MAX_PIXELS / Math.max(1, innerWidth * innerHeight)));
    canvas.width = Math.max(1, Math.round(innerWidth * scale));
    canvas.height = Math.max(1, Math.round(innerHeight * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  let resizeQueued = false;
  addEventListener('resize', () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => { resizeQueued = false; resize(); });
  }, { passive: true });
  resize();

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const start = performance.now();

  function frame(now) {
    raf = 0;
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, (now - start) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reduceMotion && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function play() { if (!raf) raf = requestAnimationFrame(frame); }
  play();

  document.addEventListener('visibilitychange', () => { if (!document.hidden) play(); });

  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    cancelAnimationFrame(raf);
    raf = 0;
    canvas.hidden = true;
    document.body.classList.add('no-webgl');
  });
})();

const state = {
  pixelate: 0, brightness: 0, contrast: 0, saturation: 0,
  glitch: 0, noise: 0, aberration: 0, scanlines: 0,
  vignette: 0, gold: 0, grayscale: 0, invert: 0,
};

const DEFAULTS = { ...state };
const PREVIEW_MAX = 1100;

let sourceImage = null;
let previewSource = null;
let fileName = 'photo';
let renderQueued = false;

const MAX_FILE_BYTES = 40 * 1024 * 1024;
const MAX_EXPORT_PIXELS = 16_000_000;

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const dzIdle = document.getElementById('dz-idle');
const previewCanvas = document.getElementById('preview-canvas');
const imgInfo = document.getElementById('img-info');
const btnExport = document.getElementById('btn-export');
const btnNew = document.getElementById('btn-new');
const btnReset = document.getElementById('btn-reset');

dropzone.addEventListener('click', () => { if (!sourceImage) fileInput.click(); });

dropzone.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  e.preventDefault();
  if (!sourceImage) fileInput.click();
});

btnNew.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) loadFile(fileInput.files[0]);
  fileInput.value = '';
});

['dragenter', 'dragover'].forEach(ev =>
  dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add('is-over'); }));
['dragleave', 'drop'].forEach(ev =>
  dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove('is-over'); }));
dropzone.addEventListener('drop', e => {
  const file = e.dataTransfer.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    imgInfo.textContent = 'это не изображение';
    return;
  }
  loadFile(file);
});

function loadFile(file) {
  if (!file.type.startsWith('image/')) {
    imgInfo.textContent = 'это не изображение';
    return;
  }
  if (file.size > MAX_FILE_BYTES) {
    imgInfo.textContent = `слишком большой файл (>${Math.round(MAX_FILE_BYTES / 1024 / 1024)} МБ)`;
    return;
  }

  fileName = (file.name || 'photo').replace(/\.[^.]+$/, '');
  imgInfo.textContent = 'открываю…';

  const url = URL.createObjectURL(file);
  const img = new Image();

  img.onload = () => {
    URL.revokeObjectURL(url);
    if (!img.width || !img.height) {
      imgInfo.textContent = 'не удалось открыть файл';
      return;
    }
    sourceImage = img;

    const k = Math.min(1, PREVIEW_MAX / Math.max(img.width, img.height));
    previewSource = document.createElement('canvas');
    previewSource.width = Math.max(1, Math.round(img.width * k));
    previewSource.height = Math.max(1, Math.round(img.height * k));
    previewSource.getContext('2d').drawImage(img, 0, 0, previewSource.width, previewSource.height);

    dzIdle.hidden = true;
    previewCanvas.hidden = false;
    dropzone.classList.add('has-image');
    dropzone.setAttribute('aria-label', `Фото загружено: ${file.name}`);
    btnExport.disabled = false;
    btnNew.hidden = false;

    const huge = img.width * img.height > MAX_EXPORT_PIXELS;
    imgInfo.textContent = `${file.name} — ${img.width}×${img.height}` +
      (huge ? ' · экспорт будет уменьшен' : '');
    scheduleRender();
  };

  img.onerror = () => {
    URL.revokeObjectURL(url);
    imgInfo.textContent = 'не удалось открыть файл';
  };

  img.src = url;
}

document.querySelectorAll('#controls input[type="range"]').forEach(input => {
  const ctrl = input.closest('.ctrl');
  const output = ctrl.querySelector('output');

  const sync = () => {
    const v = Number(input.value);
    state[input.dataset.key] = v;
    output.textContent = v;
    const min = Number(input.min), max = Number(input.max);
    input.style.setProperty('--fill', ((v - min) / (max - min) * 100) + '%');
    ctrl.classList.toggle('is-active', v !== DEFAULTS[input.dataset.key]);
  };

  input.addEventListener('input', () => { sync(); scheduleRender(); });
  sync();
});

btnReset.addEventListener('click', () => applyValues(DEFAULTS));

const PRESETS = {
  cyber:  { glitch: 55, aberration: 40, contrast: 25, saturation: 20, scanlines: 25 },
  vhs:    { noise: 35, scanlines: 60, aberration: 25, saturation: -25, brightness: 5, vignette: 30 },
  gold:   { gold: 70, contrast: 15, vignette: 35, brightness: 5 },
  noir:   { grayscale: 100, contrast: 35, vignette: 50, noise: 12 },
  broken: { pixelate: 30, glitch: 80, noise: 25, invert: 15, aberration: 60 },
};

document.querySelectorAll('.chip').forEach(chip =>
  chip.addEventListener('click', () =>
    applyValues({ ...DEFAULTS, ...PRESETS[chip.dataset.preset] })));

function applyValues(values) {
  document.querySelectorAll('#controls input[type="range"]').forEach(input => {
    input.value = values[input.dataset.key];
    input.dispatchEvent(new Event('input'));
  });
}

function scheduleRender() {
  if (renderQueued || !previewSource) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderPipeline(previewSource, previewCanvas);
  });
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const scratch = new Map();
function getScratch(name, w, h) {
  let c = scratch.get(name);
  if (!c) { c = document.createElement('canvas'); scratch.set(name, c); }
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  else c.getContext('2d').clearRect(0, 0, w, h);
  return c;
}

function releaseScratch() {
  scratch.forEach(c => { c.width = 1; c.height = 1; });
}

function renderPipeline(source, target) {
  const w = source.width, h = source.height;
  target.width = w;
  target.height = h;
  const ctx = target.getContext('2d');

  if (state.pixelate > 0) {
    const factor = 1 + (state.pixelate / 100) * (Math.max(w, h) / 24);
    const pw = Math.max(1, Math.round(w / factor));
    const ph = Math.max(1, Math.round(h / factor));
    const tiny = getScratch('tiny', pw, ph);
    tiny.getContext('2d').drawImage(source, 0, 0, pw, ph);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tiny, 0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
  } else {
    ctx.drawImage(source, 0, 0, w, h);
  }

  const perPixel = state.brightness || state.contrast || state.saturation ||
    state.noise || state.gold || state.grayscale || state.invert;

  if (perPixel) {
    const imageData = ctx.getImageData(0, 0, w, h);
    const d = imageData.data;

    const bright = state.brightness * 1.6;
    const cFactor = (259 * (state.contrast * 1.28 + 255)) / (255 * (259 - state.contrast * 1.28));
    const sat = 1 + state.saturation / 100;
    const noiseAmt = state.noise * 1.1;
    const goldMix = state.gold / 100;
    const grayMix = state.grayscale / 100;
    const invMix = state.invert / 100;

    for (let i = 0; i < d.length; i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2];

      if (state.brightness) { r += bright; g += bright; b += bright; }

      if (state.contrast) {
        r = cFactor * (r - 128) + 128;
        g = cFactor * (g - 128) + 128;
        b = cFactor * (b - 128) + 128;
      }

      if (state.saturation) {
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        r = l + (r - l) * sat;
        g = l + (g - l) * sat;
        b = l + (b - l) * sat;
      }

      if (state.gold) {
        const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const gr = Math.min(255, l * 2.05 * 255);
        const gg = Math.min(255, Math.pow(l, 1.35) * 1.75 * 255);
        const gb = Math.pow(l, 3.2) * 0.9 * 255;
        r = r * (1 - goldMix) + gr * goldMix;
        g = g * (1 - goldMix) + gg * goldMix;
        b = b * (1 - goldMix) + gb * goldMix;
      }

      if (state.grayscale) {
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        r = r * (1 - grayMix) + l * grayMix;
        g = g * (1 - grayMix) + l * grayMix;
        b = b * (1 - grayMix) + l * grayMix;
      }

      if (state.invert) {
        r = r * (1 - invMix) + (255 - r) * invMix;
        g = g * (1 - invMix) + (255 - g) * invMix;
        b = b * (1 - invMix) + (255 - b) * invMix;
      }

      if (state.noise) {
        const n = (Math.random() - 0.5) * noiseAmt;
        r += n; g += n; b += n;
      }

      d[i] = r < 0 ? 0 : r > 255 ? 255 : r;
      d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
      d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }
    ctx.putImageData(imageData, 0, 0);
  }

  if (state.aberration > 0) {
    const shift = Math.max(1, Math.round((state.aberration / 100) * w * 0.02));
    const snap = getScratch('snapAb', w, h);
    snap.getContext('2d').drawImage(target, 0, 0);

    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgb(0,255,255)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'screen';
    const red = channelOnly(snap, 'red', 'chRed');
    const blue = channelOnly(snap, 'blue', 'chBlue');
    ctx.drawImage(red, shift, 0);
    ctx.drawImage(blue, -shift, 0);
    ctx.globalCompositeOperation = 'source-over';
  }

  if (state.glitch > 0) {
    const rnd = mulberry32(1337 + state.glitch * 7);
    const snap = getScratch('snapGl', w, h);
    snap.getContext('2d').drawImage(target, 0, 0);

    const slices = Math.round(3 + (state.glitch / 100) * 14);
    const maxShift = (state.glitch / 100) * w * 0.14;

    for (let i = 0; i < slices; i++) {
      const sy = Math.floor(rnd() * h);
      const sh = Math.max(2, Math.floor(rnd() * h * 0.07));
      const dx = Math.round((rnd() - 0.5) * 2 * maxShift);
      ctx.drawImage(snap, 0, sy, w, sh, dx, sy, w, sh);
      if (state.glitch > 45 && rnd() > 0.6) {
        ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,196,0,0.16)' : 'rgba(255,255,255,0.10)';
        ctx.fillRect(0, sy, w, Math.max(1, Math.floor(sh * 0.35)));
      }
    }
  }

  if (state.scanlines > 0) {
    const alpha = (state.scanlines / 100) * 0.5;
    const step = Math.max(2, Math.round(h / 220));
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    for (let y = 0; y < h; y += step * 2) ctx.fillRect(0, y, w, step);
  }

  if (state.vignette > 0) {
    const strength = state.vignette / 100;
    const grad = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * (0.55 - strength * 0.25),
      w / 2, h / 2, Math.max(w, h) * 0.75
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${0.9 * strength})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
}

function channelOnly(source, channel, slot) {
  const c = getScratch(slot, source.width, source.height);
  const cc = c.getContext('2d');
  cc.globalCompositeOperation = 'source-over';
  cc.drawImage(source, 0, 0);
  cc.globalCompositeOperation = 'multiply';
  cc.fillStyle = channel === 'red' ? 'rgb(255,0,0)' : 'rgb(0,0,255)';
  cc.fillRect(0, 0, c.width, c.height);
  return c;
}

let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playUI(kind) {
  let ctx;
  try { ctx = getAudioCtx(); } catch { return; }
  const t = ctx.currentTime;

  if (kind === 'primary') {
    const len = Math.floor(ctx.sampleRate * 0.07);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let held = 0;
    for (let i = 0; i < len; i++) {
      if (i % 24 === 0) held = Math.random() * 2 - 1;
      data[i] = held * (1 - i / len);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.10, t);
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(2600, t);
    band.frequency.exponentialRampToValueAtTime(500, t + 0.07);
    noise.connect(band).connect(nGain).connect(ctx.destination);
    noise.start(t);
    tone(ctx, t, 'square', 720, 160, 0.06, 0.1);
  } else if (kind === 'chip') {
    tone(ctx, t, 'triangle', 420, 980, 0.07, 0.09);
    tone(ctx, t + 0.04, 'triangle', 620, 1240, 0.05, 0.07);
  } else if (kind === 'soft') {
    tone(ctx, t, 'sine', 520, 340, 0.045, 0.08);
  } else if (kind === 'tick') {
    tone(ctx, t, 'square', 1500, 1350, 0.02, 0.03);
  }
}

function tone(ctx, t, type, f0, f1, gain, dur) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

let lastTick = 0;

document.addEventListener('click', e => {
  if (e.target.closest('.chip')) playUI('chip');
  else if (e.target.closest('.btn')) playUI('primary');
  else if (e.target.closest('.reset-btn, .site-nav a, .xmenu__item, .tg-link, .logo, #format-select, .dropzone:not(.has-image)')) playUI('soft');
});

document.addEventListener('input', e => {
  if (e.target.matches('input[type="range"]')) {
    const now = performance.now();
    if (now - lastTick > 70) { lastTick = now; playUI('tick'); }
  }
});

const exportSound = document.getElementById('export-sound');

const FORMATS = {
  png:  { mime: 'image/png',  ext: 'png',  quality: undefined },
  jpeg: { mime: 'image/jpeg', ext: 'jpg',  quality: 0.92 },
  webp: { mime: 'image/webp', ext: 'webp', quality: 0.92 },
};

const formatSelect = document.getElementById('format-select');

function exportSource() {
  const w = sourceImage.width, h = sourceImage.height;
  if (w * h <= MAX_EXPORT_PIXELS) return sourceImage;
  const k = Math.sqrt(MAX_EXPORT_PIXELS / (w * h));
  const c = getScratch('exportFit', Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)));
  c.getContext('2d').drawImage(sourceImage, 0, 0, c.width, c.height);
  return c;
}

btnExport.addEventListener('click', () => {
  if (!sourceImage) return;
  const original = btnExport.textContent;
  btnExport.textContent = 'ОБРАБОТКА…';
  btnExport.disabled = true;

  const fmt = FORMATS[formatSelect.value] || FORMATS.png;

  const done = (message) => {
    btnExport.textContent = original;
    btnExport.disabled = false;
    if (message) imgInfo.textContent = message;
    releaseScratch();
  };

  setTimeout(() => {
    let full;
    try {
      full = getScratch('export', 1, 1);
      renderPipeline(exportSource(), full);
    } catch (err) {
      console.error(err);
      done('не хватило памяти для экспорта');
      return;
    }

    full.toBlob(blob => {
      if (!blob) {
        done(`браузер не умеет сохранять ${fmt.ext.toUpperCase()} — попробуй PNG`);
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}-elliot.${fmt.ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      try {
        exportSound.currentTime = 0;
        exportSound.volume = 0.8;
        exportSound.play().catch(() => {});
      } catch { }

      const flash = document.createElement('div');
      flash.className = 'flash';
      document.body.appendChild(flash);
      flash.addEventListener('animationend', () => flash.remove());
      setTimeout(() => flash.remove(), 1500);

      done();
    }, fmt.mime, fmt.quality);
  }, 30);
});

(function pixelPanelBackgrounds() {
  const CELL = 14;
  const TICK = 130;
  const CHURN = 0.02;

  const PALETTE = [
    [10, 8, 5], [10, 8, 5], [10, 8, 5], [10, 8, 5],
    [13, 11, 5], [13, 11, 5], [13, 11, 5],
    [17, 14, 6], [17, 14, 6],
    [23, 18, 6], [23, 18, 6],
    [30, 24, 7],
    [40, 32, 8],
  ];

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const CORNERS = {
    tl: [3, 6, 1, 2, 1],
    tr: [5, 2, 2, 1],
    br: [6, 2, 2, 1, 1],
    bl: [2, 5, 1, 1],
  };
  const MAXCUT = 7;

  document.querySelectorAll('.panel').forEach(panel => {
    const canvas = document.createElement('canvas');
    canvas.className = 'pixel-bg';
    canvas.setAttribute('aria-hidden', 'true');
    panel.prepend(canvas);
    const ctx = canvas.getContext('2d');

    let cols = 0, rows = 0;
    let inner = [];

    const paintCell = (x, y) => {
      const [r, g, b] = PALETTE[(Math.random() * PALETTE.length) | 0];
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 1, 1);
    };

    const isOutside = (x, y) => {
      const rx = cols - 1 - x, ry = rows - 1 - y;
      if (y < CORNERS.tl.length && x < CORNERS.tl[y]) return true;
      if (y < CORNERS.tr.length && rx < CORNERS.tr[y]) return true;
      if (ry < CORNERS.br.length && rx < CORNERS.br[ry]) return true;
      if (ry < CORNERS.bl.length && x < CORNERS.bl[ry]) return true;
      return false;
    };

    const fill = () => {
      cols = Math.max(MAXCUT * 2 + 2, Math.ceil(panel.offsetWidth / CELL));
      rows = Math.max(MAXCUT * 2 + 2, Math.ceil(panel.offsetHeight / CELL));
      canvas.width = cols;
      canvas.height = rows;
      ctx.clearRect(0, 0, cols, rows);
      inner = [];
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (isOutside(x, y)) continue;
          paintCell(x, y);
          inner.push(y * cols + x);
        }
      }
    };

    fill();
    new ResizeObserver(fill).observe(panel);

    if (reduceMotion) return;

    let timer = null;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !timer) {
        timer = setInterval(() => {
          const n = Math.max(1, Math.round(inner.length * CHURN));
          for (let i = 0; i < n; i++) {
            const idx = inner[(Math.random() * inner.length) | 0];
            paintCell(idx % cols, (idx / cols) | 0);
          }
        }, TICK);
      } else if (!entry.isIntersecting && timer) {
        clearInterval(timer);
        timer = null;
      }
    }, { threshold: 0 });
    io.observe(panel);
  });
})();

(function tiltCard() {
  const card = document.querySelector('.tilt-card');
  if (!card || matchMedia('(pointer: coarse)').matches) return;

  card.addEventListener('mousemove', e => {
    if (card.classList.contains('reveal') && !card.classList.contains('is-visible')) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `perspective(1100px) rotateY(${x * 4}deg) rotateX(${-y * 4}deg)`;
  }, { passive: true });
  card.addEventListener('mouseleave', () => { card.style.transform = ''; });
})();

(function revealOnScroll() {
  const targets = document.querySelectorAll('.panel, .tg-link, .footer__note');
  targets.forEach(el => el.classList.add('reveal'));
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  targets.forEach(el => io.observe(el));
})();
