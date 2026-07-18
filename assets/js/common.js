/* ============================================================
   LINUX DOJO — shared behaviour: music player + scroll reveal
   ============================================================ */
(function(){
"use strict";
window.DOJO = window.DOJO || {};
var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
DOJO.reduced = reduced;

/* ---------- scroll reveal ---------- */
DOJO.initReveal = function(){
  var io = new IntersectionObserver(function(es){
    es.forEach(function(e){
      if(e.isIntersecting){ e.target.classList.add("on"); io.unobserve(e.target); }
    });
  },{threshold:.12, rootMargin:"0px 0px -40px 0px"});
  document.querySelectorAll(".reveal").forEach(function(el){ io.observe(el); });
};

/* ---------- chiptune music player ---------- */
DOJO.initPlayer = function(tracks){
  var el = document.getElementById("player");
  if(!el) return;
  var audio = new Audio();
  audio.preload = "metadata";
  var i = 0, playing = false;
  var nameEl = el.querySelector(".player-track"),
      seek   = el.querySelector(".player-seek"),
      curEl  = el.querySelector(".cur"),
      durEl  = el.querySelector(".dur"),
      playBtn= el.querySelector(".play"),
      bar    = el.querySelector(".player-bar");

  function fmt(s){ if(isNaN(s)) return "0:00"; var m=Math.floor(s/60), x=Math.floor(s%60); return m+":"+(x<10?"0":"")+x; }
  function load(n){
    i = (n + tracks.length) % tracks.length;
    audio.src = tracks[i].src;
    nameEl.innerHTML = "<b>&#9654; "+String(i+1).padStart(2,"0")+"</b> "+tracks[i].title;
    if(playing) audio.play().catch(function(){});
  }
  function setPlaying(p){
    playing = p;
    el.classList.toggle("paused", !p);
    playBtn.textContent = p ? "❚❚" : "►";
  }
  function toggle(){
    if(playing){ audio.pause(); setPlaying(false); }
    else{ audio.play().then(function(){ setPlaying(true); }).catch(function(){ setPlaying(false); }); }
  }
  playBtn.addEventListener("click", toggle);
  el.querySelector(".prev").addEventListener("click", function(){ load(i-1); });
  el.querySelector(".next").addEventListener("click", function(){ load(i+1); });
  audio.addEventListener("timeupdate", function(){
    if(audio.duration){ seek.value = (audio.currentTime/audio.duration)*100; }
    curEl.textContent = fmt(audio.currentTime);
  });
  audio.addEventListener("loadedmetadata", function(){ durEl.textContent = fmt(audio.duration); });
  audio.addEventListener("ended", function(){ load(i+1); });
  seek.addEventListener("input", function(){ if(audio.duration) audio.currentTime = (seek.value/100)*audio.duration; });
  bar.addEventListener("click", function(e){
    if(e.target.closest(".player-toggle-play")){ toggle(); return; }
    el.classList.toggle("min");
    bar.querySelector(".chev").textContent = el.classList.contains("min") ? "▲" : "▼";
  });
  // expose a way for the terminal `play` command to control it
  DOJO.player = { toggle:toggle, next:function(){load(i+1);}, prev:function(){load(i-1);}, play:function(){ if(!playing) toggle(); }, isPlaying:function(){return playing;} };
  setPlaying(false);
  load(0);
  el.classList.add("min");
};

/* ---------- page navigation with a quick wipe ---------- */
DOJO.go = function(href){
  if(reduced){ location.href = href; return; }
  var w = document.createElement("div");
  w.setAttribute("aria-hidden","true");
  w.style.cssText = "position:fixed;inset:0;z-index:999;background:#0d0d10;display:flex;align-items:center;justify-content:center;"+
    "font-family:'ProgressPixel',monospace;color:#5bc873;font-size:16px;opacity:0;transition:opacity .28s ease";
  w.textContent = "loading "+href+" …";
  document.body.appendChild(w);
  requestAnimationFrame(function(){ w.style.opacity = "1"; });
  setTimeout(function(){ location.href = href; }, 300);
};

})();
