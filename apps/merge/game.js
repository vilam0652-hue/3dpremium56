/* Фруктовое слияние — физика matter.js, фрукты — 3D-иллюстрации Fluent (MIT). */
(() => {
  "use strict";
  K.top({ title: "Фруктовое слияние" });
  const { Engine, Bodies, Composite, Events, Body } = Matter;

  /* ---------- фрукты: 11 уровней ----------
     r — радиус в единицах мира (ширина мира 400), j — цвета сока,
     acc — винительный падеж («собери лимон»), gen — для «3 лимона». */
  const F = [
    { ru: "черника", acc: "чернику", gen: "черники", en: "Blueberry", ipa: "[ˈbluːbəri]", art: "blueberry", r: 15, j: ["#6f6ef5", "#34339e", "#c9c8ff"], ex: ["Blueberries are blue.", "Черника синяя."] },
    { ru: "вишня", acc: "вишню", gen: "вишни", en: "Cherry", ipa: "[ˈtʃeri]", art: "cherry", r: 20, j: ["#ef2f4b", "#9c0f27", "#ff9aa8"], ex: ["Cherries are red.", "Вишни красные."] },
    { ru: "клубника", acc: "клубнику", gen: "клубники", en: "Strawberry", ipa: "[ˈstrɔːbəri]", art: "strawberry", r: 26, k: 1.06, j: ["#ff3f5f", "#c4142f", "#ffd1d9"], ex: ["I like strawberries.", "Я люблю клубнику."] },
    { ru: "лимон", acc: "лимон", gen: "лимона", en: "Lemon", ipa: "[ˈlemən]", art: "lemon", r: 32, j: ["#ffe03d", "#f2c300", "#fff7b8"], ex: ["Lemons are yellow.", "Лимоны жёлтые."] },
    { ru: "мандарин", acc: "мандарин", gen: "мандарина", en: "Tangerine", ipa: "[ˌtændʒəˈriːn]", art: "orange", r: 39, j: ["#ff9419", "#ff6a00", "#ffd08a"], ex: ["Tangerines are orange.", "Мандарины оранжевые."] },
    { ru: "яблоко", acc: "яблоко", gen: "яблока", en: "Apple", ipa: "[ˈæpl]", art: "apple", r: 46, j: ["#ff4436", "#ffe7a6", "#b51e14"], ex: ["This apple is red.", "Это яблоко красное."] },
    { ru: "персик", acc: "персик", gen: "персика", en: "Peach", ipa: "[piːtʃ]", art: "peach", r: 54, j: ["#ffa46e", "#ffd49c", "#ff7a59"], ex: ["Peaches are soft.", "Персики мягкие."] },
    { ru: "ананас", acc: "ананас", gen: "ананаса", en: "Pineapple", ipa: "[ˈpaɪnæpl]", art: "pineapple", r: 62, k: 1.04, j: ["#ffd431", "#fff0a0", "#9bd14a"], ex: ["A pineapple is big and sweet.", "Ананас большой и сладкий."] },
    { ru: "кокос", acc: "кокос", gen: "кокоса", en: "Coconut", ipa: "[ˈkəʊkənʌt]", art: "coconut", r: 71, j: ["#ffffff", "#f3eee6", "#8a5a3a"], ex: ["A coconut is brown.", "Кокос коричневый."] },
    { ru: "дыня", acc: "дыню", gen: "дыни", en: "Melon", ipa: "[ˈmelən]", art: "melon", r: 80, j: ["#b8e36a", "#f1f8b2", "#6fae3a"], ex: ["Melons are sweet.", "Дыни сладкие."] },
    { ru: "арбуз", acc: "арбуз", gen: "арбуза", en: "Watermelon", ipa: "[ˈwɔːtəmelən]", art: "watermelon", r: 92, j: ["#ff4459", "#3fae5a", "#ffd1d6"], ex: ["A watermelon is green outside and red inside.", "Арбуз зелёный снаружи и красный внутри."] }
  ];
  const N = F.length, TOP = N - 1;
  const PTS = [1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66];
  const cap = (s) => s[0].toUpperCase() + s.slice(1);

  /* ---------- мир (в единицах; на экран масштабируется) ---------- */
  const VW = 400, VH = 600, L = 14, R = 386, FLOOR = 586, RIM = 108, LINE = 124, DROPY = 56;
  const STEP = 1000 / 60, GRACE = 4000, COMBO_MS = 1600, COOLDOWN = 480;
  const ART = 256 / 224; // картинка шире круга: поля вокруг фрукта

  const $ = (id) => document.getElementById(id);
  const cv = $("c"), ctx = cv.getContext("2d");
  const jarEl = $("jar"), stageEl = $("stage");
  const $score = $("score"), $best = $("best"), $mult = $("mult"), $next = $("nextImg");
  const IMG = new Array(N).fill(null), SPR = new Array(N).fill(null);
  let s = 1, dpr = 1, cw = 300, bgLayer = null, fgLayer = null;

  /* ---------- хранилище ---------- */
  const book = K.store.get("merge.book", { seen: [] });
  if (!Array.isArray(book.seen)) book.seen = [];
  const saveBook = () => K.store.set("merge.book", book);
  const seenCount = () => F.filter((_, i) => book.seen[i]).length;

  /* ---------- звук: сочное «плюх», стук, тиканье ---------- */
  let AC = null, NB = null, lastThud = 0;
  function ac() {
    if (K.muted()) return null;
    try {
      if (!AC) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; AC = new A(); }
      if (AC.state === "suspended") AC.resume();
      return AC;
    } catch (e) { return null; }
  }
  function noiseBuf(c) {
    if (!NB) { NB = c.createBuffer(1, Math.floor(c.sampleRate * .3), c.sampleRate); const d = NB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    return NB;
  }
  function tone(c, f, t0, dur, type, vol, f2) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + .012); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + dur + .05);
  }
  function sMerge(lv, combo) {
    const c = ac(); if (!c) return;
    try {
      const t = c.currentTime, f = 760 * Math.pow(.89, lv);
      const o = c.createOscillator(), g = c.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(f * .6, t); o.frequency.exponentialRampToValueAtTime(f * 1.7, t + .08); o.frequency.exponentialRampToValueAtTime(f * 1.25, t + .22);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.24, t + .015); g.gain.exponentialRampToValueAtTime(.0001, t + .26);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + .3);
      const n = c.createBufferSource(), bp = c.createBiquadFilter(), ng = c.createGain();
      n.buffer = noiseBuf(c); bp.type = "bandpass"; bp.frequency.value = Math.max(500, 2200 - lv * 140); bp.Q.value = 1.1;
      ng.gain.setValueAtTime(.2, t); ng.gain.exponentialRampToValueAtTime(.0001, t + .14 + lv * .012);
      n.connect(bp).connect(ng).connect(c.destination); n.start(t); n.stop(t + .3);
      if (combo > 1) { const st = [0, 2, 4, 7, 9, 12, 14, 16][Math.min(7, combo - 2)]; tone(c, 660 * Math.pow(2, st / 12), t + .07, .2, "triangle", .1); }
    } catch (e) { /* без звука */ }
  }
  function sThud(v, lv) {
    const now = performance.now(); if (now - lastThud < 70) return; lastThud = now;
    const c = ac(); if (!c) return;
    try { tone(c, 150 - lv * 7, c.currentTime, .12, "sine", Math.min(.14, v * .018), 55); } catch (e) { /* */ }
  }
  function sTick(last) { const c = ac(); if (!c) return; try { tone(c, last ? 520 : 880, c.currentTime, .08, "square", .05); } catch (e) { /* */ } }

  /* ---------- озвучка английских слов ---------- */
  function say(word, btn) {
    if (btn) { btn.classList.remove("talk"); void btn.offsetWidth; btn.classList.add("talk"); }
    try {
      if (window.KaplyaNative && KaplyaNative.speak) { KaplyaNative.speak(word); return; }
      if (!("speechSynthesis" in window)) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(word); u.lang = "en-GB"; u.rate = .82; u.pitch = 1.1;
      const v = speechSynthesis.getVoices().find((x) => /^en(-|_)GB/i.test(x.lang)) || speechSynthesis.getVoices().find((x) => /^en/i.test(x.lang));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) { /* без озвучки */ }
  }
  const SAY_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11"/></svg>`;

  /* ---------- раскладка ---------- */
  function layout() {
    const st = stageEl.getBoundingClientRect();
    const availH = Math.max(240, st.height - 44 - 26);
    cw = Math.floor(Math.min(innerWidth - 24, availH * VW / VH, 460));
    s = cw / VW;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(cw * dpr); cv.height = Math.round(VH * s * dpr);
    cv.style.width = cw + "px"; cv.style.height = Math.round(VH * s) + "px";
    buildSprites(); buildLayers();
    if (!running) draw(performance.now());
  }
  function buildSprites() {
    for (let i = 0; i < N; i++) {
      const size = Math.max(8, Math.ceil(F[i].r * 2 * ART * (F[i].k || 1) * s * dpr));
      const c = document.createElement("canvas"); c.width = c.height = size;
      const g = c.getContext("2d");
      if (IMG[i]) g.drawImage(IMG[i], 0, 0, size, size);
      else { g.fillStyle = F[i].j[0]; g.beginPath(); g.arc(size / 2, size / 2, size / 2 / ART, 0, 7); g.fill(); }
      SPR[i] = c;
    }
  }
  function layer(fn) {
    const c = document.createElement("canvas"); c.width = cv.width; c.height = cv.height;
    const g = c.getContext("2d"); g.setTransform(dpr * s, 0, 0, dpr * s, 0, 0); fn(g); return c;
  }
  function jarPath(g, inset) {
    const l = L - inset, r = R + inset, b = FLOOR + inset, rr = 24 + inset;
    g.beginPath(); g.moveTo(l, RIM); g.lineTo(l, b - rr); g.quadraticCurveTo(l, b, l + rr, b); g.lineTo(r - rr, b); g.quadraticCurveTo(r, b, r, b - rr); g.lineTo(r, RIM);
  }
  function buildLayers() {
    // задняя стенка корзины: тёмное стекло, тёплый свет со дна
    bgLayer = layer((g) => {
      g.save(); g.filter = "blur(10px)"; g.fillStyle = "rgba(0,0,0,.55)"; g.beginPath(); g.ellipse(VW / 2, FLOOR + 8, 190, 14, 0, 0, 7); g.fill(); g.restore();
      jarPath(g, 0); g.closePath();
      const lg = g.createLinearGradient(0, RIM, 0, FLOOR);
      lg.addColorStop(0, "rgba(255,255,255,.025)"); lg.addColorStop(.7, "rgba(255,255,255,.05)"); lg.addColorStop(1, "rgba(255,245,220,.09)");
      g.fillStyle = lg; g.fill();
      g.save(); g.clip();
      const rg = g.createRadialGradient(VW / 2, FLOOR + 30, 10, VW / 2, FLOOR + 30, 300);
      rg.addColorStop(0, "rgba(214,177,94,.20)"); rg.addColorStop(1, "rgba(214,177,94,0)");
      g.fillStyle = rg; g.fillRect(0, 0, VW, VH);
      // мягкие блики на задней стенке
      g.globalAlpha = .5;
      const bs = g.createLinearGradient(R - 70, 0, R - 20, 0); bs.addColorStop(0, "rgba(255,255,255,0)"); bs.addColorStop(.5, "rgba(255,255,255,.05)"); bs.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = bs; g.fillRect(R - 70, RIM, 50, FLOOR - RIM);
      g.restore();
    });
    // передняя стенка: толстое стекло, блики, золотые края горлышка
    fgLayer = layer((g) => {
      g.lineJoin = "round"; g.lineCap = "round";
      jarPath(g, 5); g.lineWidth = 10;
      const wg = g.createLinearGradient(0, RIM, 0, FLOOR);
      wg.addColorStop(0, "rgba(255,255,255,.22)"); wg.addColorStop(.5, "rgba(255,255,255,.13)"); wg.addColorStop(1, "rgba(255,255,255,.2)");
      g.strokeStyle = wg; g.stroke();
      jarPath(g, 0); g.lineWidth = 1.2; g.strokeStyle = "rgba(255,255,255,.38)"; g.stroke();
      jarPath(g, 10); g.lineWidth = 1; g.strokeStyle = "rgba(255,255,255,.16)"; g.stroke();
      // вертикальные блики стекла
      const sh = (x, w, a) => {
        const gr = g.createLinearGradient(0, RIM, 0, FLOOR);
        gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(.55, `rgba(255,255,255,${a * .35})`); gr.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = gr; g.beginPath(); g.roundRect ? g.roundRect(x, RIM + 14, w, FLOOR - RIM - 60, w / 2) : g.rect(x, RIM + 14, w, FLOOR - RIM - 60); g.fill();
      };
      sh(L + 9, 11, .13); sh(L + 25, 4, .1); sh(R - 16, 5, .08);
      // блик на дне
      const fb = g.createLinearGradient(L + 30, 0, R - 30, 0);
      fb.addColorStop(0, "rgba(255,255,255,0)"); fb.addColorStop(.5, "rgba(255,255,255,.18)"); fb.addColorStop(1, "rgba(255,255,255,0)");
      g.strokeStyle = fb; g.lineWidth = 2; g.beginPath(); g.moveTo(L + 40, FLOOR + 6); g.lineTo(R - 40, FLOOR + 6); g.stroke();
      // золотые колпачки бортиков
      const cap = (x) => {
        const gg = g.createLinearGradient(x - 9, 0, x + 9, 0);
        gg.addColorStop(0, "#9c7731"); gg.addColorStop(.4, "#f3e3b0"); gg.addColorStop(.7, "#d6b15e"); gg.addColorStop(1, "#8c6a2a");
        g.fillStyle = gg; g.beginPath(); g.roundRect ? g.roundRect(x - 9, RIM - 8, 18, 12, 6) : g.rect(x - 9, RIM - 8, 18, 12); g.fill();
        g.fillStyle = "rgba(255,255,255,.6)"; g.fillRect(x - 5, RIM - 6, 6, 1.4);
      };
      cap(L - 5); cap(R + 5);
    });
  }

  /* ---------- физика ---------- */
  let engine = null, fruits = [], mergeQ = [];
  function newWorld() {
    if (engine) { Events.off(engine); Composite.clear(engine.world, false); Engine.clear(engine); }
    engine = Engine.create({ positionIterations: 10, velocityIterations: 8, enableSleeping: false });
    engine.gravity.y = 1.3;
    const o = { isStatic: true, friction: .3, restitution: .1 };
    Composite.add(engine.world, [
      Bodies.rectangle(VW / 2, FLOOR + 60, VW * 2, 120, o),
      Bodies.rectangle(L - 60, VH / 2, 120, VH * 3, o),
      Bodies.rectangle(R + 60, VH / 2, 120, VH * 3, o)
    ]);
    fruits = []; mergeQ = [];
    Events.on(engine, "collisionStart", onStart);
    Events.on(engine, "collisionActive", onActive);
  }
  function addFruit(lv, x, y, grow = 1) {
    const b = Bodies.circle(x, y, F[lv].r, {
      restitution: .14, friction: .1, frictionStatic: .45, frictionAir: .011,
      density: .001 * (1 + lv * .14), slop: .04
    });
    b.lv = lv; b.born = gt; b.sq = 0; b.sqv = 0; b.sqa = 0; b.grow = 1; b.dead = false;
    if (grow < 1) { Body.scale(b, grow, grow); b.grow = grow; }
    Composite.add(engine.world, b); fruits.push(b);
    return b;
  }
  function removeFruit(b) { b.dead = true; Composite.remove(engine.world, b); const i = fruits.indexOf(b); if (i >= 0) fruits.splice(i, 1); }
  function canMerge(a, b) { return a.lv != null && b.lv != null && a.lv === b.lv && !a.dead && !b.dead; }
  function onActive(ev) { for (const p of ev.pairs) if (canMerge(p.bodyA, p.bodyB)) mergeQ.push([p.bodyA, p.bodyB]); }
  function onStart(ev) {
    for (const p of ev.pairs) {
      const a = p.bodyA, b = p.bodyB;
      if (canMerge(a, b)) { mergeQ.push([a, b]); continue; }
      const n = p.collision.normal;
      const rel = Math.abs((a.velocity.x - b.velocity.x) * n.x + (a.velocity.y - b.velocity.y) * n.y);
      if (rel < 1.4) continue;
      const ang = Math.atan2(n.y, n.x);
      for (const m of [a, b]) if (m.lv != null) { m.sqv += Math.min(.2, rel * .022); m.sqa = ang; }
      if (rel > 3) sThud(rel, Math.max(a.lv || 0, b.lv || 0));
    }
  }

  /* ---------- состояние партии ---------- */
  let G = null, state = "menu", gt = 0, running = false, last = 0, acc = 0;
  let holdX = VW / 2, aimX = VW / 2, canDrop = true, dropT = -1e9, heldT = 0, aiming = false;
  let dangerT = 0, dangerOn = false, nearOn = false, shake = 0, prevBest = 0, endQ = [], endT = 0, resultsShown = false;
  let parts = [], ghosts = [], texts = [];

  function freshGame() {
    return {
      score: 0, cur: 0, next: 0, top: 0, merges: 0, combo: 0, comboT: -1e9, maxCombo: 0, drops: 0,
      made: new Array(N).fill(0), seenGame: new Array(N).fill(false), newFound: [],
      missions: [], tiers: {}, missionsDone: 0, recordShown: false
    };
  }
  function rollNext() {
    const maxLv = Math.max(2, Math.min(4, G.top - 1));
    const w = [5, 4, 3, 2, 1.6].slice(0, maxLv + 1);
    let x = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0) return i; }
    return 0;
  }

  /* ---------- миссии ---------- */
  const MT = {
    fruit: { tiers: [3, 4, 5, 6, 7, 8, 9, 10], mk: (v) => ({ lv: v, need: 1 }), title: (m) => `Собери ${F[m.lv].acc}`, icon: (m) => K.artSrc(F[m.lv].art), skip: (v) => G.made[v] > 0 || G.top >= v },
    merges: { tiers: [8, 20, 35, 60, 100], mk: (v) => ({ need: v, base: G.merges }), title: (m) => `${m.need} ${K.plural(m.need, "слияние", "слияния", "слияний")}`, icon: () => K.artSrc("sparkles") },
    combo: { tiers: [2, 3, 4, 5, 6], mk: (v) => ({ need: v, prog: 0 }), title: (m) => `Комбо ×${m.need}`, icon: () => "art/fire.webp" },
    score: { tiers: [150, 400, 900, 1800, 3500, 6000, 10000], mk: (v) => ({ need: v }), title: (m) => `${m.need} очков`, icon: () => K.artSrc("star"), skip: (v) => G.score >= v },
    count: { tiers: [[2, 3], [3, 3], [4, 3], [5, 2], [6, 2]], mk: (v) => ({ lv: v[0], need: v[1], base: G.made[v[0]] }), title: (m) => `${m.need} ${F[m.lv].gen}`, icon: (m) => K.artSrc(F[m.lv].art) }
  };
  const BONUS = [25, 50, 90, 150, 250, 400, 600, 800];
  function nextMission(type) {
    const T = MT[type]; let i = (G.tiers[type] ?? -1) + 1;
    while (i < T.tiers.length && T.skip && T.skip(T.tiers[i])) i++;
    if (i >= T.tiers.length) return null;
    G.tiers[type] = i;
    return Object.assign({ type, tier: i, done: false, id: Math.random().toString(36).slice(2, 8) }, T.mk(T.tiers[i]));
  }
  function progress(m) {
    switch (m.type) {
      case "fruit": return G.made[m.lv] > 0 ? 1 : 0;
      case "merges": return G.merges - m.base;
      case "combo": return m.prog;
      case "score": return G.score;
      case "count": return G.made[m.lv] - m.base;
    }
    return 0;
  }
  function initMissions() {
    const types = ["fruit"].concat(K.shuffle(["merges", "combo", "score", "count"]).slice(0, 2));
    G.missions = types.map(nextMission);
  }
  function replaceMission(idx) {
    const old = G.missions[idx]; if (!old) return;
    let m = nextMission(old.type);
    if (!m) {
      const act = G.missions.map((x) => x && x.type);
      for (const t of K.shuffle(Object.keys(MT))) { if (act.includes(t)) continue; m = nextMission(t); if (m) break; }
    }
    G.missions[idx] = m; renderMissions(idx);
  }
  function checkMissions() {
    G.missions.forEach((m, i) => {
      if (!m || m.done) return;
      if (progress(m) >= m.need) {
        m.done = true; G.missionsDone++;
        const bonus = BONUS[Math.min(BONUS.length - 1, m.tier)];
        G.score += bonus;
        K.sfx("clear"); K.vibrate(30);
        const el = $("missions").children[i];
        if (el) { const r = el.getBoundingClientRect(); K.burst(r.left + r.width / 2, r.top + r.height / 2, 18, ["#f3e3b0", "#d6b15e", "#fff"], { speed: 4, size: 4 }); }
        K.toast(`Миссия выполнена! +${bonus}`);
        setTimeout(() => { if (G && G.missions[i] === m) replaceMission(i); }, 1500);
      }
    });
    renderMissions();
  }
  function renderMissions(enterIdx) {
    const box = $("missions");
    if (box.children.length !== 3) box.innerHTML = "<div class='mis glass'></div>".repeat(3);
    G.missions.forEach((m, i) => {
      const el = box.children[i];
      const key = m ? m.id + (m.done ? "d" : "") : "none";
      if (el.dataset.key !== key) {
        el.dataset.key = key;
        if (!m) { el.className = "mis glass empty"; el.innerHTML = `<img src="${K.artSrc("trophy")}" alt=""><div class="mt"><div class="t">Все миссии!</div></div>`; return; }
        el.className = "mis glass" + (m.done ? " done" : "") + (enterIdx === i ? " enter" : "");
        el.innerHTML = `<img src="${MT[m.type].icon(m)}" alt=""><div class="mt"><div class="t">${m.done ? "Готово! " : ""}${MT[m.type].title(m)}</div><div class="bar"><i></i></div></div>`;
      }
      if (m) el.querySelector(".bar i").style.width = Math.min(100, progress(m) / m.need * 100) + "%";
    });
  }

  /* ---------- книга фруктов и карточки слов ---------- */
  const cardQ = []; let cardBusy = false;
  function discover(lv, x, y) {
    if (!G.seenGame[lv]) {
      G.seenGame[lv] = true;
      renderStrip(lv);
      if (!book.seen[lv]) {
        book.seen[lv] = true; saveBook(); G.newFound.push(lv);
        cardQ.push(lv); if (!cardBusy) nextCard();
      } else if (lv >= 1) namePop(lv, x, y);
    }
  }
  function namePop(lv, x, y) {
    const r = cv.getBoundingClientRect();
    const d = document.createElement("div"); d.className = "namepop";
    d.innerHTML = `<b>${F[lv].en}</b> — ${F[lv].ru}!`;
    d.style.left = Math.max(90, Math.min(innerWidth - 90, r.left + x * s)) + "px"; d.style.top = (r.top + y * s) + "px";
    document.body.appendChild(d); setTimeout(() => d.remove(), 1300);
  }
  function nextCard() {
    const el = $("newcard");
    if (!cardQ.length || state !== "play") { cardBusy = false; el.hidden = true; return; }
    cardBusy = true;
    const lv = cardQ.shift(), f = F[lv];
    el.innerHTML = `<img src="${K.artSrc(f.art)}" alt=""><div class="nc-t"><span class="eyebrow">Новое слово · ${seenCount()}/${N}</span><span class="en">${f.en}</span><span class="ipa">${f.ipa}</span> <span class="ru">— ${f.ru}</span></div><button class="say" aria-label="Послушать">${SAY_SVG}</button>`;
    el.hidden = false; el.className = "newcard glass show";
    const btn = el.querySelector(".say");
    btn.addEventListener("pointerdown", (e) => e.stopPropagation());
    btn.addEventListener("click", () => say(f.en, btn));
    K.sfx("good");
    if (!K.muted()) setTimeout(() => say(f.en, btn), 250);
    clearTimeout(nextCard.t);
    nextCard.t = setTimeout(() => {
      el.className = "newcard glass hide";
      setTimeout(nextCard, 340);
    }, 2900);
  }
  function renderStrip(hitLv) {
    const box = $("stripIcons");
    if (!box.children.length) box.innerHTML = F.map((f) => `<img src="${K.artSrc(f.art)}" alt="" draggable="false">`).join("");
    [...box.children].forEach((im, i) => {
      im.classList.toggle("off", !(G ? G.seenGame[i] : book.seen[i]));
      if (i === hitLv) { im.classList.remove("hit"); void im.offsetWidth; im.classList.add("hit"); }
    });
  }

  /* ---------- окна ---------- */
  let closeModal = null;
  function modal(html, wire) {
    if (closeModal) closeModal();
    const ov = document.createElement("div"); ov.className = "overlay";
    ov.innerHTML = `<div class="panel glass wide" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(ov);
    const close = () => { ov.remove(); if (closeModal === close) closeModal = null; };
    closeModal = close;
    ov.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => { K.sfx("tap"); wire[b.dataset.act] && wire[b.dataset.act](b); }));
    const first = ov.querySelector(".btn"); first && setTimeout(() => first.focus({ preventScroll: true }), 60);
    return ov;
  }
  const stars = (n) => `<div class="star-row">${[0, 1, 2].map((i) => `<img src="${K.artSrc("star")}" class="${i < n ? "" : "off"}" alt="">`).join("")}</div>`;
  function bookGrid(selLv, gameMarks) {
    return `<div class="mini-book">${F.map((f, i) => {
      const open = !!book.seen[i];
      const isNew = gameMarks && G && G.newFound.includes(i);
      return `<button class="mb ${open ? "" : "lock"} ${gameMarks && G && G.seenGame[i] ? "game" : ""} ${i === selLv ? "sel" : ""}" data-lv="${i}" aria-label="${open ? f.en : "Не открыт"}"><img src="${K.artSrc(f.art)}" alt="" draggable="false"><span>${open ? f.en : "?"}</span>${isNew ? `<i class="badge">NEW</i>` : ""}</button>`;
    }).join("")}</div>`;
  }
  function detailHTML(lv) {
    const f = F[lv];
    if (!book.seen[lv]) return `<img class="lock" src="${K.artSrc(f.art)}" alt=""><div class="bt"><span class="en">???</span><div class="ex">Собери этот фрукт в корзине — и узнаешь, как он называется по-английски.</div></div>`;
    return `<img src="${K.artSrc(f.art)}" alt=""><div class="bt"><span class="en">${f.en}</span><span class="ipa">${f.ipa}</span> <span class="ru">— ${f.ru}</span><div class="ex">${f.ex[0]}<i>${f.ex[1]}</i></div></div><button class="say" aria-label="Послушать" data-say="${lv}">${SAY_SVG}</button>`;
  }
  function wireBook(ov, onPick) {
    ov.querySelectorAll(".mb").forEach((b) => b.addEventListener("click", () => {
      const lv = +b.dataset.lv;
      if (book.seen[lv]) say(F[lv].en); else K.sfx("tap");
      onPick && onPick(lv, b);
    }));
  }
  function openBook(onClose) {
    let sel = book.seen.lastIndexOf(true); if (sel < 0) sel = 0;
    const n = seenCount();
    const ov = modal(`<h2>Книга фруктов</h2>
      <div class="book-count">Открыто <b>${n}</b> из ${N}</div>
      <div class="progress book-progress"><i style="width:${n / N * 100}%"></i></div>
      <div class="bk-detail" id="bkd">${detailHTML(sel)}</div>
      ${bookGrid(sel, false)}
      <div class="btns"><button class="btn big" data-act="close">${onClose ? "Назад" : "Закрыть"}</button></div>`, {
      close: () => { closeModal && closeModal(); onClose && onClose(); }
    });
    const wireSay = () => { const b = ov.querySelector("#bkd .say"); b && b.addEventListener("click", () => say(F[+b.dataset.say].en, b)); };
    wireSay();
    wireBook(ov, (lv) => {
      ov.querySelectorAll(".mb").forEach((x) => x.classList.toggle("sel", +x.dataset.lv === lv));
      const d = ov.querySelector("#bkd"); d.innerHTML = detailHTML(lv); d.classList.remove("pop"); void d.offsetWidth; d.classList.add("pop"); wireSay();
    });
  }

  function showStart() {
    state = "menu";
    const sv = loadSave();
    const best = K.getBest("merge");
    modal(`<div class="hero"><img src="${K.artSrc("cherry")}" alt=""><span class="op">+</span><img src="${K.artSrc("cherry")}" alt=""><span class="op">=</span><img class="big" src="${K.artSrc("strawberry")}" alt=""></div>
      <h2>Фруктовое слияние</h2>
      <div class="rules">
        <div><img src="art/hand.webp" alt="">Веди пальцем и отпусти — фрукт упадёт.</div>
        <div><img src="${K.artSrc("sparkles")}" alt="">Два одинаковых сливаются в фрукт побольше.</div>
        <div><img src="${K.artSrc("watermelon")}" alt="">Дойди до арбуза и выучи названия по-английски!</div>
        <div><img src="art/target.webp" alt="">Не держи фрукты выше пунктира.</div>
      </div>
      ${best ? `<div class="best-line muted">Рекорд: <b>${best}</b> · книга: <b>${seenCount()}/${N}</b></div>` : ""}
      <div class="btns">
        ${sv ? `<button class="btn big" data-act="resume">Продолжить · ${sv.G.score}</button><button class="btn ghost" data-act="play">Новая игра</button>` : `<button class="btn big" data-act="play">Играть</button>`}
        <button class="btn ghost" data-act="book">Книга фруктов</button>
      </div>`, {
      play: () => { closeModal(); start(); },
      resume: () => { closeModal(); start(sv); },
      book: () => openBook(showStart)
    });
  }

  function pause(auto) {
    if (state !== "play") return;
    state = "pause"; stopLoop(); save(); K.best("merge", G.score);
    aiming = false;
    showPause(auto);
  }
  function showPause() {
    const done = G.missionsDone;
    modal(`<h2>Пауза</h2>
      <div><div class="big-score">${G.score}</div><p>очков сейчас</p></div>
      <p>Слияний: ${G.merges} · миссий: ${done} · лучший фрукт: ${F[G.top].en}</p>
      <div class="btns">
        <button class="btn big" data-act="go">Продолжить</button>
        <button class="btn ghost" data-act="book">Книга фруктов</button>
        <button class="btn ghost" data-act="restart">Начать заново</button>
      </div>`, {
      go: () => { closeModal(); resume(); },
      book: () => openBook(showPause),
      restart: () => { closeModal(); clearSave(); start(); }
    });
  }
  function resume() {
    if (state !== "pause") return;
    state = "play"; startLoop();
    if (cardQ.length && !cardBusy) nextCard();
  }

  /* ---------- сохранение партии (на случай, если приложение закроют) ---------- */
  function save() {
    if (!G || (state !== "play" && state !== "pause")) return;
    K.store.set("merge.save", {
      v: 1, G, gt, holdX,
      b: fruits.filter((b) => !b.dead).map((b) => [b.lv, +b.position.x.toFixed(1), +b.position.y.toFixed(1), +b.angle.toFixed(2)])
    });
  }
  function loadSave() {
    const sv = K.store.get("merge.save", null);
    if (!sv || sv.v !== 1 || !sv.G || !Array.isArray(sv.b) || !sv.b.length) return null;
    return sv;
  }
  const clearSave = () => K.store.set("merge.save", null);

  /* ---------- старт / конец ---------- */
  function start(sv) {
    newWorld();
    G = freshGame(); gt = 0; dangerT = 0; shake = 0; parts = []; ghosts = []; texts = []; endQ = []; resultsShown = false;
    cardQ.length = 0; cardBusy = false; $("newcard").hidden = true;
    if (sv) {
      Object.assign(G, sv.G); gt = sv.gt || 0; holdX = aimX = sv.holdX || VW / 2;
      for (const [lv, x, y, a] of sv.b) { if (lv >= 0 && lv < N) { const b = addFruit(lv, Math.max(L + F[lv].r, Math.min(R - F[lv].r, x)), Math.min(FLOOR - F[lv].r, y)); Body.setAngle(b, a || 0); b.born = gt - 3000; } }
    } else {
      G.cur = 0; G.next = rollNext(); initMissions(); holdX = aimX = VW / 2;
    }
    prevBest = K.getBest("merge");
    canDrop = true; heldT = gt; dropT = -1e9;
    state = "play";
    $best.textContent = prevBest; $("bestStat").classList.remove("rec");
    shownScore = G.score; $score.textContent = G.score;
    $mult.hidden = true;
    renderNext(); renderMissions(); renderStrip();
    if (!K.store.get("merge.tut", false) && !sv) { $("tut").hidden = false; $("tut").className = "tut"; $("tutText").textContent = "Веди пальцем и отпусти"; }
    else $("tut").hidden = true;
    startLoop();
  }
  function gameOver() {
    state = "ending"; endT = 0; aiming = false;
    endQ = fruits.filter((b) => !b.dead).sort((a, b) => a.position.y - b.position.y);
    K.sfx("lose"); K.vibrate([40, 60, 40]);
    clearSave();
  }
  function endingTick(dt) {
    endT += dt;
    const iv = Math.max(35, Math.min(80, 1500 / Math.max(1, endQ.length)));
    while (endQ.length && endT > iv) {
      endT -= iv;
      const b = endQ.shift();
      juice(b.position.x, b.position.y, b.lv, .6);
      removeFruit(b);
      if (Math.random() < .5) sMerge(b.lv, 0);
    }
    if (!endQ.length && endT > 500 && !resultsShown) { resultsShown = true; showResults(); }
  }
  function showResults() {
    const first = !G.resultDone;
    if (first) { G.resultDone = true; G.wasRec = K.best("merge", G.score) && G.score > 0; }
    const rec = G.wasRec;
    const best = K.getBest("merge");
    $best.textContent = best;
    const drops = Math.floor(G.score / 60) + G.missionsDone;
    const st = G.top >= 9 ? 3 : G.top >= 7 ? 2 : G.top >= 5 ? 1 : 0;
    const title = rec ? "Новый рекорд!" : st >= 2 ? "Отличная игра!" : "Корзина полна!";
    if (rec && first) { K.confetti(); K.sfx("win"); }
    const ov = modal(`${stars(st)}
      <h2>${title}</h2>
      <div><div class="big-score">${G.score}</div><p class="best-line">рекорд: <b>${best}</b></p></div>
      <div class="res-stats">
        <div class="tf"><img src="${K.artSrc(F[G.top].art)}" alt=""><b>${F[G.top].en}</b><small>лучший</small></div>
        <div><b>${G.merges}</b><small>слияний</small></div>
        <div><b>×${G.maxCombo || 0}</b><small>комбо</small></div>
      </div>
      <p>Миссий выполнено: <b style="color:var(--gold-hi)">${G.missionsDone}</b>${G.newFound.length ? ` · новых слов: <b style="color:var(--gold-hi)">${G.newFound.length}</b>` : ""}</p>
      <div class="book-count">Книга фруктов: <b>${seenCount()}</b> из ${N} · нажми, чтобы послушать</div>
      ${bookGrid(-1, true)}
      <div class="btns"><button class="btn big" data-act="again">Ещё раз</button><button class="btn ghost" data-act="book">Открыть книгу</button></div>`, {
      again: () => { closeModal(); start(); },
      book: () => openBook(showResults)
    });
    wireBook(ov);
    if (first) {
      setTimeout(() => K.coins.add(drops, ov.querySelector(".big-score")), 450);
    }
    setTimeout(stopLoop, 1500);
  }

  /* ---------- бросок ---------- */
  function drop() {
    if (state !== "play" || !canDrop) return;
    const lv = G.cur, r = F[lv].r;
    const x = Math.max(L + r, Math.min(R - r, holdX));
    const b = addFruit(lv, x, DROPY);
    Body.setVelocity(b, { x: 0, y: 3 });
    b.sqv = .06; b.sqa = Math.PI / 2;
    discover(lv, x, DROPY + 40);
    K.sfx("place"); K.vibrate(8);
    canDrop = false; dropT = gt; G.drops++;
    G.cur = G.next; G.next = rollNext(); renderNext();
    if (!$("tut").hidden && !$("tut").classList.contains("merge")) {
      K.store.set("merge.tut", true);
      $("tut").className = "tut merge"; $("tutText").textContent = "Два одинаковых — сольются!";
      setTimeout(() => { $("tut").hidden = true; }, 3200);
    }
  }
  function renderNext() {
    $next.src = K.artSrc(F[G.next].art); $next.alt = F[G.next].en;
    $next.classList.remove("pop"); void $next.offsetWidth; $next.classList.add("pop");
  }

  /* ---------- слияние ---------- */
  function processMerges() {
    if (!mergeQ.length) return;
    const q = mergeQ; mergeQ = [];
    for (const [a, b] of q) if (canMerge(a, b)) merge(a, b);
  }
  function merge(a, b) {
    const lv = a.lv;
    const mx = (a.position.x + b.position.x) / 2, my = (a.position.y + b.position.y) / 2;
    const vx = (a.velocity.x + b.velocity.x) * .25, vy = (a.velocity.y + b.velocity.y) * .25;
    for (const m of [a, b]) ghosts.push({ lv, x: m.position.x, y: m.position.y, tx: mx, ty: my, a: m.angle, life: 1 });
    removeFruit(a); removeFruit(b);
    G.combo = gt - G.comboT < COMBO_MS ? G.combo + 1 : 1; G.comboT = gt;
    G.maxCombo = Math.max(G.maxCombo, G.combo);
    G.missions.forEach((m) => { if (m && m.type === "combo" && !m.done) m.prog = Math.max(m.prog, G.combo); });
    const mult = Math.min(5, G.combo);
    G.merges++;
    juice(mx, my, lv, 1);
    let gain;
    if (lv < TOP) {
      const nl = lv + 1, r = F[nl].r;
      const x = Math.max(L + r, Math.min(R - r, mx)), y = Math.min(FLOOR - r * .55, my);
      const nb = addFruit(nl, x, y, .55);
      Body.setVelocity(nb, { x: vx, y: Math.min(0, vy) - 1.3 });
      nb.sq = -.2; nb.sqv = 0; nb.sqa = Math.random() * Math.PI;
      gain = PTS[nl] * 2 * mult;
      G.made[nl]++; if (nl > G.top) G.top = nl;
      discover(nl, x, y);
    } else {
      gain = 300 * mult;
      K.confetti(); K.sfx("win"); namePopText("Два арбуза! Супер!", mx, my);
    }
    addScore(gain, mx, my, mult);
    sMerge(lv, G.combo);
    K.vibrate(10 + lv * 3);
    if (lv >= 5) shake = Math.max(shake, 2 + lv * .9);
    checkMissions();
  }
  function namePopText(t, x, y) {
    const r = cv.getBoundingClientRect();
    const d = document.createElement("div"); d.className = "namepop"; d.textContent = t;
    d.style.left = (r.left + x * s) + "px"; d.style.top = (r.top + y * s) + "px";
    document.body.appendChild(d); setTimeout(() => d.remove(), 1300);
  }
  function addScore(gain, x, y, mult) {
    G.score += gain;
    x = Math.max(L + 70, Math.min(R - 70, x)); y = Math.max(LINE + 40, y);
    texts.push({ x, y: y - 6, t: "+" + gain, life: 1, big: mult > 1 });
    if (mult > 1) { texts.push({ x, y: y - 30, t: `Комбо ×${mult}!`, life: 1.2, combo: true }); $mult.hidden = false; $mult.textContent = "×" + mult; $mult.style.animation = "none"; void $mult.offsetWidth; $mult.style.animation = ""; }
    if (prevBest > 0 && G.score > prevBest && !G.recordShown) {
      G.recordShown = true; K.toast("Новый рекорд!"); K.sfx("good"); $("bestStat").classList.add("rec");
    }
  }

  /* ---------- частицы: сок, вспышка, кольцо ---------- */
  function juice(x, y, lv, power) {
    const f = F[lv], r = f.r;
    const n = Math.min(34, Math.round((10 + lv * 2.4) * power));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (1.5 + Math.random() * 4.2) * (.8 + r / 60) * power;
      parts.push({ k: "d", x: x + Math.cos(a) * r * .5, y: y + Math.sin(a) * r * .5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2.2 * power, r: (1.6 + Math.random() * 3) * (.8 + r / 70), c: f.j[i % 3 === 2 ? 2 : i % 2], life: 1, dec: .016 + Math.random() * .02 });
    }
    parts.push({ k: "f", x, y, r: r * 2.3, c: f.j[0], life: 1, dec: .075 * (power < 1 ? 1.5 : 1) });
    parts.push({ k: "o", x, y, r: r * .8, r2: r * 1.9, c: f.j[2], life: 1, dec: .05 });
    if (parts.length > 360) parts.splice(0, parts.length - 360);
  }
  function stepParts(k) {
    for (const p of parts) {
      p.life -= p.dec * k;
      if (p.k === "d") { p.vy += .28 * k; p.vx *= Math.pow(.985, k); p.x += p.vx * k; p.y += p.vy * k; if (p.y > FLOOR - p.r) { p.y = FLOOR - p.r; p.vy *= -.25; p.vx *= .6; } if (p.x < L + p.r || p.x > R - p.r) { p.vx *= -.4; p.x = Math.max(L + p.r, Math.min(R - p.r, p.x)); } }
    }
    parts = parts.filter((p) => p.life > 0);
    for (const g of ghosts) g.life -= .16 * k;
    ghosts = ghosts.filter((g) => g.life > 0);
    for (const t of texts) { t.life -= .018 * k; t.y -= .7 * k; }
    texts = texts.filter((t) => t.life > 0);
  }

  /* ---------- шаг физики ---------- */
  function step() {
    Engine.update(engine, STEP);
    gt += STEP;
    processMerges();
    for (const b of fruits) {
      // пружинка «сжатие-отскок»
      b.sqv += -.3 * b.sq; b.sqv *= .78; b.sq = Math.max(-.28, Math.min(.28, b.sq + b.sqv));
      // рост после слияния — плавно, чтобы не расталкивать соседей
      if (b.grow < 1) { const ng = Math.min(1, b.grow + .065); Body.scale(b, ng / b.grow, ng / b.grow); b.grow = ng; }
      // предохранители: скорость и стенки
      const v = b.velocity, sp = Math.hypot(v.x, v.y);
      if (sp > 24) Body.setVelocity(b, { x: v.x * 24 / sp, y: v.y * 24 / sp });
      if (Math.abs(b.angularVelocity) > .25) Body.setAngularVelocity(b, Math.sign(b.angularVelocity) * .25);
      const r = b.circleRadius, p = b.position;
      if (p.x < L + r * .4 || p.x > R - r * .4 || p.y > FLOOR - r * .4) {
        Body.setPosition(b, { x: Math.max(L + r, Math.min(R - r, p.x)), y: Math.min(FLOOR - r, p.y) });
        Body.setVelocity(b, { x: 0, y: Math.min(0, v.y) });
      }
    }
    if (!canDrop && gt - dropT > COOLDOWN) { canDrop = true; heldT = gt; }
    if (G.combo > 1 && gt - G.comboT > COMBO_MS) { G.combo = 0; $mult.hidden = true; }
  }
  function updateDanger(dt) {
    let d = false, near = false;
    for (const b of fruits) {
      if (b.dead || b.grow < 1 || gt - b.born < 1400) continue;
      const top = b.position.y - b.circleRadius;
      if (top < LINE && Math.hypot(b.velocity.x, b.velocity.y) < 1.6) d = true;
      else if (top < LINE + 50) near = true;
    }
    dangerOn = d; nearOn = near || d;
    const nc = $("newcard"); const op = dangerT > 0 ? ".12" : ""; if (nc.style.opacity !== op) nc.style.opacity = op;
    if (d) {
      const prev = dangerT; dangerT += dt;
      if (prev === 0 || Math.floor(prev / 1000) !== Math.floor(dangerT / 1000)) { sTick(GRACE - dangerT < 1000); K.vibrate(25); }
      if (dangerT >= GRACE) gameOver();
    } else dangerT = Math.max(0, dangerT - dt * 2);
  }

  /* ---------- рисование ---------- */
  function drawFruit(lv, x, y, r, ang, sq, sqa, alpha) {
    const sp = SPR[lv]; if (!sp) return;
    const h = r * ART * (F[lv].k || 1);
    ctx.save(); ctx.translate(x, y);
    if (alpha != null) ctx.globalAlpha = alpha;
    if (sq) { ctx.rotate(sqa); ctx.scale(1 - sq, 1 + sq * .75); ctx.rotate(-sqa); }
    ctx.rotate(ang); ctx.drawImage(sp, -h, -h, h * 2, h * 2);
    ctx.restore();
  }
  function landing(x, r) {
    let y = FLOOR - r, hit = null;
    for (const b of fruits) {
      if (b.dead) continue;
      const br = b.circleRadius, dx = Math.abs(b.position.x - x);
      if (dx < r + br) { const cy = b.position.y - Math.sqrt((r + br) ** 2 - dx * dx); if (cy < y) { y = cy; hit = b; } }
    }
    return { y, hit };
  }
  let shownScore = 0;
  function draw(t) {
    ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
    ctx.clearRect(0, 0, VW, VH);
    ctx.save();
    if (shake > .1) { ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake); shake *= .86; }
    if (bgLayer) ctx.drawImage(bgLayer, 0, 0, VW, VH);
    const pulse = .5 + .5 * Math.sin(t / 110);
    // красная подсветка при опасности
    if (dangerT > 0 && (state === "play" || state === "pause")) {
      const a = Math.min(1, dangerT / GRACE);
      const rg = ctx.createLinearGradient(0, RIM, 0, RIM + 220);
      rg.addColorStop(0, `rgba(255,80,90,${(.12 + .18 * a) * (.6 + .4 * pulse)})`); rg.addColorStop(1, "rgba(255,80,90,0)");
      ctx.fillStyle = rg; ctx.fillRect(L, RIM, R - L, 220);
    }
    // линия
    ctx.setLineDash([9, 8]); ctx.lineWidth = 2;
    ctx.strokeStyle = dangerOn ? `rgba(255,110,120,${.55 + .45 * pulse})` : nearOn ? "rgba(240,190,90,.75)" : "rgba(255,255,255,.2)";
    ctx.beginPath(); ctx.moveTo(L + 6, LINE); ctx.lineTo(R - 6, LINE); ctx.stroke(); ctx.setLineDash([]);
    // подсказка: куда упадёт
    const held = state === "play" && canDrop;
    if (held && G) {
      const lv = G.cur, r = F[lv].r, x = Math.max(L + r, Math.min(R - r, holdX));
      const ld = landing(x, r);
      const match = ld.hit && ld.hit.lv === lv;
      ctx.strokeStyle = match ? "rgba(243,227,176,.55)" : "rgba(255,255,255,.16)";
      ctx.lineWidth = 2; ctx.setLineDash([3, 7]); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x, DROPY + r + 4); ctx.lineTo(x, ld.y - r * .2); ctx.stroke(); ctx.setLineDash([]);
      drawFruit(lv, x, ld.y, r, 0, 0, 0, .16);
      ctx.beginPath(); ctx.arc(x, ld.y, r, 0, 7); ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
      ctx.strokeStyle = match ? "rgba(243,227,176,.85)" : "rgba(255,255,255,.28)"; ctx.stroke(); ctx.setLineDash([]);
      if (match) {
        const b = ld.hit;
        ctx.beginPath(); ctx.arc(b.position.x, b.position.y, b.circleRadius + 3 + pulse * 3, 0, 7);
        ctx.strokeStyle = `rgba(243,227,176,${.35 + .4 * pulse})`; ctx.lineWidth = 3; ctx.stroke();
      }
    }
    // фрукты
    for (const b of fruits) drawFruit(b.lv, b.position.x, b.position.y, b.circleRadius, b.angle, b.sq, b.sqa);
    // «призраки» слившихся фруктов втягиваются в центр
    for (const g of ghosts) {
      const k = 1 - g.life, e = k * k * (3 - 2 * k);
      drawFruit(g.lv, g.x + (g.tx - g.x) * e, g.y + (g.ty - g.y) * e, F[g.lv].r * (1 - .45 * e), g.a, 0, 0, g.life);
    }
    // частицы
    for (const p of parts) {
      const a = Math.max(0, p.life);
      if (p.k === "f") {
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = a * .85;
        const rg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * (1.15 - a * .3));
        rg.addColorStop(0, "rgba(255,255,255,.95)"); rg.addColorStop(.35, p.c); rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); ctx.restore();
      } else if (p.k === "o") {
        const rr = p.r + (p.r2 - p.r) * (1 - a);
        ctx.globalAlpha = a * .8; ctx.strokeStyle = p.c; ctx.lineWidth = 1 + 4 * a;
        ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = Math.min(1, a * 1.4); ctx.fillStyle = p.c;
        const st = Math.min(2.2, 1 + Math.hypot(p.vx, p.vy) * .06), an = Math.atan2(p.vy, p.vx);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(an); ctx.scale(st, 1 / st * 1.2);
        ctx.beginPath(); ctx.arc(0, 0, p.r * Math.max(.3, a), 0, 7); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.beginPath(); ctx.arc(-p.r * .25, -p.r * .3, p.r * .32 * a, 0, 7); ctx.fill();
        ctx.restore(); ctx.globalAlpha = 1;
      }
    }
    if (fgLayer) ctx.drawImage(fgLayer, 0, 0, VW, VH);
    // очки и комбо
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const tx of texts) {
      const a = Math.min(1, tx.life * 1.6);
      ctx.globalAlpha = a;
      ctx.font = tx.combo ? "700 22px Unbounded, Manrope, sans-serif" : `700 ${tx.big ? 20 : 16}px Unbounded, Manrope, sans-serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,.55)"; ctx.strokeText(tx.t, tx.x, tx.y);
      ctx.fillStyle = tx.combo ? "#f3e3b0" : "#fff"; ctx.fillText(tx.t, tx.x, tx.y);
    }
    ctx.globalAlpha = 1;
    // фрукт в руке
    if (held && G) {
      const lv = G.cur, r = F[lv].r, x = Math.max(L + r, Math.min(R - r, holdX));
      const k = Math.min(1, (gt - heldT) / 180), e = 1 - Math.pow(1 - k, 3);
      const bob = Math.sin(t / 320) * 2;
      drawFruit(lv, x, DROPY + bob - (1 - e) * 16, r * (.6 + .4 * e) * (1 + .06 * Math.sin(k * Math.PI)), Math.sin(t / 500) * .08, 0, 0, e);
    }
    // обратный отсчёт
    if (dangerT > 200 && (state === "play" || state === "pause")) {
      const left = Math.max(0, GRACE - dangerT), n = Math.ceil(left / 1000);
      const cx = VW / 2, cy = LINE;
      ctx.fillStyle = "rgba(30,8,10,.85)"; ctx.beginPath(); ctx.arc(cx, cy, 20, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(255,110,120,.35)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, 20, 0, 7); ctx.stroke();
      ctx.strokeStyle = "#ff6e78"; ctx.beginPath(); ctx.arc(cx, cy, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (left / GRACE)); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = "700 18px Unbounded, Manrope, sans-serif"; ctx.fillText(n, cx, cy + 1);
      ctx.font = "800 13px Manrope, sans-serif"; ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,.6)";
      ctx.strokeText("Освободи место!", cx, cy + 36); ctx.fillStyle = "#ffb3b8"; ctx.fillText("Освободи место!", cx, cy + 36);
    }
    ctx.restore();
    // плавный счёт
    if (G && shownScore !== G.score) {
      shownScore += Math.ceil((G.score - shownScore) * .25);
      if (Math.abs(G.score - shownScore) < 1) shownScore = G.score;
      $score.textContent = shownScore;
      if (G.score > prevBest && prevBest > 0) $best.textContent = shownScore;
    }
  }

  /* ---------- цикл ---------- */
  let saveT = 0;
  function loop(t) {
    if (!running) return;
    const dt = last ? Math.min(50, t - last) : STEP; last = t;
    if (state === "play") {
      holdX += (aimX - holdX) * Math.min(1, dt / 40);
      acc += dt; let n = 0;
      while (acc >= STEP && n < 4) { step(); acc -= STEP; n++; if (state !== "play") break; }
      if (n >= 4) acc = 0;
      if (state === "play") updateDanger(dt);
      saveT += dt; if (saveT > 4000) { saveT = 0; save(); }
    } else if (state === "ending") endingTick(dt);
    stepParts(dt / STEP);
    draw(t);
    requestAnimationFrame(loop);
  }
  function startLoop() { if (running) return; running = true; last = 0; acc = 0; requestAnimationFrame(loop); }
  function stopLoop() { running = false; draw(performance.now()); }

  /* ---------- управление ---------- */
  const toWorld = (e) => { const r = cv.getBoundingClientRect(); return (e.clientX - r.left) / s; };
  cv.addEventListener("pointerdown", (e) => {
    if (state !== "play") return;
    aiming = true; aimX = toWorld(e);
    if (Math.abs(aimX - holdX) > 60) holdX += (aimX - holdX) * .6;
    try { cv.setPointerCapture(e.pointerId); } catch (_) { /* */ }
  });
  cv.addEventListener("pointermove", (e) => { if (state === "play" && (aiming || e.pointerType === "mouse")) aimX = toWorld(e); });
  cv.addEventListener("pointerup", (e) => {
    if (!aiming || state !== "play") { aiming = false; return; }
    aiming = false; aimX = toWorld(e); holdX = aimX; drop();
  });
  cv.addEventListener("pointercancel", () => { aiming = false; });
  addEventListener("keydown", (e) => {
    if (state !== "play" || closeModal) return;
    if (e.key === "ArrowLeft") { aimX = Math.max(L, aimX - 16); e.preventDefault(); }
    else if (e.key === "ArrowRight") { aimX = Math.min(R, aimX + 16); e.preventDefault(); }
    else if (e.key === " " || e.key === "ArrowDown" || e.key === "Enter") { holdX = aimX; drop(); e.preventDefault(); }
    else if (e.key === "Escape" || e.key === "p") pause();
  });
  $("pauseBtn").addEventListener("click", () => { K.sfx("tap"); pause(); });
  $("strip").addEventListener("click", () => {
    K.sfx("tap");
    if (state === "play") { state = "pause"; stopLoop(); save(); openBook(() => { resume(); }); }
    else if (!closeModal) openBook();
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) { pause(true); save(); } });
  addEventListener("pagehide", () => { pause(true); save(); });
  addEventListener("blur", () => { if (state === "play") pause(true); });
  let rsT = 0;
  addEventListener("resize", () => { clearTimeout(rsT); rsT = setTimeout(layout, 120); });

  /* ---------- запуск ---------- */
  F.forEach((f, i) => K.img(K.artSrc(f.art)).then((im) => { IMG[i] = im; }));
  Promise.all(F.map((f) => K.img(K.artSrc(f.art)))).then(() => { buildSprites(); if (!running) { demo(); draw(performance.now()); } });
  function demo() {
    // заставка: фрукты лежат на дне корзины
    if (G) return;
    newWorld();
    let x = L + 4;
    for (let i = 0; i < 7 && x < R - 40; i++) { const r = F[i].r; x += r; if (x + r > R) break; addFruit(i, x, FLOOR - r); x += r + 2; }
  }
  $best.textContent = K.getBest("merge");
  layout(); renderStrip();
  $next.src = K.artSrc(F[0].art);
  showStart();

  // для автотестов
  window.__merge = {
    get state() { return state; }, get score() { return G && G.score; }, get count() { return fruits.length; }, get G() { return G; },
    get danger() { return dangerT; }, fruits: () => fruits.map((b) => [b.lv, Math.round(b.position.x), Math.round(b.position.y)]),
    spawn: (lv, x, y) => addFruit(lv, x, y), setCur: (lv) => { G.cur = lv; }
  };
})();
