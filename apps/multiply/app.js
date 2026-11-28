/* Таблица-Турбо — тренажёр таблицы умножения и деления с умным повторением. */
(() => {
  "use strict";
  K.top({ title: "Таблица-Турбо" });
  const app = document.getElementById("app");
  const ICO = (n, cls = "") => `<img class="ico ${cls}" src="art/${n}.webp" alt="" draggable="false">`;
  const STAR = (on) => `<svg viewBox="0 0 24 24"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z" fill="${on ? "#e6c97f" : "rgba(255,255,255,.13)"}"/></svg>`;
  const STARS = (n) => `<span class="mini-stars">${[0, 1, 2].map((k) => STAR(k < n)).join("")}</span>`;
  const X_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
  const BACK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`;
  const GO_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>`;
  const DEL_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5h11v14H9l-6-7z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/></svg>`;
  const OK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
  const now = () => Date.now();
  const pl = K.plural;

  /* ================= статистика по фактам (интервальное повторение) =================
     Каждый факт a×b — своя «коробка» 0…5 (система Лейтнера). Верно и быстро — коробка выше,
     ошибка — в коробку 0. Чем ниже коробка и чем дольше факт не повторяли — тем чаще он выпадает. */
  const MIN = 6e4, HOUR = 36e5, DAY = 864e5;
  const IVL = [0, 10 * MIN, HOUR, DAY, 3 * DAY, 7 * DAY];
  const FAST = 8000;
  const facts = K.store.get("mul-facts", {});
  const divs = K.store.get("mul-div", {});
  const saveStats = () => { K.store.set("mul-facts", facts); K.store.set("mul-div", divs); };
  const mapOf = (q) => (q.op === ":" ? divs : facts);

  function record(q, ok, ms, helped) {
    const map = mapOf(q);
    const s = map[q.key] || (map[q.key] = { n: 0, e: 0, box: 0, t: 0, due: 0 });
    ms = Math.min(ms, 20000);
    s.n++;
    if (ok) {
      if (helped) s.box = 1;
      else if (ms < FAST) s.box = Math.min(5, s.box + 1);
      else s.box = Math.max(1, s.box);
      s.t = s.t ? Math.round(s.t * .6 + ms * .4) : ms;
    } else { s.e++; s.box = 0; }
    s.due = now() + IVL[s.box];
    saveStats();
  }
  function level(s) {
    if (!s || !s.n) return "new";
    if (s.box >= 3 && s.t < 6000) return "ok";
    if (s.box === 0 || (s.e >= 2 && s.e / s.n > .34 && s.box < 2)) return "hard";
    return "learn";
  }
  const factLevel = (a, b) => level(facts[`${a}x${b}`]);
  function weight(s, small) {
    if (!s || !s.n) return 2.2 * (small ? 1.3 : 1);
    let w = [10, 6, 4, 2.2, 1.1, .5][s.box];
    w *= now() >= s.due ? 1.6 : .5;
    if (s.t > 6000) w *= 1.4;
    return w;
  }
  // взвешенная выборка без повторов; не больше maxNew новых фактов за раз
  function sample(items, n, maxNew = 6) {
    const pool = items.slice(), out = [], spare = [];
    let fresh = 0;
    while (out.length < n && pool.length) {
      const tot = pool.reduce((t, it) => t + it.w, 0);
      if (tot <= 0) break;
      let r = Math.random() * tot, k = 0;
      while (k < pool.length - 1 && (r -= pool[k].w) > 0) k++;
      const it = pool.splice(k, 1)[0];
      if (it.isNew && fresh >= maxNew) { spare.push(it.q); continue; }
      if (it.isNew) fresh++;
      out.push(it.q);
    }
    // если старых фактов не хватило — добираем новыми (лёгкие вперёд)
    spare.sort((x, y) => Math.max(x.a, x.b) - Math.max(y.a, y.b));
    while (out.length < n && spare.length) out.push(spare.shift());
    return K.shuffle(out);
  }

  /* ================= вопросы ================= */
  const mul = (a, b) => ({ a, b, op: "×", r: a * b, key: `${a}x${b}` });
  const dvd = (q, d) => ({ a: q * d, b: d, op: ":", r: q, key: `${q * d}:${d}` });
  const flip = (a, b) => (Math.random() < .5 ? mul(a, b) : mul(b, a));
  function mulItems(min = 1) {
    const list = [];
    for (let a = min; a <= 9; a++) for (let b = min; b <= 9; b++) {
      const s = facts[`${a}x${b}`];
      list.push({ q: mul(a, b), isNew: !s || !s.n, w: weight(s, Math.max(a, b) <= 5) * (a === 1 || b === 1 ? .2 : 1) });
    }
    return list;
  }
  function divItems() {
    const list = [];
    for (let q = 2; q <= 9; q++) for (let d = 2; d <= 9; d++) {
      const s = divs[`${q * d}:${d}`];
      list.push({ q: dvd(q, d), isNew: !s || !s.n, w: weight(s, Math.max(q, d) <= 5) });
    }
    return list;
  }
  const smartQueue = (n = 15) => sample(mulItems(), n);
  const divQueue = (n = 15) => sample(divItems(), n);
  const tableQueue = (n) => K.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).map((k) => flip(n, k));
  function examQueue() {
    const list = [];
    for (let a = 2; a <= 9; a++) for (let b = a; b <= 9; b++) list.push(flip(a, b));
    return K.shuffle(list);
  }
  function hardQueue() {
    const list = [];
    for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) {
      const lv = factLevel(a, b);
      if (lv === "hard") list.push({ q: mul(a, b), w: 10, isNew: false });
      else if (lv === "learn") list.push({ q: mul(a, b), w: 3, isNew: false });
    }
    return sample(list, 12);
  }

  /* ================= прогресс и награды ================= */
  const prog = () => K.store.get("mul-stars", {});
  const totalStars = () => Object.entries(prog()).filter(([k]) => k !== "exam").reduce((t, [, v]) => t + v, 0);
  function counts() {
    const c = { ok: 0, learn: 0, hard: 0, new: 0 };
    for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) c[factLevel(a, b)]++;
    return c;
  }
  function tableMastery(n) {
    let ok = 0;
    for (let k = 1; k <= 9; k++) { if (factLevel(n, k) === "ok") ok++; if (k !== n && factLevel(k, n) === "ok") ok++; }
    return ok / 17;
  }
  const bestStreak = () => K.store.get("mul-streak", 0);
  const examBest = () => K.store.get("mul-exam", 0);
  const ACH = [
    { id: "first", art: "star", name: "Первый шаг", test: () => K.store.get("mul-done", 0) > 0 },
    { id: "s10", art: "fire", name: "Серия 10", test: () => bestStreak() >= 10 },
    { id: "s25", art: "rocket", name: "Серия 25", test: () => bestStreak() >= 25 },
    { id: "m20", art: "brain", name: "20 фактов", test: () => counts().ok >= 20 },
    { id: "m50", art: "gem", name: "50 фактов", test: () => counts().ok >= 50 },
    { id: "m81", art: "crown", name: "Вся таблица", test: () => counts().ok >= 81 },
    { id: "t20", art: "bolt", name: "20 за минуту", test: () => K.getBest("multiply-60") >= 20 },
    { id: "e90", art: "medal", name: "Экзамен 90%", test: () => examBest() >= 90 },
    { id: "all", art: "trophy", name: "Все 30 звёзд", test: () => totalStars() >= 30 }
  ];
  function checkAch() {
    const got = K.store.get("mul-ach", {});
    const fresh = ACH.filter((a) => !got[a.id] && a.test());
    fresh.forEach((a, i) => {
      got[a.id] = now();
      setTimeout(() => { K.toast(`Новая награда: ${a.name}!`); K.sfx("coin"); K.coins.add(5); }, 900 + i * 1400);
    });
    if (fresh.length) K.store.set("mul-ach", got);
  }

  /* ================= подсказки, которые учат ================= */
  const eq = (s) => `<span class="eq">${s}</span>`;
  function dotsHTML(rows, cols, opt = {}) {
    const d = rows > 7 ? 9 : cols > 8 ? 11 : 13;
    let h = "";
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const cls = [x === 5 ? "gx" : "", y === 5 ? "gy" : "", opt.dimFrom != null && y >= opt.dimFrom ? "dim" : ""].join(" ");
      h += `<i class="${cls}" style="animation-delay:${Math.min(900, (y * cols + x) * 9)}ms"></i>`;
    }
    return `<div class="dots" style="--d:${d}px;grid-template-columns:repeat(${cols},${d}px)">${h}</div>`;
  }
  function fingersHTML(m) {
    return `<div class="fingers">${Array.from({ length: 10 }, (_, k) => k + 1).map((k) => `<span class="${k === m ? "bent" : k > m ? "r" : ""}">${k}</span>`).join("")}</div>
      <div class="flegend"><span><i></i>десятки</span><span><i class="w"></i>единицы</span></div>`;
  }
  // способ «как догадаться», без готового ответа
  function strategy(q) {
    if (q.op === ":") {
      return { html: `<p>Вспомни умножение: ${eq(`? × ${q.b} = ${q.a}`)}<small>Какое число умножить на ${q.b}, чтобы вышло ${q.a}?</small></p>` };
    }
    const { a, b } = q;
    const other = (n) => (a === n ? b : a);
    if (a === 1 || b === 1) return { html: `<p>Умножить на 1 — число не меняется.<small>${eq(`${other(1)} × 1 = ${other(1)}`)}</small></p>` };
    if (a === 10 || b === 10) return { html: `<p>Умножить на 10 — припиши к числу ноль справа.</p>` };
    if (a === 9 || b === 9) {
      const m = other(9);
      return { html: `<p>Правило пальцев для ×9<small>Загни палец номер ${m}. Пальцы слева — десятки, справа — единицы.</small></p>${fingersHTML(m)}` };
    }
    if (a === 2 || b === 2) { const m = other(2); return { html: `<p>Умножить на 2 — значит удвоить:<br>${eq(`${m} + ${m}`)}</p>` }; }
    if (a === 5 || b === 5) { const m = other(5); return { html: `<p>${eq(`${m} × 5`)} — это половина от ${eq(`${m} × 10 = ${m * 10}`)}</p>` }; }
    // через соседний факт
    const n = a === 6 || b === 6 ? 6 : Math.max(a, b), m = other(n), k = n === 6 ? 5 : n - 1, extra = n - k;
    const part = a === n ? `${k} × ${m}` : `${m} × ${k}`;
    const add = extra === 1 ? `${m}` : `${m} × ${extra}`;
    return { html: `<p>Через соседний пример:<br>${eq(`${a} × ${b} = ${part} + ${add}`)}<small>Ты знаешь: ${part} = ${m * k}. Прибавь ещё ${m}.</small></p>` };
  }
  function dotsHint(q) {
    if (q.op === ":") {
      return `<p>${q.a} ${pl(q.a, "точку", "точки", "точек")} разложили в ряды по ${q.b}.<small>Сколько получилось рядов?</small></p>${dotsHTML(q.r, q.b)}`;
    }
    return `<p>${q.a} ${pl(q.a, "ряд", "ряда", "рядов")} по ${q.b} ${pl(q.b, "точке", "точки", "точек")}<small>Посчитай все точки — удобно пятёрками.</small></p>${dotsHTML(q.a, q.b)}`;
  }
  const TIPS = {
    2: "Умножить на 2 — значит удвоить: 7 × 2 = 7 + 7 = 14.",
    3: "Каждый следующий ответ на 3 больше: 3, 6, 9, 12, 15…",
    4: "Удвой два раза: 6 × 4 → 6 × 2 = 12 → 12 + 12 = 24.",
    5: "Ответы оканчиваются на 0 или 5: 5, 10, 15, 20, 25…",
    6: "Возьми ×5 и прибавь ещё одно число: 7 × 6 = 7 × 5 + 7 = 42.",
    7: "Опирайся на ×5: 7 × 7 = 7 × 5 + 7 × 2 = 35 + 14 = 49.",
    8: "Удвой три раза: 3 × 8 → 6 → 12 → 24.",
    9: "Правило пальцев: загни палец с нужным номером. Слева — десятки, справа — единицы. Сумма цифр ответа всегда 9."
  };

  /* ================= главная ================= */
  function home() {
    stopQuiz();
    const p = prog(), c = counts(), stars = totalStars(), firstTime = !Object.keys(facts).length;
    const R = 36, L = 2 * Math.PI * R, done = c.ok / 81;
    const got = K.store.get("mul-ach", {});
    app.innerHTML = `<div class="screen">
      <div class="hello"><span class="eyebrow">Тренажёр · 2–4 класс</span>
        <h1 class="h-display">Таблица умножения — <span class="gold-text">без пробелов</span></h1></div>
      <div class="summary glass">
        <div class="ring"><svg viewBox="0 0 84 84"><circle cx="42" cy="42" r="${R}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="8"/>
          <circle cx="42" cy="42" r="${R}" fill="none" stroke="url(#mg)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${L}" stroke-dashoffset="${L * (1 - done)}"/>
          <defs><linearGradient id="mg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3e3b0"/><stop offset="1" stop-color="#9c7731"/></linearGradient></defs></svg>
          <b><span>${c.ok}<small>из 81</small></span></b></div>
        <div class="sum-list">
          <div><b class="gold-text">${stars}<span class="muted" style="font-size:.8rem"> / 30</span></b><small>ЗВЁЗДЫ</small></div>
          <div><b>${c.hard}</b><small>ТРУДНЫХ</small></div>
          <div><b>${K.getBest("multiply-60")}</b><small>РЕКОРД 60 С</small></div>
          <div><b>${bestStreak()}</b><small>ЛУЧШАЯ СЕРИЯ</small></div>
        </div>
      </div>
      ${firstTime
        ? `<button class="cta card glass tint-sun" data-act="learn2">${ICO("books", "lg")}<span class="txt"><span class="t">Начни с ×2</span><span class="s">Сначала посмотришь ряд, потом проверишь себя</span></span><span class="go">${GO_SVG}</span></button>`
        : `<button class="cta card glass tint-sun" data-act="smart">${ICO("brain", "lg")}<span class="txt"><span class="t">Умная тренировка</span><span class="s">15 примеров. Чаще те, где были ошибки</span>${STARS(p.mix || 0)}</span><span class="go">${GO_SVG}</span></button>`}
      <div class="modes">
        <button class="mode card glass tint-orange" data-act="timed"><span class="top">${ICO("timer")}</span><span class="t">На время</span><span class="s">60 секунд · рекорд <b>${K.getBest("multiply-60")}</b></span></button>
        <button class="mode card glass tint-pink" data-act="div"><span class="top">${ICO("divide")}${STARS(p.div || 0)}</span><span class="t">Деление</span><span class="s">Обратная таблица: 56&nbsp;:&nbsp;8</span></button>
        <button class="mode card glass tint-violet" data-act="exam"><span class="top">${ICO("grad")}${STARS(p.exam || 0)}</span><span class="t">Экзамен</span><span class="s">36 примеров без подсказок${examBest() ? ` · лучший <b>${examBest()}%</b>` : ""}</span></button>
        <button class="mode card glass tint-mint" data-act="gaps"><span class="top">${ICO("search")}${c.hard ? `<span class="badge-n">${c.hard}</span>` : ""}</span><span class="t">Мои пробелы</span><span class="s">Карта всей таблицы 9&nbsp;×&nbsp;9</span></button>
      </div>
      <div class="sec-h"><h2>Таблицы</h2><span>Учи ряд или тренируйся</span></div>
      <div class="tables">${[2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="tcard card glass" data-n="${n}"><span class="n"><small>×</small>${n}</span>${STARS(p[n] || 0)}<span class="mbar"><i style="width:${Math.round(tableMastery(n) * 100)}%"></i></span></button>`).join("")}</div>
      <div class="sec-h"><h2>Награды</h2><span>${Object.keys(got).length} из ${ACH.length}</span></div>
      <div class="badges">${ACH.map((a) => `<div class="bdg glass ${got[a.id] ? "on" : ""}">${ICO(a.art)}<span>${a.name}</span></div>`).join("")}</div>
      <p class="foot">Можно отвечать и с клавиатуры: цифры, Enter, Backspace.</p>
    </div>`;
    app.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => {
      K.sfx("tap");
      ({ smart: startSmart, timed: timedIntro, div: startDiv, exam: examIntro, gaps, learn2: () => learn(2) })[b.dataset.act]();
    }));
    app.querySelectorAll(".tcard").forEach((b) => b.addEventListener("click", () => { K.sfx("tap"); tableMenu(+b.dataset.n); }));
    scrollTo(0, 0);
  }

  function tableMenu(n) {
    const p = prog();
    K.panel({ title: `Таблица ×${n}`, stars: p[n] || 0,
      text: TIPS[n],
      buttons: [
        { label: "Учу таблицу", cls: "big", onClick: () => learn(n) },
        { label: "Тренировка", cls: "big sun", onClick: () => startTable(n) },
        { label: "Закрыть", cls: "ghost" }
      ] });
  }

  /* ================= «Учу таблицу»: сначала ряд, потом вопросы ================= */
  function learn(n) {
    stopQuiz();
    const rows = Array.from({ length: 10 }, (_, k) => k + 1).map((k, i) => `<div class="lrow glass" style="animation-delay:${i * 70}ms"><span class="eq">${n} × ${k} = <b>${n * k}</b></span><span class="bar">${Array.from({ length: k }, (_, j) => `<i class="${j === 4 ? "g" : ""}"></i>`).join("")}</span></div>`).join("");
    app.innerHTML = `<div class="screen">
      <div class="learn-head"><button class="xbtn" id="lb" aria-label="Назад">${BACK_SVG}</button><h1 class="h-display">Учим ×${n}</h1></div>
      <div class="tip glass tint-sun">${ICO("glow")}<span>${TIPS[n]}</span></div>
      ${n === 9 ? `<div class="tip glass" style="margin-top:10px;flex-direction:column;align-items:center"><span class="muted" style="font-size:.86rem">Например, 9 × 3: загни третий палец. Слева 2, справа 7 — это 27.</span>${fingersHTML(3)}</div>` : ""}
      <div class="rows">${rows}</div>
      <div class="learn-go"><button class="btn big" id="lgo">Проверим себя</button></div>
    </div>`;
    document.getElementById("lb").onclick = () => { K.sfx("tap"); home(); };
    document.getElementById("lgo").onclick = () => {
      K.sfx("tap");
      const ordered = Array.from({ length: 10 }, (_, k) => k + 1).map((k) => ({ ...mul(n, k), prev: k > 1 ? `${n} × ${k - 1} = ${n * (k - 1)}` : "" }));
      const mixed = K.shuffle([2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 6).map((k) => flip(n, k));
      startQuiz({ kind: "learn", n, label: `Учим ×${n}`, queue: ordered.concat(mixed), retype: true, reask: true });
    };
    scrollTo(0, 0);
  }

  /* ================= «Мои пробелы» ================= */
  function gaps() {
    stopQuiz();
    const c = counts();
    let cells = `<span class="hd x">×</span>`;
    for (let b = 1; b <= 9; b++) cells += `<span class="hd">${b}</span>`;
    for (let a = 1; a <= 9; a++) {
      cells += `<span class="hd">${a}</span>`;
      for (let b = 1; b <= 9; b++) cells += `<button class="cell c-${factLevel(a, b)}" data-a="${a}" data-b="${b}" aria-label="${a} умножить на ${b}" style="animation-delay:${(a + b) * 18}ms">${a * b}</button>`;
    }
    app.innerHTML = `<div class="screen">
      <div class="gap-head"><button class="xbtn" id="gb" aria-label="Назад">${BACK_SVG}</button><h1 class="h-display">Мои пробелы</h1></div>
      <div class="legend"><span><i class="c-ok"></i>Освоено</span><span><i class="c-learn"></i>Учится</span><span><i class="c-hard"></i>Трудно</span><span><i class="c-new"></i>Ещё не было</span></div>
      <div class="grid9 glass">${cells}</div>
      <div class="gap-sum"><div class="glass"><b class="gold-text">${c.ok}</b><small>освоено</small></div><div class="glass"><b>${c.learn}</b><small>учится</small></div><div class="glass"><b style="color:var(--bad)">${c.hard}</b><small>трудно</small></div><div class="glass"><b class="muted">${c.new}</b><small>новые</small></div></div>
      <div class="gap-cta">${c.hard + c.learn ? `<button class="btn big" id="gh">Потренировать трудные</button>` : `<button class="btn big" id="gs">Умная тренировка</button>`}</div>
      <p class="note">Нажми на клетку — разберём этот пример и закрепим его. Клетка станет золотой, когда ответишь верно и быстро три раза подряд.</p>
    </div>`;
    document.getElementById("gb").onclick = () => { K.sfx("tap"); home(); };
    const gh = document.getElementById("gh"), gs = document.getElementById("gs");
    gh && (gh.onclick = () => { K.sfx("tap"); startQuiz({ kind: "focus", label: "Трудные примеры", queue: hardQueue(), retype: true, reask: true, back: gaps }); });
    gs && (gs.onclick = () => { K.sfx("tap"); startSmart(); });
    app.querySelectorAll(".cell").forEach((el) => el.addEventListener("click", () => { K.sfx("tap"); K.vibrate(6); factIntro(+el.dataset.a, +el.dataset.b); }));
    scrollTo(0, 0);
  }
  function factIntro(a, b) {
    const q = mul(a, b), s = facts[q.key];
    const st = s && s.n ? `<div class="pstat"><span><b>${s.n}</b>ответов</span><span><b>${s.e}</b>ошибок</span><span><b>${s.t ? (s.t / 1000).toFixed(1) + " с" : "—"}</b>среднее время</span></div>` : "";
    K.panel({ title: `${a} × ${b} = ${a * b}`,
      extra: `<div class="phint">${strategy(q).html}${a !== 9 && b !== 9 ? dotsHTML(a, b) : ""}</div>${st}`,
      buttons: [
        { label: "Закрепить", cls: "big", onClick: () => {
          const queue = [mul(a, b)];
          if (a !== b) queue.push(mul(b, a));
          queue.push(dvd(b, a));
          if (a !== b) queue.push(dvd(a, b));
          queue.push(mul(a, b));
          startQuiz({ kind: "fact", label: `Пример ${a} × ${b}`, queue, retype: true, reask: false, back: gaps });
        } },
        { label: "Закрыть", cls: "ghost" }
      ] });
  }

  /* ================= запуск режимов ================= */
  const startSmart = () => startQuiz({ kind: "smart", key: "mix", label: "Умная тренировка", queue: smartQueue(), retype: true, reask: true });
  const startTable = (n) => startQuiz({ kind: "table", key: String(n), label: `Таблица ×${n}`, queue: tableQueue(n), retype: true, reask: true });
  const startDiv = () => startQuiz({ kind: "div", key: "div", label: "Деление", queue: divQueue(), retype: true, reask: true });
  function timedIntro() {
    K.panel({ title: "60 секунд", extra: `<img class="bigart" src="art/timer.webp" alt="">`,
      text: `Реши как можно больше примеров. Ошибся — не беда, просто дальше. Рекорд: ${K.getBest("multiply-60")}.`,
      buttons: [{ label: "Старт!", cls: "big", onClick: () => startQuiz({ kind: "timed", label: "На время", queue: [], timed: 60000, noHint: true }) }, { label: "Назад", cls: "ghost" }] });
  }
  function examIntro() {
    K.panel({ title: "Экзамен", extra: `<img class="bigart" src="art/grad.webp" alt="">`,
      text: "36 примеров из всей таблицы от 2 до 9. Без подсказок. Три звезды — от 95% верных ответов.",
      buttons: [{ label: "Начать", cls: "big", onClick: () => startQuiz({ kind: "exam", key: "exam", label: "Экзамен", queue: examQueue(), noHint: true }) }, { label: "Назад", cls: "ghost" }] });
  }

  /* ================= движок тренировки ================= */
  let Q = null;
  function stopQuiz() { if (Q && Q.clock) clearInterval(Q.clock); Q = null; }
  function later(fn, ms) { const tk = Q && Q.token; setTimeout(() => { if (Q && Q.token === tk) fn(); }, ms); }
  const $ = (id) => document.getElementById(id);

  function startQuiz(cfg) {
    stopQuiz();
    Q = Object.assign({ i: 0, mistakes: 0, correct: 0, streak: 0, best: 0, wrong: [], token: {}, input: "", locked: false,
      retype: false, hintLv: 0, helped: false, t0: 0, total: cfg.queue.length }, cfg);
    Q.queue = cfg.queue.slice();
    const pad = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button data-d="${d}">${d}</button>`).join("") +
      `<button data-d="del" class="del" aria-label="Стереть">${DEL_SVG}</button><button data-d="0">0</button><button data-d="ok" class="ok" aria-label="Проверить">${OK_SVG}</button>`;
    app.innerHTML = `<div class="quiz screen">
      <div class="qtop"><button class="xbtn" id="qx" aria-label="Выйти">${X_SVG}</button><div class="progress"><i id="qp" style="width:0"></i></div><span class="streak" id="qs">${ICO("fire")}<span>0</span></span></div>
      <div class="qmeta" id="qm"></div>
      <div class="qcard glass" id="qc"><div class="qprev" id="qprev"></div><div class="qtext" id="qt"></div><div class="ans empty" id="ans" data-ph="?"></div>
        <div class="soft" id="soft"></div><div class="fix" id="fix"></div><div class="hint" id="hint"></div></div>
      <div class="keypad" id="kp">${pad}</div>
      <div class="qact">${Q.noHint ? "" : `<button class="btn ghost" id="hb">${ICO("glow", "sm")}Подсказка</button>`}<button class="btn ghost" id="sk">Пропустить</button></div>
    </div>`;
    $("kp").querySelectorAll("button").forEach((b) => b.addEventListener("pointerdown", (e) => { e.preventDefault(); press(b.dataset.d); }));
    $("kp").querySelectorAll("button").forEach((b) => b.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") e.preventDefault(); }));
    $("qx").onclick = () => { K.sfx("tap"); quit(); };
    $("hb") && ($("hb").onclick = hint);
    $("sk").onclick = skip;
    if (Q.timed) {
      Q.left = Q.timed; let last = now();
      Q.clock = setInterval(() => {
        const t = now();
        if (document.hidden || document.querySelector(".overlay")) { last = t; return; }
        Q.left -= t - last; last = t;
        paintMeta();
        if (Q.left <= 0) { clearInterval(Q.clock); Q.clock = null; finish(); }
      }, 100);
    }
    scrollTo(0, 0);
    nextQ();
  }
  function quit() { const back = Q && Q.back; stopQuiz(); (back || home)(); }
  const cur = () => Q.queue[Q.i];

  function timedPick() {
    const recent = Q.queue.slice(-5).map((q) => q.key);
    const items = mulItems(2).filter((it) => !recent.includes(it.q.key));
    return sample(items, 1, 99)[0];
  }
  function paintMeta() {
    const m = $("qm"); if (!m) return;
    if (Q.timed) {
      const s = Math.max(0, Math.ceil(Q.left / 1000));
      m.innerHTML = `<span class="clock ${s <= 10 ? "low" : ""}">0:${String(s).padStart(2, "0")}</span><span>Верно: <span class="score">${Q.correct}</span></span>`;
      $("qp").style.width = Math.max(0, Q.left / Q.timed * 100) + "%";
    } else {
      m.innerHTML = `<span>${Q.label}</span><span>${Math.min(Q.i + 1, Q.queue.length)} из ${Q.queue.length}</span>`;
      $("qp").style.width = Q.i / Q.queue.length * 100 + "%";
    }
  }
  function paintStreak(bump) {
    const s = $("qs"); if (!s) return;
    s.querySelector("span").textContent = Q.streak;
    s.classList.toggle("hot", Q.streak >= 3);
    if (bump) { s.classList.remove("bump"); void s.offsetWidth; s.classList.add("bump"); }
  }
  function nextQ() {
    if (Q.timed) Q.queue.push(timedPick());
    if (Q.i >= Q.queue.length) return finish();
    const q = cur();
    Object.assign(Q, { input: "", locked: false, retype: false, hintLv: 0, helped: false, t0: now() });
    const qc = $("qc");
    qc.classList.remove("q-in", "pulse-good", "shake"); void qc.offsetWidth; qc.classList.add("q-in");
    $("qprev").textContent = q.prev || (q.again ? "Ещё разок этот пример" : "");
    $("qt").innerHTML = `${q.a}<span class="op">${q.op === ":" ? " : " : " × "}</span>${q.b} =`;
    const ans = $("ans"); ans.className = "ans empty cursor"; ans.dataset.ph = "?"; ans.textContent = "";
    $("fix").className = "fix"; $("fix").textContent = "";
    $("hint").innerHTML = "";
    $("soft").innerHTML = Q.timed ? "" : "<i></i>";
    $("soft").style.display = Q.timed ? "none" : "";
    const hb = $("hb"); if (hb) { hb.disabled = false; hb.lastChild.textContent = "Подсказка"; }
    paintMeta(); paintStreak(false);
  }
  function drawInput() {
    const ans = $("ans");
    ans.textContent = Q.input;
    ans.classList.toggle("empty", !Q.input);
    ans.classList.toggle("cursor", !Q.input);
  }
  function press(d) {
    if (!Q || Q.locked) return;
    K.sfx("tap"); K.vibrate(6);
    if (d === "del") Q.input = Q.input.slice(0, -1);
    else if (d === "ok") return submit();
    else if (Q.input.length < 3) {
      if (Q.input === "0") Q.input = "";
      Q.input += d;
    }
    $("ans").classList.remove("wrong", "reveal");
    drawInput();
    if (Q.input.length >= String(cur().r).length) submit();
  }
  const PRAISE = ["Верно!", "Отлично!", "Точно!", "Здорово!", "Супер!", "Молодец!"];
  function goodFx(fast) {
    const qc = $("qc"), ans = $("ans");
    K.sfx("good"); K.vibrate(12);
    ans.className = "ans right";
    qc.classList.remove("pulse-good"); void qc.offsetWidth; qc.classList.add("pulse-good");
    const r = ans.getBoundingClientRect();
    K.burst(r.left + r.width / 2, r.top + r.height / 2, 16, undefined, { speed: 5 });
    const f = $("fix"); f.className = "fix good";
    f.textContent = PRAISE[(Math.random() * PRAISE.length) | 0] + (fast ? " Молниеносно!" : "");
    const p = document.createElement("span"); p.className = "plus1"; p.textContent = "+1"; qc.appendChild(p);
    setTimeout(() => p.remove(), 950);
  }
  function badFx() {
    const qc = $("qc");
    K.sfx("bad"); K.vibrate([30, 40, 30]);
    $("ans").classList.add("wrong");
    qc.classList.remove("shake"); void qc.offsetWidth; qc.classList.add("shake");
  }
  function onStreak() {
    Q.best = Math.max(Q.best, Q.streak);
    if (Q.streak > bestStreak()) K.store.set("mul-streak", Q.streak);
    paintStreak(true);
    if (Q.streak >= 5 && Q.streak % 5 === 0) {
      K.sfx("clear", 1 + Math.min(.5, Q.streak / 60));
      K.toast(`Серия ${Q.streak} подряд!`);
      const s = $("qs").getBoundingClientRect(); K.burst(s.left + s.width / 2, s.top + s.height / 2, 22, ["#ffb347", "#ffd27a", "#f3e3b0", "#fff"], { speed: 6 });
    }
  }
  function reask(q) {
    if (!Q.reask || (q.again || 0) >= 2) return;
    const pos = Math.min(Q.queue.length, Q.i + 3);
    const { prev, ...rest } = q;
    Q.queue.splice(pos, 0, Object.assign(rest, { again: (q.again || 0) + 1 }));
  }
  function submit() {
    if (!Q || Q.locked || !Q.input) return;
    const q = cur(), ok = +Q.input === q.r, ms = now() - Q.t0;
    if (Q.retype) { // после ошибки ребёнок сам набирает верный ответ — так лучше запоминается
      if (ok) { Q.locked = true; K.sfx("good"); $("ans").className = "ans right"; later(advance, 450); }
      else { badFx(); Q.input = ""; later(drawInput, 250); }
      return;
    }
    Q.locked = true;
    if (ok) {
      record(q, true, ms, Q.helped);
      Q.correct++; Q.streak++;
      goodFx(ms < 3000 && !Q.timed);
      onStreak();
      if (Q.timed) paintMeta();
      later(advance, Q.timed ? 280 : 600);
    } else {
      record(q, false, ms, Q.helped);
      Q.mistakes++; Q.streak = 0; Q.wrong.push(q); paintStreak(false);
      badFx();
      const f = $("fix"); f.className = "fix bad";
      f.innerHTML = `Правильно: <b>${q.a} ${q.op} ${q.b} = ${q.r}</b>`;
      if (Q.timed) return later(advance, 800);
      if (Q.kind === "exam") return later(advance, 1500);
      reask(q);
      f.innerHTML += `<br><span class="muted" style="font-size:.86rem">Набери ${q.r}, чтобы запомнить</span>`;
      later(() => { Q.retype = true; Q.input = ""; const a = $("ans"); a.className = "ans empty cursor"; a.dataset.ph = q.r; Q.locked = false; }, 700);
    }
  }
  function skip() {
    if (!Q || Q.locked) return;
    K.sfx("tap");
    if (Q.retype) return advance();
    const q = cur();
    record(q, false, now() - Q.t0, true);
    Q.streak = 0; paintStreak(false);
    if (Q.timed) { Q.locked = true; return later(advance, 120); }
    Q.mistakes++; Q.wrong.push(q);
    Q.locked = true;
    const a = $("ans"); a.className = "ans reveal"; a.textContent = q.r;
    const f = $("fix"); f.className = "fix calm";
    f.innerHTML = `Запомни: <b>${q.a} ${q.op} ${q.b} = ${q.r}</b>${Q.reask ? "<br>Спрошу ещё раз чуть позже" : ""}`;
    reask(q);
    later(advance, Q.kind === "exam" ? 1300 : 1900);
  }
  function hint() {
    if (!Q || Q.locked || Q.noHint) return;
    const q = cur(), h = $("hint"), hb = $("hb");
    K.sfx("pop");
    Q.helped = true; Q.hintLv++;
    if (Q.hintLv === 1) {
      h.innerHTML = strategy(q).html;
      const onlyText = q.op === "×" && (q.a === 1 || q.b === 1 || q.a === 10 || q.b === 10);
      if (onlyText) hb.disabled = true; else hb.lastChild.textContent = "Покажи точки";
    } else {
      h.innerHTML = dotsHint(q);
      hb.disabled = true;
    }
    h.style.animation = "none"; void h.offsetWidth; h.style.animation = "";
    setTimeout(() => { const r = h.getBoundingClientRect(); if (r.bottom > innerHeight) h.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, 60);
  }
  function advance() { Q.i++; nextQ(); }

  addEventListener("keydown", (e) => {
    if (!Q || document.querySelector(".overlay")) return;
    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); press(e.key); }
    else if (e.key === "Backspace") { e.preventDefault(); press("del"); }
    else if (e.key === "Enter") { e.preventDefault(); press("ok"); }
    else if (e.key === "Escape") quit();
  });

  /* ================= итоги ================= */
  function finish() {
    const S = Q; stopQuiz();
    K.store.set("mul-done", K.store.get("mul-done", 0) + 1);
    const p = prog();
    const chips = (list) => {
      const uniq = [...new Map(list.map((q) => [q.key, q])).values()].slice(0, 8);
      return uniq.length ? `<p style="font-size:.85rem">Повтори эти примеры:</p><div class="chips">${uniq.map((q) => `<span>${q.a} ${q.op} ${q.b} = ${q.r}</span>`).join("")}</div>` : "";
    };
    const statRow = (items) => `<div class="pstat">${items.map(([v, l]) => `<span><b>${v}</b>${l}</span>`).join("")}</div>`;
    const again = (fn) => ({ label: "Ещё раз", cls: "big", onClick: fn });
    const toHome = { label: S.back ? "К карте" : "На главную", cls: "ghost", onClick: S.back || home };
    let drops = 0, panel;

    if (S.kind === "timed") {
      const score = S.correct, rec = K.best("multiply-60", score);
      drops = Math.round(score / 2) + (rec ? 5 : 0);
      K.sfx("win"); if (rec && score > 0) K.confetti();
      panel = { title: rec && score > 0 ? "Новый рекорд!" : "Время вышло!", score, scoreLabel: `${pl(score, "верный ответ", "верных ответа", "верных ответов")} за минуту`,
        extra: statRow([[S.best, "лучшая серия"], [K.getBest("multiply-60"), "рекорд"]]) + chips(S.wrong),
        buttons: [again(() => startQuiz({ kind: "timed", label: "На время", queue: [], timed: 60000, noHint: true })), toHome] };
    } else if (S.kind === "exam") {
      const pct = Math.round(S.correct / S.total * 100);
      const stars = pct >= 95 ? 3 : pct >= 85 ? 2 : pct >= 70 ? 1 : 0;
      const prevBest = examBest();
      if (pct > prevBest) K.store.set("mul-exam", pct);
      if (stars > (p.exam || 0)) { p.exam = stars; K.store.set("mul-stars", p); }
      drops = Math.round(pct / 10) + (pct > prevBest ? 5 : 0);
      K.sfx(stars ? "win" : "lose"); if (stars === 3) K.confetti();
      panel = { title: pct === 100 ? "Идеально! Вся таблица!" : stars ? "Экзамен сдан!" : "Хорошая попытка!", stars, score: pct + "%",
        scoreLabel: `${S.correct} из ${S.total} верно`, extra: chips(S.wrong) + (stars ? "" : `<p style="font-size:.85rem">Потренируйся в «Моих пробелах» и попробуй снова.</p>`),
        buttons: [again(() => startQuiz({ kind: "exam", key: "exam", label: "Экзамен", queue: examQueue(), noHint: true })), toHome] };
    } else if (S.kind === "learn") {
      drops = 4;
      K.sfx("win"); if (!S.mistakes) K.confetti();
      panel = { title: `Ряд ×${S.n} пройден!`, extra: `<img class="bigart" src="art/glow.webp" alt="">` + statRow([[S.correct, "верно"], [S.mistakes, pl(S.mistakes, "ошибка", "ошибки", "ошибок")]]) + chips(S.wrong),
        text: "Теперь заработай звёзды в тренировке.",
        buttons: [{ label: "Тренировка ×" + S.n, cls: "big", onClick: () => startTable(S.n) }, toHome] };
    } else if (S.kind === "fact" || S.kind === "focus") {
      drops = S.kind === "fact" ? 2 : 4;
      K.sfx("win");
      panel = { title: S.mistakes ? "Уже лучше!" : "Закреплено!", extra: `<img class="bigart" src="art/${S.mistakes ? "target" : "hundred"}.webp" alt="">` + statRow([[S.correct, "верно"], [S.mistakes, pl(S.mistakes, "ошибка", "ошибки", "ошибок")]]),
        text: S.mistakes ? "Повтори завтра — так примеры запоминаются надолго." : "Чтобы клетка стала золотой, ответь верно ещё пару раз в другие дни.",
        buttons: [{ label: "К карте", cls: "big", onClick: gaps }, { label: "На главную", cls: "ghost", onClick: home }] };
    } else {
      const stars = S.mistakes === 0 ? 3 : S.mistakes <= 2 ? 2 : 1;
      const prev = p[S.key] || 0;
      if (stars > prev) { p[S.key] = stars; K.store.set("mul-stars", p); }
      drops = stars * 3 + (stars > prev ? 5 : 0);
      K.sfx("win"); if (stars === 3) K.confetti();
      const restart = S.kind === "table" ? () => startTable(+S.key) : S.kind === "div" ? startDiv : startSmart;
      panel = { title: stars === 3 ? "Без единой ошибки!" : stars === 2 ? "Отлично!" : "Получилось!", stars,
        extra: statRow([[S.correct, "верно"], [S.mistakes, pl(S.mistakes, "ошибка", "ошибки", "ошибок")], [S.best, "серия"]]) + chips(S.wrong),
        text: stars < 3 ? "Пройди без ошибок — получишь три звезды." : "",
        buttons: [again(restart), toHome] };
    }
    panel.text = (panel.text ? panel.text + " " : "") + (drops ? `+${drops} ${pl(drops, "капелька", "капельки", "капелек")}` : "");
    // экран под окном — главная или карта, уже обновлённые
    (S.back || home)();
    K.panel(panel);
    setTimeout(() => K.coins.add(drops, document.querySelector(".overlay .panel h2")), 500);
    checkAch();
  }

  home();
})();
