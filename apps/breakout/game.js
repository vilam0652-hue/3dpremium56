/* Стеклобой — арканоид из золотого и чёрного стекла.
   Мир игры: ширина 360 единиц, высота — по экрану. Физика с фиксированным шагом 1/240 с. */
(() => {
  "use strict";
  K.top({ title: "Стеклобой" });

  const LEVELS = window.BREAKOUT_LEVELS;
  const SAVE_KEY = "breakout.v2";
  const ART = (n) => "art/" + n + ".webp";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- картинки (Fluent 3D) ---------- */
  const IMG = {};
  ["2194-fe0f", "1f3b1", "1f422", "1f525", "1f9f2", "2764-fe0f", "1f4a3", "1f446"].forEach((n) => { const im = new Image(); im.src = ART(n); IMG[n] = im; });
  const ready = (im) => im && im.complete && im.naturalWidth > 0;

  /* ---------- бонусы ---------- */
  const POWER = {
    wide:   { img: "2194-fe0f", name: "Широкая ракетка", time: 14, w: 22 },
    multi:  { img: "1f3b1", name: "Три мяча!", time: 0, w: 18 },
    slow:   { img: "1f422", name: "Медленный мяч", time: 10, w: 17 },
    fire:   { img: "1f525", name: "Огненный мяч!", time: 8, w: 12 },
    sticky: { img: "1f9f2", name: "Липкая ракетка", time: 14, w: 16 },
    life:   { img: "2764-fe0f", name: "+1 жизнь", time: 0, w: 7 }
  };

  /* ---------- сохранение ---------- */
  const save = Object.assign({ unlocked: 1, stars: {}, best: {}, tutorial: false }, K.store.get(SAVE_KEY, {}) || {});
  const persist = () => K.store.set(SAVE_KEY, save);
  const totalStars = () => Object.values(save.stars).reduce((a, b) => a + b, 0);
  const totalBest = () => Object.values(save.best).reduce((a, b) => a + b, 0);

  /* ---------- DOM ---------- */
  const cv = document.getElementById("c"), g = cv.getContext("2d");
  const stage = document.getElementById("stage"), field = document.getElementById("field"), mapEl = document.getElementById("map");
  const hud = document.getElementById("hud");
  const $score = document.getElementById("score"), $lvl = document.getElementById("lvl"), $hearts = document.getElementById("hearts");
  const layer = document.createElement("canvas"), lg = layer.getContext("2d");

  /* ---------- геометрия ---------- */
  const WW = 360, COLS = 11, SIDE = 6, GAP = 3, TOP = 46;
  const BW = (WW - SIDE * 2 - GAP * (COLS - 1)) / COLS, BH = 15, CW = BW + GAP, RS = BH + GAP;
  const STEP = 1 / 240, BALL_R = 6, PAD_H = 12, PAD_W = 74;
  let WH = 640, S = 1, dpr = 1, cssW = 0, cssH = 0;

  /* ---------- состояние ---------- */
  let mode = "map";             // map | play | pause | result
  let L = 0, levelDef = null;   // индекс уровня
  let bricks = [], grid = {}, groups = [], balls = [], drops = [], shards = [], rings = [], floats = [], bombQueue = [];
  let paddle, score = 0, lives = 3, livesLost = 0, levelTime = 0, timeStarted = false;
  let fx = {}, combo = 0, sinceDrop = 0, shake = 0, simT = 0, acc = 0, last = 0, flash = 0;
  let winT = 0, timeScale = 1, banner = 0, hintT = 0, pointerMoved = false;

  /* ================= РАЗМЕРЫ ================= */
  function layout() {
    const st = stage.getBoundingClientRect();
    const availW = Math.min(st.width - 24, 440), availH = st.height - 16 - (parseFloat(getComputedStyle(stage).paddingBottom) || 0);
    cssW = Math.floor(availW); S = cssW / WW;
    cssH = Math.floor(Math.max(cssW * 1.2, Math.min(availH, cssW * 2.05)));
    const oldWH = WH; WH = cssH / S;
    dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = layer.width = Math.round(cssW * dpr); cv.height = layer.height = Math.round(cssH * dpr);
    cv.style.width = cssW + "px"; cv.style.height = cssH + "px";
    sprites = {};
    if (paddle) { paddle.y = WH - 64; for (const b of balls) if (b.stuck) b.y = paddle.y - PAD_H / 2 - b.r; else b.y *= WH / oldWH; }
  }

  /* ================= СПРАЙТЫ КИРПИЧЕЙ ================= */
  const PALETTE = {
    a: ["#fffaf0", "#f3e3b0", "#cdb67a", "#efdca5"],
    g: ["#f9ebbf", "#d6b15e", "#8f6b2a", "#d9b66a"],
    o: ["#f3cf98", "#c98a3e", "#6f4719", "#c7924c"],
    r: ["#f8dccf", "#d9a38c", "#8c5544", "#d6a08a"],
    w: ["#ffffff", "#e9e4da", "#aaa294", "#e4ded2"],
    k: ["#55555e", "#202026", "#08080a", "#2a2a31"],
    s: ["#3e3a33", "#16151a", "#050506", "#22201e"],      // прочное
    x: ["#2c2c30", "#121214", "#040405", "#1a1a1d"],      // неразбиваемое
    b: ["#4a2c22", "#1d1210", "#070404", "#2a1814"]       // бомба
  };
  let sprites = {};
  function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else { c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); } }
  function sprite(kind) {
    if (sprites[kind]) return sprites[kind];
    const k = S * dpr, pw = Math.ceil(BW * k), ph = Math.ceil(BH * k);
    const c = document.createElement("canvas"); c.width = pw; c.height = ph;
    const x = c.getContext("2d"); x.scale(k, k);
    const pal = PALETTE[kind], R = 3.2;
    // тело: полированное стекло с линией горизонта
    const gr = x.createLinearGradient(0, 0, 0, BH);
    gr.addColorStop(0, pal[0]); gr.addColorStop(.46, pal[1]); gr.addColorStop(.52, pal[2]); gr.addColorStop(1, pal[3]);
    x.fillStyle = gr; rr(x, 0, 0, BW, BH, R); x.fill();
    // косой отблеск
    x.save(); rr(x, 0, 0, BW, BH, R); x.clip();
    const sh = x.createLinearGradient(0, 0, BW, BH);
    sh.addColorStop(0, "rgba(255,255,255,.0)"); sh.addColorStop(.28, "rgba(255,255,255,.0)"); sh.addColorStop(.36, "rgba(255,255,255,.28)"); sh.addColorStop(.44, "rgba(255,255,255,0)");
    x.fillStyle = sh; x.fillRect(0, 0, BW, BH);
    // верхний блик
    x.fillStyle = "rgba(255,255,255,.42)"; rr(x, 2.2, 1.6, BW - 4.4, 2.4, 1.2); x.fill();
    // нижнее свечение
    x.fillStyle = "rgba(255,255,255,.10)"; x.fillRect(2, BH - 3, BW - 4, 1.4);
    if (kind === "x") { // штриховка у неразбиваемого
      x.strokeStyle = "rgba(214,177,94,.22)"; x.lineWidth = 1;
      for (let i = -BH; i < BW; i += 5) { x.beginPath(); x.moveTo(i, BH); x.lineTo(i + BH, 0); x.stroke(); }
    }
    x.restore();
    // золотой кант
    const dark = "ksxb".includes(kind);
    const edge = x.createLinearGradient(0, 0, BW, BH);
    edge.addColorStop(0, "#fff3cf"); edge.addColorStop(.45, "#d6b15e"); edge.addColorStop(1, "#8c6a2a");
    x.strokeStyle = dark ? edge : "rgba(255,248,225,.85)"; x.lineWidth = kind === "s" || kind === "x" ? 1.6 : dark ? 1.1 : .9;
    rr(x, .6, .6, BW - 1.2, BH - 1.2, R - .4); x.stroke();
    if (!dark) { x.strokeStyle = "rgba(120,85,30,.55)"; x.lineWidth = .8; rr(x, 1.6, 1.6, BW - 3.2, BH - 3.2, R - 1.2); x.stroke(); }
    if (kind === "x") { // заклёпки
      x.fillStyle = "#e6c97f"; [[3.5, BH / 2], [BW - 3.5, BH / 2]].forEach(([px, py]) => { x.beginPath(); x.arc(px, py, 1.3, 0, 7); x.fill(); });
    }
    sprites[kind] = c;
    return c;
  }

  /* ================= УРОВЕНЬ ================= */
  function buildLevel(i) {
    L = i; levelDef = LEVELS[i];
    bricks = []; grid = {}; groups = []; drops = []; shards = []; rings = []; floats = []; bombQueue = [];
    levelDef.map.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch === ".") return;
      const b = { r, c, bx: SIDE + c * CW, x: SIDE + c * CW, y: TOP + r * RS, w: BW, h: BH, vx: 0, ch, hit: 0, dead: false,
        hp: ch === "2" ? 2 : ch === "3" ? 3 : 1, unb: ch === "#", bomb: ch === "*",
        kind: ch === "2" || ch === "3" ? "s" : ch === "#" ? "x" : ch === "*" ? "b" : ch, seed: Math.random() * 1000 };
      b.max = b.hp;
      bricks.push(b); grid[r + "," + c] = b;
    }));
    (levelDef.move || []).forEach((m) => {
      const list = bricks.filter((b) => b.r >= m.rows[0] && b.r <= m.rows[1]);
      if (!list.length) return;
      const minC = Math.min(...list.map((b) => b.c)), maxC = Math.max(...list.map((b) => b.c));
      const left = minC, right = COLS - 1 - maxC;
      const grp = { list, mid: (right - left) / 2 * CW, amp: (right + left) / 2 * CW, speed: m.speed || .8, phase: m.phase || 0 };
      list.forEach((b) => (b.grp = grp));
      groups.push(grp);
    });
    moveBricks(0, 0);
  }
  function moveBricks(t, dt) {
    for (const gp of groups) {
      const off = gp.mid + gp.amp * Math.sin(t * gp.speed + gp.phase);
      for (const b of gp.list) { const nx = b.bx + off; b.vx = dt ? (nx - b.x) / dt : 0; b.x = nx; }
    }
  }
  const breakableLeft = () => bricks.reduce((n, b) => n + (!b.dead && !b.unb ? 1 : 0), 0);
  const parTime = () => Math.round(40 + 2 * bricks.filter((b) => !b.unb).length);

  /* ================= МЯЧ И РАКЕТКА ================= */
  function baseSpeed() { return Math.min(470, 300 + L * 9) * (1 + Math.min(.14, levelTime / 600)); }
  function curSpeed() { return baseSpeed() * (fx.slow > 0 ? .64 : 1); }
  function newBall(stuckOn = true) { return { x: paddle.x, y: paddle.y - PAD_H / 2 - BALL_R, vx: 0, vy: 0, r: BALL_R, stuck: stuckOn, off: 0, trail: [], stuckT: 0 }; }
  function resetPaddle() {
    paddle = { x: WW / 2, tx: WW / 2, y: WH - 64, w: PAD_W, tw: PAD_W, vx: 0 };
    balls = [newBall(true)];
    fx = { wide: 0, slow: 0, fire: 0, sticky: 0 };
    combo = 0;
  }
  function setDir(b, dx, dy, sp) {
    let l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    // минимальные углы: мяч не зацикливается горизонтально или строго вертикально
    const MINY = .3, MINX = .1;
    if (Math.abs(dy) < MINY) { dy = (dy < 0 || (dy === 0 && b.y > WH / 2)) ? -MINY : MINY; dx = Math.sign(dx || 1) * Math.sqrt(1 - MINY * MINY); }
    if (Math.abs(dx) < MINX) { dx = (dx < 0 ? -1 : dx > 0 ? 1 : (Math.random() < .5 ? -1 : 1)) * MINX; dy = Math.sign(dy || -1) * Math.sqrt(1 - MINX * MINX); }
    b.vx = dx * sp; b.vy = dy * sp;
  }
  function launch(b) {
    if (!b.stuck) return;
    b.stuck = false;
    const k = b.off ? Math.max(-1, Math.min(1, b.off / (paddle.w / 2))) : (paddle.vx > 30 ? .35 : paddle.vx < -30 ? -.35 : (Math.random() - .5) * .5);
    const a = k * 1.0;
    setDir(b, Math.sin(a), -Math.cos(a), curSpeed());
    timeStarted = true;
  }
  function launchAll() {
    let any = false;
    for (const b of balls) if (b.stuck) { launch(b); any = true; }
    if (any) { sfx("tap"); hintT = 0; }
  }

  /* ================= ЗВУК (с ограничением частоты) ================= */
  const lastSfx = {};
  function sfx(name, k) { const n = performance.now(); if (n - (lastSfx[name] || 0) < 45) return; lastSfx[name] = n; K.sfx(name, k); }
  const bump = (v) => { if (!reduced) shake = Math.max(shake, v); };

  /* ================= ОСКОЛКИ ================= */
  const SHARD_COL = { a: "#f3e3b0", g: "#d6b15e", o: "#c98a3e", r: "#d9a38c", w: "#f4f0e8", k: "#2a2a31", s: "#26231f", b: "#3a2420", x: "#222" };
  function shatter(b, power = 1) {
    if (shards.length > 260) shards.splice(0, 40);
    const n = reduced ? 4 : 9, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    for (let i = 0; i < n; i++) {
      const x = b.x + Math.random() * b.w, y = b.y + Math.random() * b.h, s = 3 + Math.random() * 5;
      const a0 = Math.random() * 6.28;
      shards.push({ x, y, vx: (x - cx) * 6 * power + (Math.random() - .5) * 110, vy: (y - cy) * 6 - 60 - Math.random() * 120 * power,
        rot: Math.random() * 6, vr: (Math.random() - .5) * 14, life: 1.4 + Math.random() * .6, c: SHARD_COL[b.kind] || "#d6b15e",
        p: [0, 1, 2].map((j) => { const a = a0 + j * 2.1 + Math.random() * .7; const rad = s * (.5 + Math.random() * .6); return [Math.cos(a) * rad, Math.sin(a) * rad]; }) });
    }
  }

  /* ================= УДАР ПО КИРПИЧУ ================= */
  function hitBrick(b, ball, viaBomb = false) {
    if (b.dead || b.unb) return;
    b.hp -= (viaBomb || (ball && ball.fire)) ? b.hp : 1;
    b.hit = 1;
    if (b.hp > 0) { sfx("place"); bump(1.5); score += 5; renderScore(); return; }
    b.dead = true;
    shatter(b, viaBomb ? 1.6 : 1);
    if (!viaBomb) combo++;
    const pts = (b.max > 1 ? 10 * b.max : 10) + (b.bomb ? 5 : 0) + Math.min(20, combo * 2);
    score += pts; renderScore();
    if (combo >= 4 && !viaBomb) floats.push({ x: b.x + b.w / 2, y: b.y, t: 1, s: "+" + pts });
    sfx("pop", .9 + Math.min(1.2, combo * .06));
    bump(viaBomb ? 2.5 : 2);
    if (b.bomb) explode(b);
    if (!viaBomb) maybeDrop(b);
    if (!breakableLeft()) win();
  }
  function explode(b) {
    sfx("boom"); bump(6); K.vibrate(30); flash = .35;
    rings.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, t: 0 });
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const n = grid[(b.r + dr) + "," + (b.c + dc)];
      if (n && !n.dead && !n.unb) bombQueue.push({ b: n, t: .07 + Math.random() * .05 });
    }
  }
  function maybeDrop(b) {
    sinceDrop++;
    if (drops.length >= 3) return;
    if (Math.random() < .11 || sinceDrop > 16) {
      sinceDrop = 0;
      let pool = Object.keys(POWER).filter((k) => !(k === "life" && lives >= 5) && !(k === "multi" && balls.length > 6));
      let sum = pool.reduce((a, k) => a + POWER[k].w, 0), r = Math.random() * sum, kind = pool[0];
      for (const k of pool) { r -= POWER[k].w; if (r <= 0) { kind = k; break; } }
      drops.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, kind, t: 0, vy: 60 });
    }
  }
  function takePower(kind) {
    const P = POWER[kind];
    sfx("good"); K.vibrate(15);
    floats.push({ x: paddle.x, y: paddle.y - 26, t: 1.3, s: P.name, big: true });
    score += 25; renderScore();
    if (kind === "wide") { fx.wide = P.time; paddle.tw = PAD_W * 1.55; }
    if (kind === "slow") { fx.slow = P.time; }
    if (kind === "fire") { fx.fire = P.time; }
    if (kind === "sticky") { fx.sticky = P.time; }
    if (kind === "life") { lives = Math.min(5, lives + 1); renderHearts(true); }
    if (kind === "multi") {
      const src = balls.slice(0, 3), sp = curSpeed();
      for (const s of src) {
        if (s.stuck) launch(s);
        const a = Math.atan2(s.vx, -s.vy);
        for (const d of [-.45, .45]) { if (balls.length >= 9) break; const nb = { x: s.x, y: s.y, vx: 0, vy: 0, r: BALL_R, stuck: false, off: 0, trail: [], stuckT: 0 }; setDir(nb, Math.sin(a + d), -Math.cos(a + d), sp); balls.push(nb); }
      }
    }
  }

  /* ================= СТОЛКНОВЕНИЯ ================= */
  function circleRect(ball, b) {
    const cx = Math.max(b.x, Math.min(ball.x, b.x + b.w)), cy = Math.max(b.y, Math.min(ball.y, b.y + b.h));
    let dx = ball.x - cx, dy = ball.y - cy; const d2 = dx * dx + dy * dy;
    if (d2 > ball.r * ball.r) return null;
    if (d2 > 1e-6) { const d = Math.sqrt(d2); return { nx: dx / d, ny: dy / d, pen: ball.r - d }; }
    // центр внутри: выталкиваем по кратчайшей оси
    const l = ball.x - b.x, rgt = b.x + b.w - ball.x, t = ball.y - b.y, bt = b.y + b.h - ball.y, m = Math.min(l, rgt, t, bt);
    if (m === l) return { nx: -1, ny: 0, pen: l + ball.r }; if (m === rgt) return { nx: 1, ny: 0, pen: rgt + ball.r };
    if (m === t) return { nx: 0, ny: -1, pen: t + ball.r }; return { nx: 0, ny: 1, pen: bt + ball.r };
  }
  function ballBricks(ball) {
    // ищем самое глубокое касание, отражаемся от него; соседей только выталкиваем
    for (let pass = 0; pass < 3; pass++) {
      let best = null, bestB = null;
      const x0 = ball.x - ball.r, x1 = ball.x + ball.r, y0 = ball.y - ball.r, y1 = ball.y + ball.r;
      for (const b of bricks) {
        if (b.dead || b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
        const h = circleRect(ball, b);
        if (h && (!best || h.pen > best.pen)) { best = h; bestB = b; }
      }
      if (!best) return;
      const b = bestB;
      if (ball.fire && !b.unb) { hitBrick(b, ball); continue; } // огненный мяч проходит насквозь
      ball.x += best.nx * best.pen; ball.y += best.ny * best.pen;
      const rvx = ball.vx - b.vx, dot = rvx * best.nx + ball.vy * best.ny;
      if (dot < 0) {
        let nvx = ball.vx - 2 * dot * best.nx, nvy = ball.vy - 2 * dot * best.ny;
        if (b.unb) { const a = (Math.random() - .5) * .06, c = Math.cos(a), s = Math.sin(a); [nvx, nvy] = [nvx * c - nvy * s, nvx * s + nvy * c]; }
        setDir(ball, nvx, nvy, Math.hypot(ball.vx, ball.vy));
        if (b.unb) { b.hit = .6; sfx("tap"); } else hitBrick(b, ball);
      } else if (b.vx && Math.abs(best.nx) > .5) {
        ball.vx = Math.abs(ball.vx) * Math.sign(best.nx); // кирпич догнал мяч сбоку
      }
    }
  }
  function ballPaddle(ball) {
    if (ball.vy < 0) return;
    const hw = paddle.w / 2, R = PAD_H / 2;
    const sx = Math.max(paddle.x - hw + R, Math.min(ball.x, paddle.x + hw - R));
    const dx = ball.x - sx, dy = ball.y - paddle.y, d = Math.hypot(dx, dy);
    if (d > ball.r + R) return;
    if (ball.y < paddle.y + 2) {
      // верх ракетки: угол зависит от места удара (до 62° от вертикали)
      const k = Math.max(-1, Math.min(1, (ball.x - paddle.x) / (hw + ball.r * .5)));
      const a = k * 1.08 + Math.max(-.12, Math.min(.12, paddle.vx / 3000));
      ball.y = paddle.y - R - ball.r - .01;
      if (fx.sticky > 0) { ball.stuck = true; ball.off = ball.x - paddle.x; ball.vx = ball.vy = 0; ball.stuckT = 2.5; sfx("place"); return; }
      setDir(ball, Math.sin(a), -Math.cos(a), curSpeed());
    } else {
      const nx = dx / (d || 1), ny = dy / (d || 1);
      ball.x = sx + nx * (ball.r + R + .01); ball.y = paddle.y + ny * (ball.r + R + .01);
      const dot = ball.vx * nx + ball.vy * ny;
      if (dot < 0) setDir(ball, ball.vx - 2 * dot * nx, ball.vy - 2 * dot * ny, curSpeed());
    }
    combo = 0; sfx("place", 1.2); K.vibrate(6);
  }

  /* ================= ШАГ ФИЗИКИ ================= */
  function update(dt) {
    simT += dt;
    if (timeStarted && !winT) levelTime += dt;
    moveBricks(simT, dt);
    // ракетка
    const pv = paddle.x;
    paddle.w += (paddle.tw - paddle.w) * Math.min(1, dt * 10);
    const hw = paddle.w / 2;
    paddle.tx = Math.max(hw + 2, Math.min(WW - hw - 2, paddle.tx));
    paddle.x += (paddle.tx - paddle.x) * Math.min(1, dt * 28);
    paddle.x = Math.max(hw + 2, Math.min(WW - hw - 2, paddle.x));
    paddle.vx = paddle.vx * .9 + ((paddle.x - pv) / dt) * .1;
    // таймеры бонусов
    for (const k in fx) if (fx[k] > 0) { fx[k] -= dt; if (fx[k] <= 0) { fx[k] = 0; if (k === "wide") paddle.tw = PAD_W; if (k === "sticky") launchAll(); } }
    const sp = curSpeed();
    for (const ball of balls) {
      ball.fire = fx.fire > 0;
      if (ball.stuck) {
        ball.x = paddle.x + ball.off; ball.y = paddle.y - PAD_H / 2 - ball.r;
        ball.x = Math.max(ball.r, Math.min(WW - ball.r, ball.x));
        if (ball.stuckT > 0) { ball.stuckT -= dt; if (ball.stuckT <= 0) { launch(ball); } }
        continue;
      }
      // честная скорость: подгоняем модуль к текущей скорости
      const cur = Math.hypot(ball.vx, ball.vy) || 1, ns = cur + (sp - cur) * Math.min(1, dt * 3);
      ball.vx *= ns / cur; ball.vy *= ns / cur;
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      if (ball.x < ball.r) { ball.x = ball.r; setDir(ball, Math.abs(ball.vx), ball.vy, ns); sfx("tap"); }
      else if (ball.x > WW - ball.r) { ball.x = WW - ball.r; setDir(ball, -Math.abs(ball.vx), ball.vy, ns); sfx("tap"); }
      if (ball.y < ball.r) { ball.y = ball.r; setDir(ball, ball.vx, Math.abs(ball.vy), ns); sfx("tap"); }
      ballBricks(ball);
      ballPaddle(ball);
    }
    // бомбы с задержкой — красивая цепная реакция
    for (const q of bombQueue) { q.t -= dt; if (q.t <= 0 && !q.done) { q.done = true; hitBrick(q.b, null, true); } }
    bombQueue = bombQueue.filter((q) => !q.done);
    // потерянные мячи
    const before = balls.length;
    balls = balls.filter((b) => b.y < WH + 20);
    if (before && !balls.length && !winT) loseLife();
    // бонусы падают
    for (const d of drops) {
      d.t += dt; d.vy = Math.min(150, d.vy + 120 * dt); d.y += d.vy * dt;
      if (d.y + 13 > paddle.y - PAD_H / 2 && d.y - 13 < paddle.y + PAD_H / 2 && Math.abs(d.x - paddle.x) < paddle.w / 2 + 11) { d.got = true; takePower(d.kind); }
    }
    drops = drops.filter((d) => !d.got && d.y < WH + 30);
    for (const b of bricks) if (b.hit) b.hit = Math.max(0, b.hit - dt * 4);
  }

  /* визуальные эффекты — по реальному времени */
  function updateFx(dt) {
    for (const s of shards) {
      s.vy += 700 * dt; s.vx *= (1 - dt * .6); s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt; s.life -= dt;
      if (s.y > WH - 3 && s.vy > 0) { s.y = WH - 3; s.vy *= -.32; s.vx *= .6; s.vr *= .5; }
      if (s.x < 2 || s.x > WW - 2) { s.vx *= -.5; s.x = Math.max(2, Math.min(WW - 2, s.x)); }
    }
    shards = shards.filter((s) => s.life > 0);
    for (const r of rings) r.t += dt * 2.6;
    rings = rings.filter((r) => r.t < 1);
    for (const f of floats) { f.t -= dt; f.y -= 28 * dt; }
    floats = floats.filter((f) => f.t > 0);
    for (const b of balls) { const tl = b.trail, n = tl.length; if (b.stuck) { tl.length = 0; continue; } if (n && Math.hypot(tl[n - 2] - b.x, tl[n - 1] - b.y) > 40) tl.length = 0; tl.push(b.x, b.y); if (tl.length > 28) tl.splice(0, 2); }
    shake *= Math.exp(-dt * 10); if (shake < .2) shake = 0;
    flash = Math.max(0, flash - dt * 2);
    if (banner > 0) banner -= dt;
    if (hintT > 0) hintT += dt;
  }

  /* ================= ЖИЗНИ / ПОБЕДА ================= */
  function loseLife() {
    lives--; livesLost++; renderHearts(); sfx("bad"); K.vibrate(70); bump(7);
    drops = [];
    if (lives <= 0) { mode = "result"; setTimeout(showLose, 650); return; }
    resetPaddle();
  }
  function win() {
    if (winT) return;
    winT = 1.1; timeScale = .3;
    drops = []; bombQueue = [];
  }
  function finishWin() {
    mode = "result";
    const par = parTime(), stars = 1 + (livesLost === 0 ? 1 : 0) + (levelTime <= par ? 1 : 0);
    const bonus = stars * 100 + lives * 50; score += bonus; renderScore();
    const firstClear = !save.stars[L];
    const prevStars = save.stars[L] || 0;
    save.stars[L] = Math.max(prevStars, stars);
    const recLevel = score > (save.best[L] || 0); if (recLevel) save.best[L] = score;
    if (L + 2 > save.unlocked && L + 1 < LEVELS.length) save.unlocked = L + 2;
    persist();
    const recTotal = K.best("breakout", totalBest());
    const drops_ = (firstClear ? 5 : 1) + Math.max(0, stars - prevStars) * 3 + (firstClear ? stars : 0);
    sfx("win"); K.confetti(); K.vibrate(40);
    const mm = Math.floor(levelTime / 60), ss = String(Math.floor(levelTime % 60)).padStart(2, "0");
    const hint = stars === 3 ? "Идеально! Все три звезды." : livesLost ? "Пройди без потери жизни — будет ещё звезда." : `Успей за ${Math.floor(par / 60)}:${String(par % 60).padStart(2, "0")} — получишь третью звезду.`;
    const last = L + 1 >= LEVELS.length;
    K.panel({
      title: last ? "Все уровни пройдены!" : `«${levelDef.name}» разбит!`, stars, score, scoreLabel: recLevel ? "очков · рекорд уровня!" : `очков · рекорд ${save.best[L]}`,
      extra: `<div class="res-stats"><div><b>${mm}:${ss}</b><small>время</small></div><div><b>${lives}</b><small>жизни</small></div><div><b>+${drops_}</b><small>капельки</small></div></div><p class="res-hint">${hint}${recTotal ? "<br>Новый общий рекорд: " + totalBest() + "!" : ""}</p>`,
      buttons: [
        { label: "Карта", cls: "ghost", onClick: showMap },
        { label: "Ещё раз", cls: "ghost", onClick: () => startLevel(L) },
        ...(last ? [] : [{ label: "Дальше", cls: "big", onClick: () => startLevel(L + 1) }])
      ]
    });
    setTimeout(() => K.coins.add(drops_, document.querySelector(".overlay .big-score")), 450);
  }
  function showLose() {
    sfx("lose");
    const left = breakableLeft(), total = bricks.filter((b) => !b.unb).length, pct = Math.round((1 - left / total) * 100);
    const drops_ = pct >= 50 ? 1 : 0;
    K.panel({ title: "Мячи закончились", score, scoreLabel: `очков · разбито ${pct}%`,
      text: pct >= 70 ? "Совсем чуть-чуть осталось! Попробуй ещё." : "Лови бонусы — с ними проще!" + (drops_ ? ` +1 капелька за старание.` : ""),
      buttons: [{ label: "Карта", cls: "ghost", onClick: showMap }, { label: "Ещё раз", cls: "big", onClick: () => startLevel(L) }] });
    if (drops_) setTimeout(() => K.coins.add(1, document.querySelector(".overlay .big-score")), 450);
  }

  /* ================= HUD ================= */
  function renderScore() { $score.textContent = score; }
  const HEART = `<svg viewBox="0 0 24 24"><defs><linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3e3b0"/><stop offset="1" stop-color="#b8913f"/></linearGradient></defs><path d="M12 21s-7.5-4.6-9.4-9.3C1.2 8.2 3.4 4.5 7 4.5c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 3.6 0 5.8 3.7 4.4 7.2C19.5 16.4 12 21 12 21z" fill="url(#hg)" stroke="#fff3cf" stroke-width=".8"/></svg>`;
  function renderHearts(pop) { const n = Math.max(3, lives); $hearts.innerHTML = Array.from({ length: n }, (_, i) => HEART.replace("<svg", `<svg class="${i < lives ? "" : "off"}${pop && i === lives - 1 ? " pop" : ""}"`)).join(""); }

  /* ================= РИСОВАНИЕ ================= */
  function drawBricks(c) {
    for (const b of bricks) {
      if (b.dead) continue;
      c.drawImage(sprite(b.kind), b.x, b.y, b.w, b.h);
    }
  }
  function render(real) {
    const k = S * dpr;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.clearRect(0, 0, WW, WH);
    g.save();
    if (shake) g.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);

    // поле: тонкая сетка и золотая линия внизу
    g.strokeStyle = "rgba(255,255,255,.025)"; g.lineWidth = 1;
    for (let x = SIDE + CW; x < WW - 10; x += CW * 2) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, WH); g.stroke(); }
    if (paddle) {
      const zone = g.createLinearGradient(0, paddle.y + 14, 0, WH);
      zone.addColorStop(0, "rgba(214,177,94,0)"); zone.addColorStop(1, "rgba(214,177,94,.07)");
      g.fillStyle = zone; g.fillRect(0, paddle.y + 14, WW, WH - paddle.y);
    }

    // кирпичи → отдельный слой, по которому пробегает блик
    lg.setTransform(k, 0, 0, k, 0, 0); lg.clearRect(0, 0, WW, WH);
    drawBricks(lg);
    const sweep = ((real * .22) % 1.8) * (WW + WH) * 1.1 - WH;
    lg.globalCompositeOperation = "source-atop";
    const sg = lg.createLinearGradient(sweep, 0, sweep + 90, 60);
    sg.addColorStop(0, "rgba(255,255,255,0)"); sg.addColorStop(.5, "rgba(255,250,230,.35)"); sg.addColorStop(1, "rgba(255,255,255,0)");
    lg.fillStyle = sg; lg.fillRect(0, 0, WW, WH);
    lg.globalCompositeOperation = "source-over";
    g.drawImage(layer, 0, 0, WW, WH);

    for (const b of bricks) {
      if (b.dead) continue;
      if (b.max > 1) { // трещины и метки прочности
        const dmg = b.max - b.hp;
        g.save(); g.translate(b.x, b.y);
        if (dmg > 0) {
          g.strokeStyle = "rgba(255,240,200,.85)"; g.lineWidth = .9; g.beginPath();
          let s = b.seed;
          const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
          for (let i = 0; i < dmg * 2; i++) { let x = 6 + rnd() * (b.w - 12), y = 2 + rnd() * 4; g.moveTo(x, y); for (let j = 0; j < 3; j++) { x += (rnd() - .5) * 9; y += 2 + rnd() * 3.5; g.lineTo(x, Math.min(b.h - 2, y)); } }
          g.stroke();
        }
        g.fillStyle = "#e6c97f";
        for (let i = 0; i < b.hp; i++) { const px = b.w / 2 + (i - (b.hp - 1) / 2) * 5; g.beginPath(); g.moveTo(px, b.h / 2 - 2.2); g.lineTo(px + 2.2, b.h / 2); g.lineTo(px, b.h / 2 + 2.2); g.lineTo(px - 2.2, b.h / 2); g.fill(); }
        g.restore();
      }
      if (b.bomb) {
        const p = .5 + .5 * Math.sin(real * 6 + b.seed);
        g.save(); g.shadowColor = "rgba(255,150,60,.9)"; g.shadowBlur = 6 + p * 8;
        g.strokeStyle = `rgba(255,170,90,${.4 + p * .5})`; g.lineWidth = 1.2; rr(g, b.x + .6, b.y + .6, b.w - 1.2, b.h - 1.2, 3); g.stroke(); g.restore();
        if (ready(IMG["1f4a3"])) g.drawImage(IMG["1f4a3"], b.x + b.w / 2 - 10, b.y + b.h / 2 - 10, 20, 20);
      }
      if (b.hit) { g.fillStyle = `rgba(255,255,255,${b.hit * .55})`; rr(g, b.x, b.y, b.w, b.h, 3); g.fill(); }
    }

    // волны взрывов
    for (const r of rings) {
      g.strokeStyle = `rgba(255,214,150,${1 - r.t})`; g.lineWidth = 4 * (1 - r.t) + 1;
      g.beginPath(); g.arc(r.x, r.y, 8 + r.t * 52, 0, 7); g.stroke();
      g.fillStyle = `rgba(255,200,120,${(1 - r.t) * .25})`; g.fill();
    }

    // осколки стекла
    for (const s of shards) {
      const c = Math.cos(s.rot), sn = Math.sin(s.rot);
      g.globalAlpha = Math.min(1, s.life * 1.4);
      g.beginPath();
      s.p.forEach(([px, py], i) => { const X = s.x + px * c - py * sn, Y = s.y + px * sn + py * c; i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
      g.closePath(); g.fillStyle = s.c; g.fill();
      g.strokeStyle = "rgba(255,250,235,.75)"; g.lineWidth = .6; g.stroke();
    }
    g.globalAlpha = 1;

    // бонусы: стеклянная капсула с 3D-иконкой
    for (const d of drops) {
      const wob = Math.sin(d.t * 5) * .18;
      g.save(); g.translate(d.x, d.y);
      g.shadowColor = "rgba(214,177,94,.7)"; g.shadowBlur = 12;
      const cg = g.createRadialGradient(-4, -5, 2, 0, 0, 15);
      cg.addColorStop(0, "rgba(70,66,58,.95)"); cg.addColorStop(1, "rgba(12,12,14,.95)");
      g.fillStyle = cg; g.beginPath(); g.arc(0, 0, 14, 0, 7); g.fill(); g.shadowBlur = 0;
      g.strokeStyle = "#e6c97f"; g.lineWidth = 1.4; g.stroke();
      g.rotate(wob);
      const im = IMG[POWER[d.kind].img]; if (ready(im)) g.drawImage(im, -10.5, -10.5, 21, 21);
      g.restore();
      g.fillStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.ellipse(d.x - 4, d.y - 8, 5, 2.2, -.4, 0, 7); g.fill();
    }

    if (paddle) drawPaddle(real);
    for (const b of balls) drawBall(b);

    // всплывающие надписи
    g.textAlign = "center"; g.textBaseline = "middle";
    for (const f of floats) {
      g.globalAlpha = Math.min(1, f.t * 2);
      g.font = f.big ? "700 13px Unbounded, sans-serif" : "800 11px Manrope, sans-serif";
      g.fillStyle = f.big ? "#f3e3b0" : "#fff"; g.shadowColor = "rgba(0,0,0,.8)"; g.shadowBlur = 6;
      const hw = g.measureText(f.s).width / 2 + 6; g.fillText(f.s, Math.max(hw, Math.min(WW - hw, f.x)), f.y);
      g.shadowBlur = 0;
    }
    g.globalAlpha = 1;
    g.restore();

    if (flash) { g.fillStyle = `rgba(255,230,190,${flash * .35})`; g.fillRect(0, 0, WW, WH); }
    drawEffectsBar();
    drawOverlayTexts(real);
  }
  function drawPaddle(real) {
    const p = paddle, x = p.x - p.w / 2, y = p.y - PAD_H / 2, R = PAD_H / 2;
    g.save();
    g.shadowColor = "rgba(214,177,94,.65)"; g.shadowBlur = 16; g.shadowOffsetY = 2;
    const pg = g.createLinearGradient(0, y, 0, y + PAD_H);
    pg.addColorStop(0, "#fff8e0"); pg.addColorStop(.3, "#ecd08a"); pg.addColorStop(.55, "#b8913f"); pg.addColorStop(1, "#6e5020");
    g.fillStyle = pg; rr(g, x, y, p.w, PAD_H, R); g.fill();
    g.shadowBlur = 0; g.shadowOffsetY = 0;
    // полированный отблеск, бегущий по ракетке
    g.save(); rr(g, x, y, p.w, PAD_H, R); g.clip();
    const hx = x + ((real * 70) % (p.w + 60)) - 30;
    const hg = g.createLinearGradient(hx - 16, 0, hx + 16, 0);
    hg.addColorStop(0, "rgba(255,255,255,0)"); hg.addColorStop(.5, "rgba(255,255,255,.55)"); hg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = hg; g.fillRect(x, y, p.w, PAD_H);
    g.fillStyle = "rgba(255,255,255,.65)"; rr(g, x + 5, y + 1.6, p.w - 10, 2.2, 1.1); g.fill();
    g.restore();
    g.strokeStyle = "rgba(255,243,207,.9)"; g.lineWidth = .8; rr(g, x + .4, y + .4, p.w - .8, PAD_H - .8, R); g.stroke();
    if (fx.sticky > 0) { // липкая — медовые капли
      g.fillStyle = "rgba(255,190,80,.85)";
      for (let i = 0; i < 4; i++) { const dx = x + p.w * (.2 + i * .2), dl = 3 + 2 * Math.sin(real * 3 + i * 2); g.beginPath(); g.ellipse(dx, y + PAD_H + dl / 2, 1.6, dl / 2 + 1, 0, 0, 7); g.fill(); }
    }
    // метка-подсказка: держи палец ниже
    g.fillStyle = "rgba(214,177,94,.28)";
    for (let i = -1; i <= 1; i++) { g.beginPath(); g.arc(p.x + i * 7, p.y + 24, 1.6, 0, 7); g.fill(); }
    g.restore();
  }
  function drawBall(b) {
    const fire = fx.fire > 0, t = b.trail, n = t.length / 2;
    // след: плавная сужающаяся лента
    g.lineCap = "round";
    for (let i = 1; i < n; i++) {
      const a = i / n;
      g.globalAlpha = a * a * (fire ? .7 : .45);
      g.strokeStyle = fire ? (a > .6 ? "#ffd27a" : "#ff7a2a") : "#f3e3b0";
      g.lineWidth = b.r * 2 * (.25 + a * .75) * (fire ? 1.1 : .9);
      g.beginPath(); g.moveTo(t[i * 2 - 2], t[i * 2 - 1]); g.lineTo(t[i * 2], t[i * 2 + 1]); g.stroke();
    }
    g.globalAlpha = 1;
    g.save();
    g.shadowColor = fire ? "rgba(255,130,40,.95)" : "rgba(255,248,225,.85)"; g.shadowBlur = fire ? 18 : 12;
    const bg = g.createRadialGradient(b.x - b.r * .4, b.y - b.r * .45, .5, b.x, b.y, b.r);
    if (fire) { bg.addColorStop(0, "#fff7d6"); bg.addColorStop(.45, "#ffb347"); bg.addColorStop(1, "#d4521c"); }
    else { bg.addColorStop(0, "#ffffff"); bg.addColorStop(.55, "#f1ebdd"); bg.addColorStop(1, "#b9a27a"); }
    g.fillStyle = bg; g.beginPath(); g.arc(b.x, b.y, b.r, 0, 7); g.fill();
    g.restore();
    g.strokeStyle = "rgba(214,177,94,.8)"; g.lineWidth = .8; g.beginPath(); g.arc(b.x, b.y, b.r - .3, 0, 7); g.stroke();
  }
  function drawEffectsBar() {
    let x = 8;
    for (const k of ["wide", "slow", "fire", "sticky"]) {
      if (!(fx[k] > 0)) continue;
      const f = fx[k] / POWER[k].time, cx = x + 13, cy = 16;
      g.fillStyle = "rgba(0,0,0,.45)"; g.beginPath(); g.arc(cx, cy, 12, 0, 7); g.fill();
      g.strokeStyle = "rgba(255,255,255,.12)"; g.lineWidth = 2.2; g.stroke();
      g.strokeStyle = "#e6c97f"; g.beginPath(); g.arc(cx, cy, 12, -Math.PI / 2, -Math.PI / 2 + f * 6.283); g.stroke();
      const im = IMG[POWER[k].img]; if (ready(im)) { g.globalAlpha = fx[k] < 2 ? .5 + .5 * Math.sin(fx[k] * 18) : 1; g.drawImage(im, cx - 8, cy - 8, 16, 16); g.globalAlpha = 1; }
      x += 30;
    }
  }
  function drawOverlayTexts(real) {
    g.textAlign = "center"; g.textBaseline = "middle";
    if (banner > 0 && levelDef) {
      const a = Math.min(1, banner * 2, (2.2 - banner) * 4);
      g.globalAlpha = Math.max(0, a);
      g.fillStyle = "rgba(8,8,10,.55)"; rr(g, WW / 2 - 120, WH * .52 - 34, 240, 68, 20); g.fill();
      g.strokeStyle = "rgba(214,177,94,.5)"; g.lineWidth = 1; g.stroke();
      g.fillStyle = "#a7a299"; g.font = "800 10px Manrope, sans-serif"; g.fillText(`УРОВЕНЬ ${L + 1} ИЗ ${LEVELS.length}`, WW / 2, WH * .52 - 14);
      const tg = g.createLinearGradient(WW / 2 - 80, 0, WW / 2 + 80, 0); tg.addColorStop(0, "#f3e3b0"); tg.addColorStop(.5, "#d6b15e"); tg.addColorStop(1, "#e6c97f");
      g.fillStyle = tg; g.font = "700 20px Unbounded, sans-serif"; g.fillText(levelDef.name, WW / 2, WH * .52 + 10);
      g.globalAlpha = 1;
    }
    if (mode === "play" && balls.some((b) => b.stuck) && banner <= .3 && !winT) {
      g.globalAlpha = .55 + .35 * Math.sin(real * 4);
      g.fillStyle = "#f6f4ef"; g.font = "800 14px Manrope, sans-serif";
      g.fillText(fx.sticky > 0 && timeStarted ? "Коснись — отпустить мяч" : "Коснись, чтобы запустить мяч", WW / 2, paddle.y - 70);
      g.globalAlpha = 1;
    }
    // обучение: рука показывает, как вести ракетку
    if (hintT > 0 && ready(IMG["1f446"]) && mode === "play") {
      const hx = WW / 2 + Math.sin(hintT * 2.4) * 70;
      g.globalAlpha = Math.min(1, hintT * 2) * .95;
      g.drawImage(IMG["1f446"], hx - 20, paddle.y + 14, 40, 40);
      g.globalAlpha = 1;
    }
  }

  /* ================= ЦИКЛ ================= */
  function frame(ts) {
    requestAnimationFrame(frame);
    const real = ts / 1000;
    let dt = Math.min(.1, (ts - (last || ts)) / 1000); last = ts;
    if (mode === "map") return;
    if (mode === "play") {
      if (winT) { winT -= dt; timeScale = Math.min(1, timeScale + dt * .6); if (winT <= 0) { winT = 0; timeScale = 1; finishWin(); } }
      acc += dt * timeScale; let n = 0;
      while (acc >= STEP && n < 60) { update(STEP); acc -= STEP; n++; }
      if (n >= 60) acc = 0;
    }
    if (mode !== "pause") updateFx(dt);
    if (paddle) render(real);
  }

  /* ================= УПРАВЛЕНИЕ ================= */
  let downOnStage = false;
  const toWorld = (e) => { const r = cv.getBoundingClientRect(); return (e.clientX - r.left) / S; };
  stage.addEventListener("pointerdown", (e) => {
    if (mode !== "play") return;
    downOnStage = true; pointerMoved = false;
    try { stage.setPointerCapture(e.pointerId); } catch (_) { /* нет */ }
    paddle.tx = toWorld(e);
  });
  stage.addEventListener("pointermove", (e) => {
    if (mode !== "play" || !paddle) return;
    if (e.pointerType === "mouse" || downOnStage) { paddle.tx = toWorld(e); pointerMoved = true; if (hintT > 1.2) hintT = 0; }
  });
  const up = () => { if (mode === "play" && downOnStage) launchAll(); downOnStage = false; };
  stage.addEventListener("pointerup", up);
  stage.addEventListener("pointercancel", () => { downOnStage = false; });
  addEventListener("keydown", (e) => {
    if (mode === "play" && paddle) {
      if (e.key === "ArrowLeft" || e.key === "a") paddle.tx = paddle.x - 46;
      if (e.key === "ArrowRight" || e.key === "d") paddle.tx = paddle.x + 46;
      if (e.key === " " || e.key === "ArrowUp") { e.preventDefault(); launchAll(); }
      if (e.key === "Escape" || e.key === "p") pause();
    }
  });
  document.getElementById("pauseBtn").addEventListener("click", () => { K.sfx("tap"); pause(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
  addEventListener("blur", () => pause());
  addEventListener("resize", () => { layout(); });

  let closePause = null;
  function pause() {
    if (mode !== "play" || winT) return;
    mode = "pause"; downOnStage = false;
    closePause = K.panel({ title: "Пауза", text: `«${levelDef.name}» · уровень ${L + 1}`,
      buttons: [{ label: "Карта", cls: "ghost", onClick: showMap }, { label: "Заново", cls: "ghost", onClick: () => startLevel(L) }, { label: "Играть", cls: "big", onClick: resume }] });
  }
  function resume() { mode = "play"; last = 0; acc = 0; closePause = null; }

  /* ================= ЗАПУСК УРОВНЯ ================= */
  function startLevel(i) {
    document.querySelectorAll(".overlay").forEach((o) => o.remove());
    mapEl.hidden = true; field.hidden = false; hud.hidden = false;
    layout();
    buildLevel(i);
    score = 0; lives = 3; livesLost = 0; levelTime = 0; timeStarted = false; winT = 0; timeScale = 1; sinceDrop = 0; simT = 0; acc = 0;
    resetPaddle();
    renderScore(); renderHearts(); $lvl.textContent = i + 1;
    banner = 2.2; hintT = save.tutorial ? 0 : .01;
    if (!save.tutorial) { save.tutorial = true; persist(); }
    mode = "play"; last = 0;
  }

  /* ================= КАРТА УРОВНЕЙ ================= */
  const STAR = (on) => `<svg viewBox="0 0 24 24"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z" fill="${on ? "#d6b15e" : "rgba(255,255,255,.1)"}" stroke="${on ? "#f3e3b0" : "rgba(255,255,255,.2)"}" stroke-width=".9"/></svg>`;
  const THUMB_COL = { a: "#f3e3b0", g: "#d6b15e", o: "#c98a3e", r: "#d9a38c", w: "#f4f0e8", k: "#3a3a42", "2": "#5a4a2a", "3": "#5a4a2a", "#": "#77746c", "*": "#ff9a4a" };
  function thumb(cnv, def) {
    const rows = Math.max(8, def.map.length), cw = 11, ch = 6, d = 2;
    cnv.width = (11 * cw + 4) * d; cnv.height = Math.round(cnv.width * 8 / 11);
    const c = cnv.getContext("2d"), sc = Math.min(cnv.width / (11 * cw + 4), cnv.height / (rows * (ch + 1) + 4));
    c.scale(sc, sc);
    const offY = (cnv.height / sc - def.map.length * (ch + 1)) / 2;
    def.map.forEach((row, r) => [...row].forEach((chr, col) => {
      if (chr === ".") return;
      c.fillStyle = THUMB_COL[chr] || "#d6b15e"; c.fillRect(2 + col * cw, offY + r * (ch + 1), cw - 1.2, ch);
      c.fillStyle = "rgba(255,255,255,.35)"; c.fillRect(2 + col * cw, offY + r * (ch + 1), cw - 1.2, 1.2);
    }));
  }
  function nextLevel() { for (let i = 0; i < save.unlocked; i++) if (!save.stars[i]) return i; return Math.min(save.unlocked, LEVELS.length) - 1; }
  function showMap() {
    document.querySelectorAll(".overlay").forEach((o) => o.remove());
    mode = "map"; hud.hidden = true; field.hidden = true; mapEl.hidden = false;
    const nx = nextLevel(), ts = totalStars();
    mapEl.innerHTML = `<div class="head"><img src="art/1f3c6.webp" alt=""><div><h1>Карта уровней</h1>
      <div class="row"><span class="chip">${STAR(true)} ${ts} из ${LEVELS.length * 3}</span><span class="chip">Рекорд ${K.getBest("breakout")}</span></div></div></div>
      <div class="grid"></div>
      <div class="playbar"><button class="btn big" id="go">${save.stars[nx] ? "Играть" : nx === 0 && !save.stars[0] ? "Начать игру" : "Продолжить"} · уровень ${nx + 1}</button></div>`;
    const gridEl = mapEl.querySelector(".grid");
    LEVELS.forEach((def, i) => {
      const locked = i >= save.unlocked, st = save.stars[i] || 0;
      const t = document.createElement("button");
      t.className = "tile glass" + (locked ? " locked" : "") + (i === nx ? " next" : "");
      t.setAttribute("aria-label", `Уровень ${i + 1}: ${def.name}${locked ? ", закрыт" : `, звёзд ${st}`}`);
      t.innerHTML = `<span class="n">${i + 1}</span><canvas></canvas>${locked ? `<img class="lock" src="art/1f512.webp" alt="">` : ""}<span class="nm">${def.name}</span><span class="st">${[0, 1, 2].map((j) => STAR(j < st)).join("")}</span>`;
      thumb(t.querySelector("canvas"), def);
      t.addEventListener("click", () => {
        if (locked) { K.sfx("bad"); K.toast("Сначала пройди уровень " + save.unlocked); t.classList.remove("shake"); void t.offsetWidth; t.classList.add("shake"); return; }
        K.sfx("tap"); startLevel(i);
      });
      gridEl.appendChild(t);
    });
    mapEl.querySelector("#go").addEventListener("click", () => { K.sfx("tap"); startLevel(nx); });
    const cur = gridEl.children[nx]; if (cur && cur.scrollIntoView && nx > 5) setTimeout(() => cur.scrollIntoView({ block: "center" }), 60);
  }

  /* ---------- старт ---------- */
  layout();
  showMap();
  requestAnimationFrame(frame);

  /* крючок для автотестов */
  window.__breakout = {
    get state() { return { mode, L, score, lives, balls: balls.length, bricks: breakableLeft(), fx: { ...fx }, drops: drops.length, paddleW: paddle && paddle.w, time: levelTime, save: JSON.parse(JSON.stringify(save)) }; },
    start: startLevel, map: showMap,
    give(kind) { if (paddle) takePower(kind); },
    drop(kind) { drops.push({ x: paddle.x, y: paddle.y - 120, kind, t: 0, vy: 60 }); },
    clearAll() { for (const b of bricks) if (!b.unb && !b.dead) { b.dead = true; shatter(b); } win(); },
    breakSome(n) { let k = 0; for (const b of bricks) if (!b.unb && !b.dead && k < n) { hitBrick(b, null, true); k++; } },
    launch: launchAll, balls: () => balls.map((b) => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, stuck: b.stuck })),
    setPaddle(x) { if (paddle) paddle.tx = x; }, paddle: () => paddle && { x: paddle.x, y: paddle.y, w: paddle.w },
    /* быстрая симуляция с автопилотом: проверка физики без отрисовки */
    sim(sec) {
      let minVy = 1, out = 0, inside = 0, steps = Math.round(sec / STEP), lost = 0;
      const l0 = lives;
      for (let i = 0; i < steps && mode === "play" && !winT; i++) {
        const low = balls.filter((b) => !b.stuck && b.vy > 0).sort((a, b) => b.y - a.y)[0] || balls[0];
        if (low) paddle.tx = low.x + Math.sin(i * .01) * paddle.w * .3;
        if (balls.some((b) => b.stuck)) launchAll();
        update(STEP);
        for (const b of balls) {
          if (b.stuck) continue;
          const sp = Math.hypot(b.vx, b.vy); minVy = Math.min(minVy, Math.abs(b.vy) / sp);
          if (b.x < 0 || b.x > WW || b.y < 0) out++;
          for (const k of bricks) if (!k.dead && b.x > k.x + 1 && b.x < k.x + k.w - 1 && b.y > k.y + 1 && b.y < k.y + k.h - 1) inside++;
        }
      }
      lost = l0 - lives;
      return { minVy: +minVy.toFixed(3), out, inside, lost, left: breakableLeft(), t: +levelTime.toFixed(1), won: !!winT || mode === "result" };
    }
  };
})();
