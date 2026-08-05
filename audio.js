'use strict';

(function liquidAmethystBackground() {
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
      col = mix(col, vec3(0.14, 0.03, 0.24), smoothstep(0.05, 0.4, lum));
      col = mix(col, vec3(0.55, 0.19, 0.93), smoothstep(0.35, 0.75, lum));
      col = mix(col, vec3(0.90, 0.78, 1.0), smoothstep(0.75, 1.0, lum));

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

(function pixelPanelBackgrounds() {
  const CELL = 14;
  const TICK = 130;
  const CHURN = 0.02;

  const PALETTE = [
    [9, 6, 13], [9, 6, 13], [9, 6, 13], [9, 6, 13],
    [12, 8, 18], [12, 8, 18], [12, 8, 18],
    [16, 10, 24], [16, 10, 24],
    [21, 13, 32], [21, 13, 32],
    [28, 17, 42],
    [37, 22, 56],
  ];

  const CORNERS = {
    tl: [3, 6, 1, 2, 1],
    tr: [5, 2, 2, 1],
    br: [6, 2, 2, 1, 1],
    bl: [2, 5, 1, 1],
  };
  const MAXCUT = 7;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

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

const state = {
  speed: 100, pitch: 0, reverb: 0, crush: 0,
  distortion: 0, echo: 0, underwater: 0, tremolo: 0,
};
const DEFAULTS = { ...state };

let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

let originalBuffer = null;
let processedBuffer = null;
let playingSource = null;
let fileName = 'track';
let stale = true;

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const dzIdle = document.getElementById('dz-idle');
const waveWrap = document.getElementById('wave-wrap');
const waveCanvas = document.getElementById('wave');
const trackInfo = document.getElementById('track-info');
const procHint = document.getElementById('proc-hint');
const btnProcess = document.getElementById('btn-process');
const btnPlay = document.getElementById('btn-play');
const btnExport = document.getElementById('btn-export');
const btnNew = document.getElementById('btn-new');
const btnReset = document.getElementById('btn-reset');
const formatSelect = document.getElementById('format-select');
const exportSound = document.getElementById('export-sound');
const metaArtist = document.getElementById('meta-artist');
const metaTitle = document.getElementById('meta-title');
const coverInput = document.getElementById('cover-input');
const btnCover = document.getElementById('btn-cover');
const coverPreview = document.getElementById('cover-preview');

let coverBytes = null;
let coverMime = '';
let coverUrl = '';

const MAX_COVER_BYTES = 8 * 1024 * 1024;

btnCover.addEventListener('click', () => coverInput.click());
coverInput.addEventListener('change', async () => {
  const f = coverInput.files[0];
  coverInput.value = '';
  if (!f) return;
  if (!f.type.startsWith('image/')) {
    procHint.textContent = 'обложка должна быть картинкой';
    return;
  }
  if (f.size > MAX_COVER_BYTES) {
    procHint.textContent = `обложка тяжелее ${MAX_COVER_BYTES / 1024 / 1024} МБ`;
    return;
  }
  coverBytes = new Uint8Array(await f.arrayBuffer());
  coverMime = f.type || 'image/jpeg';
  if (coverUrl) URL.revokeObjectURL(coverUrl);
  coverUrl = URL.createObjectURL(f);
  coverPreview.src = coverUrl;
  coverPreview.hidden = false;
  btnCover.textContent = '↺ Обложка';
});

if (typeof lamejs === 'undefined') {
  formatSelect.querySelector('option[value="mp3"]').disabled = true;
}

dropzone.addEventListener('click', () => { if (!originalBuffer) fileInput.click(); });

dropzone.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  if (e.target.closest('.wave-wrap')) return;
  e.preventDefault();
  if (!originalBuffer) fileInput.click();
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
  if (file) loadFile(file);
});

const MAX_FILE_BYTES = 150 * 1024 * 1024;
const MAX_DURATION_SEC = 15 * 60;

async function loadFile(file) {
  if (file.size > MAX_FILE_BYTES) {
    trackInfo.textContent = `слишком большой файл (>${Math.round(MAX_FILE_BYTES / 1024 / 1024)} МБ)`;
    return;
  }

  fileName = (file.name || 'track').replace(/\.[^.]+$/, '');
  trackInfo.textContent = 'декодирую…';

  let decoded;
  try {
    const data = await file.arrayBuffer();
    decoded = await getAudioCtx().decodeAudioData(data);
  } catch {
    trackInfo.textContent = 'не удалось декодировать файл';
    return;
  }

  if (decoded.duration > MAX_DURATION_SEC) {
    trackInfo.textContent = `трек длиннее ${MAX_DURATION_SEC / 60} минут — браузер не потянет`;
    return;
  }

  stopPlayback();
  playOffset = 0;
  originalBuffer = null;
  processedBuffer = null;
  originalBuffer = decoded;
  stale = true;

  dzIdle.hidden = true;
  waveWrap.hidden = false;
  dropzone.classList.add('has-image');
  dropzone.setAttribute('aria-label', `Трек загружен: ${file.name}`);
  btnNew.hidden = false;
  btnProcess.disabled = false;
  btnPlay.disabled = false;
  btnExport.disabled = false;
  updateStaleUI();

  trackInfo.textContent = `${file.name} — ${originalBuffer.duration.toFixed(1)}с · ${originalBuffer.numberOfChannels}ch`;
  drawWave(originalBuffer, false);
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

  input.addEventListener('input', () => { sync(); markStale(); });
  sync();
});

const PRESETS = {
  chipmunk: { speed: 115, pitch: 7 },
  demon:    { speed: 90, pitch: -7, reverb: 40 },
  '8bit':   { crush: 70, distortion: 10 },
  cave:     { reverb: 80, echo: 45 },
  diver:    { underwater: 85, reverb: 25, tremolo: 10 },
};

document.querySelectorAll('.chip').forEach(chip =>
  chip.addEventListener('click', () => applyValues({ ...DEFAULTS, ...PRESETS[chip.dataset.preset] })));

btnReset.addEventListener('click', () => applyValues(DEFAULTS));

function applyValues(values) {
  document.querySelectorAll('#controls input[type="range"]').forEach(input => {
    input.value = values[input.dataset.key];
    input.dispatchEvent(new Event('input'));
  });
}

function markStale() { stale = true; updateStaleUI(); }

function updateStaleUI() {
  btnProcess.classList.toggle('is-stale', stale && !!originalBuffer);
  procHint.textContent = originalBuffer
    ? (stale ? 'настройки изменены — нажми «обработать»' : 'готово: слушай или скачивай')
    : '';
}

function resample(data, factor) {
  const outLen = Math.max(1, Math.floor(data.length / factor));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const p = i * factor;
    const i0 = p | 0;
    const frac = p - i0;
    out[i] = data[i0] * (1 - frac) + (data[i0 + 1] || 0) * frac;
  }
  return out;
}

function pitchShift(data, factor) {
  const GRAIN = 4096, HOP = GRAIN / 2;
  const out = new Float32Array(data.length);
  const win = new Float32Array(GRAIN);
  for (let i = 0; i < GRAIN; i++) win[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / GRAIN));

  for (let start = 0; start < data.length; start += HOP) {
    for (let j = 0; j < GRAIN; j++) {
      const oi = start + j;
      if (oi >= data.length) break;
      const p = start + j * factor;
      const i0 = p | 0;
      if (i0 >= data.length) break;
      const frac = p - i0;
      const s = data[i0] * (1 - frac) + (data[i0 + 1] || 0) * frac;
      out[oi] += s * win[j];
    }
  }
  return out;
}

function bitcrush(data, amount) {
  const bits = 12 - (amount / 100) * 9;
  const step = 2 / Math.pow(2, bits);
  const hold = 1 + Math.round((amount / 100) * 24);
  let held = 0;
  for (let i = 0; i < data.length; i++) {
    if (i % hold === 0) held = Math.round(data[i] / step) * step;
    data[i] = held;
  }
}

function distort(data, amount) {
  const k = 1 + (amount / 100) * 22;
  const norm = Math.tanh(k);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.tanh(data[i] * k) / norm;
  }
}

function tremolo(data, amount, sr) {
  const depth = amount / 100;
  const w = 2 * Math.PI * 5.5 / sr;
  for (let i = 0; i < data.length; i++) {
    data[i] *= 1 - depth * 0.5 * (1 + Math.sin(w * i));
  }
}

function underwater(data, amount, sr) {
  const mix = amount / 100;
  const cutoff = 3800 - 3400 * mix;
  const a = Math.exp(-2 * Math.PI * cutoff / sr);
  const maxDelay = Math.max(2, Math.round(sr * 0.004));
  const bufLen = maxDelay + 4;
  const buf = new Float32Array(bufLen);
  const lfoW = 2 * Math.PI * 0.7 / sr;
  let w = 0, lp = 0;
  for (let i = 0; i < data.length; i++) {
    lp = (1 - a) * data[i] + a * lp;
    buf[w] = lp;
    const d = (1 + Math.sin(lfoW * i)) * 0.5 * (maxDelay - 2) * mix + 1;
    let rp = w - d;
    if (rp < 0) rp += bufLen;
    const i0 = rp | 0;
    const frac = rp - i0;
    const wobble = buf[i0] * (1 - frac) + buf[(i0 + 1) % bufLen] * frac;
    data[i] = data[i] * (1 - mix) + wobble * mix;
    w = (w + 1) % bufLen;
  }
}

function echo(data, amount, sr) {
  const mix = amount / 100;
  const delay = Math.round(sr * 0.28);
  const fb = 0.35 + mix * 0.25;
  for (let i = delay; i < data.length; i++) {
    data[i] += data[i - delay] * fb * mix;
  }
}

function reverb(data, amount, sr) {
  const wet = amount / 100;
  const combDelays = [0.0297, 0.0371, 0.0411, 0.0437].map(t => Math.round(t * sr));
  const combFb = 0.805;
  const wetSig = new Float32Array(data.length);

  for (const d of combDelays) {
    const buf = new Float32Array(d);
    let idx = 0;
    for (let i = 0; i < data.length; i++) {
      const y = buf[idx];
      buf[idx] = data[i] + y * combFb;
      wetSig[i] += y / combDelays.length;
      idx = (idx + 1) % d;
    }
  }

  for (const t of [0.005, 0.0017]) {
    const d = Math.round(t * sr), g = 0.7;
    const buf = new Float32Array(d);
    let idx = 0;
    for (let i = 0; i < wetSig.length; i++) {
      const bufOut = buf[idx];
      const y = -g * wetSig[i] + bufOut;
      buf[idx] = wetSig[i] + g * y;
      wetSig[i] = y;
      idx = (idx + 1) % d;
    }
  }

  for (let i = 0; i < data.length; i++) {
    data[i] = data[i] * (1 - wet * 0.6) + wetSig[i] * wet * 0.9;
  }
}

function processAudio() {
  const sr = originalBuffer.sampleRate;
  const nCh = Math.min(2, originalBuffer.numberOfChannels);
  const speed = state.speed / 100;
  const pitchFactor = Math.pow(2, state.pitch / 12);

  const tail = Math.round(sr * ((state.reverb > 0 ? 1.6 : 0) + (state.echo > 0 ? 0.9 : 0)));

  const chans = [];
  for (let c = 0; c < nCh; c++) {
    let d = Float32Array.from(originalBuffer.getChannelData(c));
    if (state.pitch !== 0) d = pitchShift(d, pitchFactor);
    if (speed !== 1) d = resample(d, speed);

    const padded = new Float32Array(d.length + tail);
    padded.set(d);
    d = padded;

    if (state.distortion > 0) distort(d, state.distortion);
    if (state.crush > 0) bitcrush(d, state.crush);
    if (state.underwater > 0) underwater(d, state.underwater, sr);
    if (state.tremolo > 0) tremolo(d, state.tremolo, sr);
    if (state.echo > 0) echo(d, state.echo, sr);
    if (state.reverb > 0) reverb(d, state.reverb, sr);

    for (let i = 0; i < d.length; i++) {
      const v = d[i];
      d[i] = v > 1 ? 1 : v < -1 ? -1 : v;
    }
    chans.push(d);
  }

  const ctx = getAudioCtx();
  const out = ctx.createBuffer(nCh, chans[0].length, sr);
  for (let c = 0; c < nCh; c++) out.getChannelData(c).set(chans[c]);
  return out;
}

btnProcess.addEventListener('click', () => {
  if (!originalBuffer) return;
  stopPlayback();
  playOffset = 0;
  btnProcess.textContent = 'ОБРАБОТКА…';
  btnProcess.disabled = true;

  setTimeout(() => {
    try {
      processedBuffer = processAudio();
      stale = false;
      drawWave(processedBuffer, true);
      trackInfo.textContent = trackInfo.textContent.replace(/ · обработано.*$/, '') + ` · обработано ${processedBuffer.duration.toFixed(1)}с`;
    } catch (err) {
      console.error(err);
      processedBuffer = null;
      procHint.textContent = 'не хватило памяти — попробуй трек покороче или меньше эффектов';
      return;
    } finally {
      btnProcess.textContent = 'ОБРАБОТАТЬ';
      btnProcess.disabled = false;
    }
    updateStaleUI();
  }, 30);
});

let playOffset = 0;
let playStartCtx = 0;
let progressRaf = 0;

function currentBuf() { return processedBuffer || originalBuffer; }

function playbackPos() {
  if (!playingSource) return playOffset;
  return playOffset + (getAudioCtx().currentTime - playStartCtx);
}

function startPlayback(offset) {
  const buf = currentBuf();
  if (!buf) return;
  const ctx = getAudioCtx();
  playOffset = Math.max(0, Math.min(offset, buf.duration - 0.01));
  playingSource = ctx.createBufferSource();
  playingSource.buffer = buf;
  playingSource.connect(ctx.destination);
  playingSource.onended = () => {
    playingSource = null;
    playOffset = 0;
    stopPlayback();
  };
  playStartCtx = ctx.currentTime;
  playingSource.start(0, playOffset);
  setPlayUI(true);
  cancelAnimationFrame(progressRaf);
  (function tickProgress() {
    if (!playingSource) return;
    drawWave(currentBuf(), !!processedBuffer, playbackPos() / currentBuf().duration);
    progressRaf = requestAnimationFrame(tickProgress);
  })();
}

btnPlay.addEventListener('click', () => {
  if (playingSource) { stopPlayback(); return; }
  startPlayback(playOffset);
});

function seekTo(frac) {
  const buf = currentBuf();
  if (!buf) return;
  frac = Math.max(0, Math.min(1, frac));
  const wasPlaying = !!playingSource;
  if (wasPlaying) {
    playingSource.onended = null;
    try { playingSource.stop(); } catch { }
    playingSource = null;
  }
  playOffset = frac * buf.duration;
  drawWave(buf, !!processedBuffer, frac);
  if (wasPlaying) startPlayback(playOffset);
}

waveWrap.addEventListener('click', e => {
  const r = waveWrap.getBoundingClientRect();
  seekTo((e.clientX - r.left) / r.width);
});

waveWrap.addEventListener('keydown', e => {
  const buf = currentBuf();
  if (!buf) return;
  const cur = playbackPos() / buf.duration;
  const stepFrac = 5 / buf.duration;
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') seekTo(cur + stepFrac);
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') seekTo(cur - stepFrac);
  else if (e.key === 'Home') seekTo(0);
  else if (e.key === 'End') seekTo(1);
  else return;
  e.preventDefault();
});

function setPlayUI(playing) {
  btnPlay.querySelector('.t-ico').className = 't-ico ' + (playing ? 't-ico--stop' : 't-ico--play');
  document.getElementById('play-label').textContent = playing ? 'СТОП' : 'СЛУШАТЬ';
}

function stopPlayback() {
  if (playingSource) {
    playOffset = Math.min(playbackPos(), currentBuf() ? currentBuf().duration : 0);
    playingSource.onended = null;
    try { playingSource.stop(); } catch { }
    playingSource = null;
  }
  cancelAnimationFrame(progressRaf);
  const buf = currentBuf();
  if (buf) drawWave(buf, !!processedBuffer, playOffset / buf.duration);
  setPlayUI(false);
}

let lastWave = null;

function fitWave() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(waveCanvas.clientWidth * dpr));
  const h = Math.max(1, Math.round(waveCanvas.clientHeight * dpr));
  if (waveCanvas.width === w && waveCanvas.height === h) return false;
  waveCanvas.width = w;
  waveCanvas.height = h;
  return true;
}

new ResizeObserver(() => {
  if (fitWave() && lastWave) drawWave(lastWave.buffer, lastWave.processed, lastWave.progress);
}).observe(waveCanvas);

function drawWave(buffer, processed, progress = 0) {
  lastWave = { buffer, processed, progress };
  if (waveWrap.hidden) return;
  fitWave();

  const W = waveCanvas.width, H = waveCanvas.height;
  const ctx2d = waveCanvas.getContext('2d');
  ctx2d.clearRect(0, 0, W, H);

  const data = buffer.getChannelData(0);
  const perBar = Math.max(1, Math.floor(data.length / W));
  const step = Math.max(1, Math.floor(perBar / 24));
  const playX = Math.round(progress * W);
  const half = H / 2;

  for (let x = 0; x < W; x++) {
    let peak = 0;
    const s = x * perBar;
    const end = Math.min(s + perBar, data.length);
    for (let i = s; i < end; i += step) {
      const v = data[i] < 0 ? -data[i] : data[i];
      if (v > peak) peak = v;
    }
    const h = Math.max(1, Math.round(peak * (half - 1)));
    const played = x < playX;
    ctx2d.fillStyle = processed
      ? (played ? '#f3e8ff' : (x % 2 ? '#c084fc' : '#a855f7'))
      : (played ? '#b9a8d6' : (x % 2 ? '#5b4a75' : '#4a3b61'));
    ctx2d.fillRect(x, half - h, 1, h * 2);
  }

  if (progress > 0 && progress < 1) {
    ctx2d.fillStyle = '#ffffff';
    ctx2d.fillRect(playX, 0, Math.max(1, Math.round(H / 110)), H);
  }

  waveWrap.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
}

function bufferToInt16(buffer) {
  const nCh = buffer.numberOfChannels;
  const chans = [];
  for (let c = 0; c < nCh; c++) {
    const f = buffer.getChannelData(c);
    const int16 = new Int16Array(f.length);
    for (let i = 0; i < f.length; i++) {
      const v = Math.max(-1, Math.min(1, f[i]));
      int16[i] = v < 0 ? v * 0x8000 : v * 0x7FFF;
    }
    chans.push(int16);
  }
  return chans;
}

function buildId3(title, artist) {
  const frames = [];

  const utf16 = s => {
    const out = [1, 0xFF, 0xFE];
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      out.push(c & 0xFF, (c >> 8) & 0xFF);
    }
    out.push(0, 0);
    return Uint8Array.from(out);
  };

  const frame = (id, payload) => {
    const head = new Uint8Array(10);
    for (let i = 0; i < 4; i++) head[i] = id.charCodeAt(i);
    const n = payload.length;
    head[4] = (n >> 24) & 0xFF; head[5] = (n >> 16) & 0xFF;
    head[6] = (n >> 8) & 0xFF; head[7] = n & 0xFF;
    frames.push(head, payload);
  };

  if (title) frame('TIT2', utf16(title));
  if (artist) frame('TPE1', utf16(artist));
  if (coverBytes) {
    const mime = coverMime.includes('png') ? 'image/png' : 'image/jpeg';
    const head = [0];
    for (const ch of mime) head.push(ch.charCodeAt(0));
    head.push(0, 3, 0);
    const pic = new Uint8Array(head.length + coverBytes.length);
    pic.set(head);
    pic.set(coverBytes, head.length);
    frame('APIC', pic);
  }
  if (!frames.length) return null;

  const size = frames.reduce((s, a) => s + a.length, 0);
  const tag = new Uint8Array(10 + size);
  tag[0] = 0x49; tag[1] = 0x44; tag[2] = 0x33;
  tag[3] = 3;
  tag[6] = (size >> 21) & 0x7F; tag[7] = (size >> 14) & 0x7F;
  tag[8] = (size >> 7) & 0x7F; tag[9] = size & 0x7F;
  let off = 10;
  for (const a of frames) { tag.set(a, off); off += a.length; }
  return tag;
}

function buildWavInfo(title, artist) {
  const items = [];
  const add = (id, text) => {
    if (!text) return;
    const bytes = new TextEncoder().encode(text + '\0');
    const padded = bytes.length % 2 ? bytes.length + 1 : bytes.length;
    const chunk = new Uint8Array(8 + padded);
    for (let i = 0; i < 4; i++) chunk[i] = id.charCodeAt(i);
    new DataView(chunk.buffer).setUint32(4, bytes.length, true);
    chunk.set(bytes, 8);
    items.push(chunk);
  };
  add('INAM', title);
  add('IART', artist);
  if (!items.length) return null;
  const size = items.reduce((s, a) => s + a.length, 0) + 4;
  const list = new Uint8Array(8 + size);
  const dv = new DataView(list.buffer);
  for (let i = 0; i < 4; i++) list[i] = 'LIST'.charCodeAt(i);
  dv.setUint32(4, size, true);
  for (let i = 0; i < 4; i++) list[8 + i] = 'INFO'.charCodeAt(i);
  let off = 12;
  for (const a of items) { list.set(a, off); off += a.length; }
  return list;
}

function encodeWav(buffer) {
  const nCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const chans = bufferToInt16(buffer);
  const frames = chans[0].length;
  const dataSize = frames * nCh * 2;
  const ab = new ArrayBuffer(44 + dataSize);
  const dv = new DataView(ab);

  const wstr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  wstr(0, 'RIFF'); dv.setUint32(4, 36 + dataSize, true); wstr(8, 'WAVE');
  wstr(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
  dv.setUint16(22, nCh, true); dv.setUint32(24, sr, true);
  dv.setUint32(28, sr * nCh * 2, true); dv.setUint16(32, nCh * 2, true);
  dv.setUint16(34, 16, true); wstr(36, 'data'); dv.setUint32(40, dataSize, true);

  let off = 44;
  for (let i = 0; i < frames; i++)
    for (let c = 0; c < nCh; c++) { dv.setInt16(off, chans[c][i], true); off += 2; }

  const info = buildWavInfo(metaTitle.value.trim(), metaArtist.value.trim());
  if (info) {
    dv.setUint32(4, 36 + dataSize + info.length, true);
    return new Blob([ab, info], { type: 'audio/wav' });
  }
  return new Blob([ab], { type: 'audio/wav' });
}

function encodeMp3(buffer) {
  const nCh = buffer.numberOfChannels;
  const chans = bufferToInt16(buffer);
  const enc = new lamejs.Mp3Encoder(nCh, buffer.sampleRate, 128);
  const CHUNK = 1152;
  const parts = [];
  for (let i = 0; i < chans[0].length; i += CHUNK) {
    const l = chans[0].subarray(i, i + CHUNK);
    const r = nCh > 1 ? chans[1].subarray(i, i + CHUNK) : l;
    const d = nCh > 1 ? enc.encodeBuffer(l, r) : enc.encodeBuffer(l);
    if (d.length) parts.push(d);
  }
  const end = enc.flush();
  if (end.length) parts.push(end);
  const tag = buildId3(metaTitle.value.trim(), metaArtist.value.trim());
  return new Blob(tag ? [tag, ...parts] : parts, { type: 'audio/mpeg' });
}

btnExport.addEventListener('click', () => {
  if (!originalBuffer) return;
  const original = btnExport.textContent;
  btnExport.textContent = 'ОБРАБОТКА…';
  btnExport.disabled = true;

  setTimeout(() => {
    try {
      if (!processedBuffer || stale) {
        processedBuffer = processAudio();
        stale = false;
        drawWave(processedBuffer, true);
        updateStaleUI();
      }
      const fmt = formatSelect.value;
      const blob = fmt === 'mp3' && typeof lamejs !== 'undefined'
        ? encodeMp3(processedBuffer)
        : encodeWav(processedBuffer);
      const ext = fmt === 'mp3' ? 'mp3' : 'wav';

      const artist = metaArtist.value.trim();
      const title = metaTitle.value.trim();
      const safe = s => s.replace(/[\\/:*?"<>|]/g, '')
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .replace(/^[.\s]+|[.\s]+$/g, '')
        .slice(0, 100);
      const base = safe([artist, title].filter(Boolean).join(' - ')) || `${fileName}-elliot`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${base}.${ext}`;
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
    } catch (err) {
      console.error(err);
      procHint.textContent = 'не хватило памяти для экспорта — попробуй трек покороче';
    } finally {
      btnExport.textContent = original;
      btnExport.disabled = false;
    }
  }, 30);
});

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
