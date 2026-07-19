/* ============================================================
   LINUX UGUIDE — synthesized retro SFX engine (Web Audio API)
   No audio files: every sound is a short oscillator envelope.
   Respects a persisted mute toggle and lazy-inits on first
   user gesture (autoplay policy).
   ============================================================ */
(function(){
"use strict";
window.DOJO = window.DOJO || {};

var KEY = "uguide_sfx_muted";
var ctx = null;
var muted = false;
try{ muted = localStorage.getItem(KEY) === "1"; }catch(e){}

function ensureCtx(){
  if(!ctx){
    var AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    ctx = new AC();
  }
  if(ctx.state === "suspended") ctx.resume().catch(function(){});
  return ctx;
}

function beep(opts){
  if(muted) return;
  var c = ensureCtx();
  if(!c) return;
  var freq = opts.freq || 440;
  var dur = opts.dur || 0.05;
  var type = opts.type || "square";
  var vol = opts.vol != null ? opts.vol : 0.05;
  var slideTo = opts.slideTo;
  try{
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if(slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(slideTo,1), c.currentTime + dur);
    gain.gain.setValueAtTime(0.0001, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(vol, c.currentTime + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + dur + 0.02);
  }catch(e){}
}

// short white-noise burst (for glitch / static / crash)
function noise(dur, vol, lowpass){
  if(muted) return;
  var c = ensureCtx();
  if(!c) return;
  try{
    var frames = Math.floor(c.sampleRate * dur);
    var buf = c.createBuffer(1, frames, c.sampleRate);
    var data = buf.getChannelData(0);
    for(var i=0;i<frames;i++) data[i] = Math.random()*2 - 1;
    var src = c.createBufferSource(); src.buffer = buf;
    var g = c.createGain();
    g.gain.setValueAtTime(vol || 0.08, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    var node = src;
    if(lowpass){
      var f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lowpass;
      src.connect(f); node = f;
    }
    node.connect(g); g.connect(c.destination);
    src.start(c.currentTime); src.stop(c.currentTime + dur + 0.02);
  }catch(e){}
}

var lastTick = 0;
DOJO.sfx = {
  init: function(){ ensureCtx(); },
  isMuted: function(){ return muted; },
  setMuted: function(v){
    muted = !!v;
    try{ localStorage.setItem(KEY, muted ? "1" : "0"); }catch(e){}
  },
  toggleMute: function(){ this.setMuted(!muted); return muted; },
  // a single typewriter character revealing
  tick: function(){
    var now = performance.now();
    if(now - lastTick < 12) return; // throttle for very fast typing bursts
    lastTick = now;
    beep({freq: 1500 + Math.random()*500, dur:0.012, type:"square", vol:0.025});
  },
  // physical keydown in the input field
  key: function(){
    beep({freq: 700 + Math.random()*120, dur:0.018, type:"square", vol:0.035});
  },
  // Enter / command submitted
  submit: function(){
    beep({freq:520, dur:0.05, type:"square", vol:0.05, slideTo:900});
  },
  success: function(){
    beep({freq:660, dur:0.05, type:"triangle", vol:0.05, slideTo:990});
    setTimeout(function(){ beep({freq:990, dur:0.07, type:"triangle", vol:0.045}); }, 60);
  },
  error: function(){
    beep({freq:220, dur:0.09, type:"sawtooth", vol:0.05, slideTo:90});
  },
  click: function(){
    beep({freq:340, dur:0.03, type:"square", vol:0.04});
  },
  open: function(){
    beep({freq:300, dur:0.06, type:"triangle", vol:0.04, slideTo:700});
  },
  close: function(){
    beep({freq:700, dur:0.06, type:"triangle", vol:0.04, slideTo:250});
  },
  // ---- dramatic self-destruct sounds ----
  glitch: function(){
    noise(0.08 + Math.random()*0.06, 0.07);
    beep({freq: 90 + Math.random()*120, dur:0.06, type:"sawtooth", vol:0.05, slideTo:40});
  },
  alarm: function(){
    beep({freq:880, dur:0.28, type:"sawtooth", vol:0.05, slideTo:220});
    setTimeout(function(){ beep({freq:660, dur:0.28, type:"sawtooth", vol:0.05, slideTo:180}); }, 150);
  },
  crash: function(){
    noise(0.5, 0.11, 900);
    beep({freq:70, dur:0.6, type:"square", vol:0.07, slideTo:28});
  },
  powerdown: function(){
    beep({freq:760, dur:0.55, type:"triangle", vol:0.06, slideTo:34});
    noise(0.2, 0.03, 500);
  },
  bootbeep: function(){
    beep({freq:1046, dur:0.12, type:"square", vol:0.05});
  }
};
})();
