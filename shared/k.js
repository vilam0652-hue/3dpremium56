/* КАПЛЯ — общий движок: хранилище, капельки-монетки, звуки, конфетти, окна. */
(function () {
  "use strict";
  const K = (window.K = {});

  /* ---------- хранилище (может быть заблокировано — тогда работаем в памяти) ---------- */
  const mem = {};
  K.store = {
    get(key, def) {
      try { const v = localStorage.getItem("kaplya:" + key); return v == null ? def : JSON.parse(v); }
      catch (e) { return key in mem ? mem[key] : def; }
    },
    set(key, val) {
      mem[key] = val;
      try { localStorage.setItem("kaplya:" + key, JSON.stringify(val)); } catch (e) { /* память */ }
    }
  };

  /* ---------- иконка капли ---------- */
  K.dropSVG = (cls = "drop-ico") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><defs><radialGradient id="kd" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="#9ff3ff"/><stop offset="1" stop-color="#1f8bff"/></radialGradient></defs><path d="M12 2.5C9 7 5.5 10.6 5.5 14.6a6.5 6.5 0 0 0 13 0C18.5 10.6 15 7 12 2.5z" fill="url(#kd)" stroke="rgba(255,255,255,.8)" stroke-width=".8"/><ellipse cx="9.6" cy="13" rx="1.5" ry="2.4" fill="#fff" opacity=".75"/></svg>`;

  /* ---------- капельки (общая валюта всех игр) ---------- */
  K.coins = {
    get: () => K.store.get("coins", 0),
    add(n, fromEl) {
      n = Math.max(0, Math.round(n));
      if (!n) return;
      if (K.isPlus()) n = Math.round(n * 2);
      K.store.set("coins", K.coins.get() + n);
      const w = document.querySelector(".k-wallet");
      if (fromEl && w) flyDrops(fromEl, w, Math.min(8, n));
      setTimeout(renderWallet, fromEl ? 650 : 0);
      return n;
    },
    spend(n) {
      const c = K.coins.get();
      if (c < n) return false;
      K.store.set("coins", c - n); renderWallet(); return true;
    }
  };
  function renderWallet() {
    document.querySelectorAll(".k-wallet b").forEach((b) => { b.textContent = K.coins.get(); });
    const w = document.querySelector(".k-wallet");
    if (w) { w.classList.remove("bump"); void w.offsetWidth; w.classList.add("bump"); }
  }
  function flyDrops(fromEl, toEl, n) {
    const a = fromEl.getBoundingClientRect ? fromEl.getBoundingClientRect() : { left: fromEl.x, top: fromEl.y, width: 0, height: 0 };
    const b = toEl.getBoundingClientRect();
    for (let i = 0; i < n; i++) {
      const d = document.createElement("div");
      d.className = "fly-drop"; d.innerHTML = K.dropSVG("");
      d.firstChild.style.cssText = "width:100%;height:100%";
      document.body.appendChild(d);
      const sx = a.left + a.width / 2 + (Math.random() - .5) * 60, sy = a.top + a.height / 2 + (Math.random() - .5) * 40;
      const ex = b.left + 16, ey = b.top + 8;
      const anim = d.animate([
        { transform: `translate(${sx}px,${sy}px) scale(.4)`, opacity: 0 },
        { transform: `translate(${sx + (Math.random() - .5) * 80}px,${sy - 60}px) scale(1.1)`, opacity: 1, offset: .35 },
        { transform: `translate(${ex}px,${ey}px) scale(.6)`, opacity: .9 }
      ], { duration: 700 + i * 60, easing: "cubic-bezier(.5,0,.3,1)" });
      anim.onfinish = () => d.remove();
    }
  }

  /* ---------- рекорды ---------- */
  K.best = (id, score) => {
    const all = K.store.get("best", {});
    const prev = all[id] || 0;
    if (score > prev) { all[id] = score; K.store.set("best", all); return true; }
    return false;
  };
  K.getBest = (id) => K.store.get("best", {})[id] || 0;

  /* ---------- Капля+ ---------- */
  K.isPlus = () => !!K.store.get("plus", false);

  /* ---------- звук (синтез, без файлов) ---------- */
  let ac = null;
  K.muted = () => K.store.get("muted", false);
  function ctx() {
    if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ac = new A(); }
    if (ac.state === "suspended") ac.resume();
    return ac;
  }
  function tone(f, t0, dur, type = "sine", vol = .18, slide = 0) {
    const c = ctx(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, c.currentTime + t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), c.currentTime + t0 + dur);
    g.gain.setValueAtTime(.0001, c.currentTime + t0);
    g.gain.exponentialRampToValueAtTime(vol, c.currentTime + t0 + .012);
    g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + t0 + dur);
    o.connect(g).connect(c.destination); o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + dur + .05);
  }
  K.sfx = (name, k = 1) => {
    if (K.muted()) return;
    try {
      switch (name) {
        case "tap": tone(660, 0, .07, "triangle", .1); break;
        case "pop": tone(420 * k, 0, .14, "sine", .22, 2.4); break;
        case "place": tone(260, 0, .09, "triangle", .16, 1.3); break;
        case "good": tone(660, 0, .1, "triangle", .16); tone(990, .08, .16, "triangle", .16); break;
        case "bad": tone(220, 0, .22, "sawtooth", .08, .6); break;
        case "clear": [523, 659, 784, 1046].forEach((f, i) => tone(f * k, i * .06, .18, "triangle", .14)); break;
        case "coin": tone(1320, 0, .06, "square", .05); tone(1760, .05, .12, "square", .05); break;
        case "win": [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, i * .1, .3, "triangle", .15)); break;
        case "lose": [392, 330, 262, 196].forEach((f, i) => tone(f, i * .14, .28, "triangle", .14)); break;
        case "boom": tone(140, 0, .5, "sawtooth", .16, .25); break;
      }
    } catch (e) { /* звук не обязателен */ }
  };
  K.vibrate = (ms = 12) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* нет */ } };

  /* ---------- конфетти и брызги (общий слой) ---------- */
  let fx = null, fxc = null, parts = [], fxRun = false;
  function fxLayer() {
    if (fx) return;
    fx = document.createElement("canvas");
    fx.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:70";
    document.body.appendChild(fx); fxc = fx.getContext("2d");
    const rs = () => { const d = Math.min(2, devicePixelRatio || 1); fx.width = innerWidth * d; fx.height = innerHeight * d; fxc.setTransform(d, 0, 0, d, 0, 0); };
    rs(); addEventListener("resize", rs);
  }
  const PAL = ["#5ee7ff", "#ff5fa2", "#ffd84d", "#6dffa8", "#a68bff", "#ff9a4d", "#ffffff"];
  K.burst = (x, y, n = 24, colors = PAL, opt = {}) => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    fxLayer();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (opt.speed || 6) * (.4 + Math.random());
      parts.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (opt.up || 2),
        r: (opt.size || 5) * (.5 + Math.random()), c: colors[(Math.random() * colors.length) | 0],
        life: 1, decay: .012 + Math.random() * .02, rot: Math.random() * 6, vr: (Math.random() - .5) * .4,
        shape: opt.shape || (Math.random() < .5 ? "drop" : "rect")
      });
    }
    if (!fxRun) { fxRun = true; requestAnimationFrame(fxTick); }
  };
  K.confetti = () => {
    const w = innerWidth;
    for (let i = 0; i < 5; i++) setTimeout(() => K.burst(w * (.15 + .7 * Math.random()), innerHeight * .35, 40, PAL, { speed: 9, up: 6, shape: "rect" }), i * 120);
  };
  function fxTick() {
    fxc.clearRect(0, 0, fx.width, fx.height);
    parts = parts.filter((p) => p.life > 0);
    for (const p of parts) {
      p.vy += .22; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= p.decay;
      fxc.globalAlpha = Math.max(0, p.life); fxc.fillStyle = p.c;
      fxc.save(); fxc.translate(p.x, p.y); fxc.rotate(p.rot);
      if (p.shape === "rect") fxc.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
      else { fxc.beginPath(); fxc.arc(0, 0, p.r, 0, Math.PI * 2); fxc.fill(); fxc.fillStyle = "rgba(255,255,255,.7)"; fxc.beginPath(); fxc.arc(-p.r * .3, -p.r * .3, p.r * .35, 0, Math.PI * 2); fxc.fill(); }
      fxc.restore();
    }
    fxc.globalAlpha = 1;
    if (parts.length) requestAnimationFrame(fxTick); else { fxRun = false; fxc.clearRect(0, 0, fx.width, fx.height); }
  }

  /* ---------- тост ---------- */
  K.toast = (text) => {
    const t = document.createElement("div");
    t.className = "k-toast glass"; t.textContent = text;
    document.body.appendChild(t); setTimeout(() => t.remove(), 2700);
  };

  /* ---------- окно (старт / конец) ---------- */
  const STAR = (on) => `<svg viewBox="0 0 24 24" class="${on ? "on" : ""}"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z" fill="${on ? "#ffd84d" : "rgba(255,255,255,.15)"}" stroke="${on ? "#fff3b0" : "rgba(255,255,255,.3)"}" stroke-width="1"/></svg>`;
  K.panel = ({ title, text, score, scoreLabel, stars, extra, buttons = [] }) => {
    const ov = document.createElement("div");
    ov.className = "overlay";
    ov.innerHTML = `<div class="panel glass" role="dialog" aria-modal="true">
      ${stars != null ? `<div class="stars">${[0, 1, 2].map((i) => STAR(i < stars)).join("")}</div>` : ""}
      <h2>${title}</h2>
      ${score != null ? `<div><div class="big-score">${score}</div>${scoreLabel ? `<p>${scoreLabel}</p>` : ""}</div>` : ""}
      ${text ? `<p>${text}</p>` : ""}
      ${extra || ""}
      <div class="row" style="justify-content:center"></div></div>`;
    const row = ov.querySelector(".row:last-child");
    const close = () => ov.remove();
    buttons.forEach((b) => {
      const el = document.createElement(b.href ? "a" : "button");
      el.className = "btn " + (b.cls || ""); el.textContent = b.label;
      if (b.href) el.href = b.href;
      el.addEventListener("click", () => { K.sfx("tap"); if (!b.keep) close(); b.onClick && b.onClick(); });
      row.appendChild(el);
    });
    document.body.appendChild(ov);
    const first = row.querySelector("button,a"); first && setTimeout(() => first.focus(), 50);
    return close;
  };

  /* ---------- верхняя панель ---------- */
  K.top = ({ title, back = null, sound = true } = {}) => {
    const bar = document.createElement("header");
    bar.className = "k-top glass";
    bar.innerHTML = `${back ? `<a class="k-back" href="${back}" aria-label="Назад"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></a>` : `<span class="k-logo">${K.dropSVG("drop-ico")}</span>`}
      <div class="title">${title}</div>
      ${sound ? `<button class="k-back k-snd" aria-label="Звук"></button>` : ""}
      <div class="k-wallet" title="Капельки">${K.dropSVG()}<b>${K.coins.get()}</b></div>`;
    document.body.prepend(bar);
    const snd = bar.querySelector(".k-snd");
    const paint = () => { if (snd) snd.innerHTML = K.muted()
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12"/></svg>`; };
    paint();
    snd && snd.addEventListener("click", () => { K.store.set("muted", !K.muted()); paint(); K.sfx("tap"); });
    return bar;
  };

  /* ---------- живой фон и 3D-наклон ---------- */
  function bg() {
    if (document.querySelector(".k-bg")) return;
    const b = document.createElement("div"); b.className = "k-bg"; b.innerHTML = "<i></i><i></i><i></i><i></i>";
    document.body.prepend(b);
  }
  K.tilt = (root = document) => {
    if (matchMedia("(hover: none)").matches) return;
    root.querySelectorAll("[data-tilt]").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        el.style.transform = `perspective(800px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateZ(6px)`;
        el.style.setProperty("--mx", (x + .5) * 100 + "%"); el.style.setProperty("--my", (y + .5) * 100 + "%");
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; });
    });
  };

  K.rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  K.shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  K.plural = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; if (a > 10 && a < 20) return many; if (b > 1 && b < 5) return few; if (b === 1) return one; return many; };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { bg(); K.tilt(); });
  else { bg(); K.tilt(); }
})();
