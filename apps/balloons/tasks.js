/* Шарики-примеры — генератор заданий 4 класса.
   Каждое задание: { mode, q, ans, wrong[3], ex[] }
   ans / wrong — { key, main, sub? }; ex — строки объяснения решения.
   Неверные ответы — типичные ошибки детей, без повторов. */
(function (root) {
  "use strict";
  const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const SP = " ";
  const fmt = (n) => { const s = String(n); return n >= 1000 ? s.replace(/\B(?=(\d{3})+(?!\d))/g, SP) : s; };
  const NUM = (n) => ({ key: "n" + n, main: fmt(n), v: n });

  /* выбор неверных ответов: сначала типичные ошибки (tiers[0]), потом запасные */
  function pickWrong(ans, tiers, make = NUM, valid = (v) => Number.isInteger(v) && v > 0) {
    const seen = new Set([ans.key]), out = [];
    const add = (c) => {
      if (out.length >= 3) return;
      if (c == null) return;
      const o = typeof c === "object" ? c : (valid(c) ? make(c) : null);
      if (!o || seen.has(o.key)) return;
      seen.add(o.key); out.push(o);
    };
    for (const t of tiers) for (const c of shuffle(t)) add(c);
    // страховка: соседние числа
    if (ans.v != null) for (const d of [1, -1, 2, -2, 10, -10, 3, -3, 5, 20, 100]) add(ans.v + d);
    return out;
  }

  /* разряды числа: младший — первый */
  const dig = (n, k) => { const d = []; for (let i = 0; i < k; i++) { d.push(n % 10); n = Math.floor(n / 10); } return d; };
  const len = (n) => String(n).length;
  function carries(a, b) { const k = Math.max(len(a), len(b)) + 1, x = dig(a, k), y = dig(b, k); let c = 0, cnt = 0; for (let i = 0; i < k; i++) { const s = x[i] + y[i] + c; c = s >= 10 ? 1 : 0; cnt += c; } return cnt; }
  function borrows(a, b) { const k = len(a), x = dig(a, k), y = dig(b, k); let c = 0, cnt = 0; for (let i = 0; i < k; i++) { const s = x[i] - y[i] - c; c = s < 0 ? 1 : 0; cnt += c; } return cnt; }
  // ошибка «забыл перенести десяток»
  function noCarryAdd(a, b) { const k = Math.max(len(a), len(b)), x = dig(a, k), y = dig(b, k); let r = 0; for (let i = k - 1; i >= 0; i--) { const s = x[i] + y[i]; r = r * (i === k - 1 ? 1 : 10) + (i === k - 1 ? s : s % 10); } return r; }
  // ошибка «из большей цифры вычел меньшую»
  function smallFromLarge(a, b) { const k = len(a), x = dig(a, k), y = dig(b, k); let r = 0; for (let i = k - 1; i >= 0; i--) r = r * 10 + Math.abs(x[i] - y[i]); return r; }
  // ошибка «занял десяток, но не уменьшил соседний разряд»
  function noReduce(a, b) { const k = len(a), x = dig(a, k), y = dig(b, k); let r = 0; for (let i = k - 1; i >= 0; i--) { let d = x[i] - y[i]; if (d < 0) d += 10; r = r * 10 + d; } return r; }
  const swapDigits = (n) => { const s = String(n); return s.length === 2 && s[0] !== s[1] ? +(s[1] + s[0]) : null; };

  /* объяснение «по разрядам»: 347 + 285 → 347 + 200 = 547, 547 + 80 = 627, 627 + 5 = 632 */
  function placeSteps(a, b, op) {
    const parts = []; let p = 1, n = b;
    while (n > 0) { const d = n % 10; if (d) parts.unshift(d * p); n = Math.floor(n / 10); p *= 10; }
    const out = []; let cur = a;
    for (const x of parts) { const nx = op === "+" ? cur + x : cur - x; out.push(`${fmt(cur)} ${op === "+" ? "+" : "−"} ${fmt(x)} = ${fmt(nx)}`); cur = nx; }
    if (out.length === 1) return [`${fmt(a)} ${op === "+" ? "+" : "−"} ${fmt(b)} = ${fmt(cur)}`];
    return [(op === "+" ? "Прибавляем по разрядам:" : "Вычитаем по разрядам:"), ...out];
  }

  function addSubTask(mode, a, b, op) {
    const v = op === "+" ? a + b : a - b, ans = NUM(v);
    const big = v >= 1000 || a >= 1000;
    const tiers = op === "+"
      ? [[noCarryAdd(a, b), v + 10, v - 10, v + 100 * (big ? 10 : 1)], [v + 1, v - 1, v - 100, v + 100]]
      : [[smallFromLarge(a, b), noReduce(a, b), v + 10, v - 10], [v + 100, v - 100, v + 1, v - 1, big ? v + 1000 : null]];
    return { mode, q: `${fmt(a)} ${op === "+" ? "+" : "−"} ${fmt(b)} = ?`, ans, wrong: pickWrong(ans, tiers), ex: placeSteps(a, b, op) };
  }
  function gen(fn, test, tries = 800) { for (let i = 0; i < tries; i++) { const r = fn(); if (test(r)) return r; } return null; }

  /* ---------------- режимы ---------------- */
  const M = {};

  M.mul = (L) => {
    if (L === 3 && Math.random() < .5) {
      const a = R(3, 9), b = R(3, 9), p = a * b, left = Math.random() < .5;
      const x = left ? a : b, other = left ? b : a, ans = NUM(x);
      return {
        mode: "mul", q: left ? `? × ${b} = ${p}` : `${a} × ? = ${p}`, ans,
        wrong: pickWrong(ans, [[x + 1, x - 1, other], [x + 2, x - 2, x + 10]]),
        ex: ["Неизвестный множитель находим делением:", `${p} : ${other} = ${x}`, `Проверка: ${a} × ${b} = ${p}`]
      };
    }
    let a, b;
    if (L === 1) { a = R(2, 5); b = R(2, 9); }
    else if (L === 2) { do { a = R(2, 9); b = R(2, 9); } while (Math.max(a, b) < 6); }
    else { a = R(6, 9); b = R(6, 9); }
    if (Math.random() < .5) [a, b] = [b, a];
    const p = a * b, ans = NUM(p);
    return {
      mode: "mul", q: `${a} × ${b} = ?`, ans,
      wrong: pickWrong(ans, [[a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b], [p + 10, p - 10, swapDigits(p), a + b, p + 1, p - 1]]),
      ex: b > 2
        ? [`${a} × ${b - 1} = ${a * (b - 1)}`, `и ещё ${a}: ${a * (b - 1)} + ${a} = ${p}`]
        : [`${a} × 2 — это ${a} + ${a} = ${p}`]
    };
  };

  M.div = (L) => {
    if (L === 3) {
      if (Math.random() < .5) {
        const b = R(2, 9), c = R(2, 9), n = b * c * 10, v = c * 10, ans = NUM(v);
        return {
          mode: "div", q: `${n} : ${b} = ?`, ans,
          wrong: pickWrong(ans, [[c, v + 10, v - 10], [c * 100, v + 1, v + 20]]),
          ex: [`${n} — это ${b * c} десятков`, `${b * c} дес. : ${b} = ${c} дес. = ${v}`]
        };
      }
      const b = R(2, 6), c = gen(() => R(11, Math.floor(99 / b)), (c) => c % 10 !== 0), n = b * c, ans = NUM(c);
      const t = Math.floor(c / 10), u = c % 10;
      return {
        mode: "div", q: `${n} : ${b} = ?`, ans,
        wrong: pickWrong(ans, [[c + 1, c - 1, c + 10, c - 10], [c + 2, c - 2]]),
        ex: [`${n} = ${b * t * 10} + ${b * u}`, `${b * t * 10} : ${b} = ${t * 10}`, `${b * u} : ${b} = ${u}`, `${t * 10} + ${u} = ${c}`]
      };
    }
    let b, c;
    if (L === 1) { b = R(2, 5); c = R(2, 9); }
    else { do { b = R(2, 9); c = R(2, 9); } while (Math.max(b, c) < 6); }
    const n = b * c, ans = NUM(c);
    return {
      mode: "div", q: `${n} : ${b} = ?`, ans,
      wrong: pickWrong(ans, [[c + 1, c - 1, b !== c ? b : null], [c + 2, c - 2, c + 10]]),
      ex: [`${n} : ${b} = ${c}, потому что`, `${c} × ${b} = ${n}`]
    };
  };

  M.addsub = (L) => {
    const op = Math.random() < .5 ? "+" : "−";
    let r;
    if (op === "+") {
      const need = L - 1; // 0, 1 или 2 перехода через разряд
      r = gen(() => { const a = R(100, 899), b = L === 1 ? (Math.random() < .3 ? R(10, 99) : R(100, 899)) : R(15, 899); return [a, b]; },
        ([a, b]) => a + b <= 999 && carries(a, b) === need);
    } else {
      r = gen(() => { let a = R(200, 999); if (L === 3 && Math.random() < .5) a = R(2, 9) * 100 + (Math.random() < .5 ? 0 : R(1, 9)); return [a, R(L === 1 ? 10 : 15, a - 10)]; },
        ([a, b]) => b > 0 && b < a && (L === 1 ? borrows(a, b) === 0 : L === 2 ? borrows(a, b) === 1 : borrows(a, b) >= 2));
    }
    return addSubTask("addsub", r[0], r[1], op);
  };

  M.big = (L) => {
    const op = Math.random() < .5 ? "+" : "−";
    let r;
    if (L === 1) {
      const rnd = () => R(1, 8) * 1000 + R(0, 9) * 100;
      r = op === "+" ? gen(() => [rnd(), rnd()], ([a, b]) => a + b <= 9900 && carries(a, b) === 0)
        : gen(() => [rnd(), rnd()], ([a, b]) => b < a && borrows(a, b) === 0);
    } else if (L === 2) {
      r = op === "+" ? gen(() => [R(1000, 8999), R(100, 8999)], ([a, b]) => a + b <= 9999 && carries(a, b) >= 1 && carries(a, b) <= 2)
        : gen(() => { const a = R(2000, 9999); return [a, R(1000, a - 100)]; }, ([a, b]) => b < a && borrows(a, b) >= 1 && borrows(a, b) <= 2);
    } else {
      r = op === "+" ? gen(() => [R(1000, 8999), R(1000, 8999)], ([a, b]) => a + b <= 10000 && carries(a, b) >= 3)
        : gen(() => { const k = R(2, 10), a = pick([k * 1000, k * 1000, k * 1000 + R(1, 9), k * 1000 + R(1, 9) * 10]); return [Math.min(a, 10000), R(1001, Math.min(a, 10000) - 1)]; },
          ([a, b]) => b < a && b % 10 !== 0 && borrows(a, b) >= 2);
    }
    return addSubTask("big", r[0], r[1], op);
  };

  M.mul2 = (L) => {
    const a = L === 1 ? gen(() => R(11, 29), (a) => a % 10 !== 0) : L === 2 ? gen(() => R(21, 49), (a) => a % 10 !== 0) : gen(() => R(51, 99), (a) => a % 10 !== 0);
    const b = L === 1 ? R(2, 5) : L === 2 ? R(3, 9) : R(4, 9);
    const T = Math.floor(a / 10), U = a % 10, p = a * b, ans = NUM(p);
    return {
      mode: "mul2", q: `${a} × ${b} = ?`, ans,
      wrong: pickWrong(ans, [[T * 10 * b + U, T * b * 10 + (U * b) % 10, p + 10, p - 10], [p + b, p - b, T * 10 + U * b, p + 1]]),
      ex: [`${a} = ${T * 10} + ${U}`, `${T * 10} × ${b} = ${T * 10 * b}`, `${U} × ${b} = ${U * b}`, `${T * 10 * b} + ${U * b} = ${p}`]
    };
  };

  /* ---------- порядок действий ---------- */
  const OPS = { "+": (a, b) => a + b, "−": (a, b) => a - b, "×": (a, b) => a * b, ":": (a, b) => (b ? a / b : NaN) };
  const N = (v) => ({ v });
  const O = (o, l, r, br) => ({ o, l, r, br: !!br, v: OPS[o](l.v, r.v) });
  const A = (l, r, br) => O("+", l, r, br), S = (l, r, br) => O("−", l, r, br), X = (l, r, br) => O("×", l, r, br), D = (l, r, br) => O(":", l, r, br);
  const okTree = (t) => !t.o || (Number.isInteger(t.v) && t.v >= 0 && t.v <= 200 && okTree(t.l) && okTree(t.r));
  const str = (t) => (t.o ? (t.br ? "(" : "") + str(t.l) + " " + t.o + " " + str(t.r) + (t.br ? ")" : "") : String(t.v));
  const stepsOf = (t, out = []) => { if (t.o) { stepsOf(t.l, out); stepsOf(t.r, out); out.push(t); } return out; };

  // вычисление строки по школьным правилам (и с намеренными ошибками)
  function tokens(s) { return s.match(/\d+|[()+−×:]/g); }
  function evalSchool(s) {
    const tk = tokens(s); let i = 0;
    const factor = () => { if (tk[i] === "(") { i++; const v = expr(); i++; return v; } return +tk[i++]; };
    const term = () => { let v = factor(); while (tk[i] === "×" || tk[i] === ":") { const o = tk[i++]; v = OPS[o](v, factor()); } return v; };
    const expr = () => { let v = term(); while (tk[i] === "+" || tk[i] === "−") { const o = tk[i++]; v = OPS[o](v, term()); } return v; };
    return expr();
  }
  // ошибка: «всё подряд слева направо», скобки и старшинство не замечены
  function evalLeftToRight(s) { const tk = tokens(s).filter((x) => x !== "(" && x !== ")"); let v = +tk[0]; for (let i = 1; i < tk.length; i += 2) v = OPS[tk[i]](v, +tk[i + 1]); return v; }
  // ошибка: скобки не замечены, но × и : сделаны первыми
  const evalNoBrackets = (s) => evalSchool(s.replace(/[()]/g, ""));

  const t9 = () => R(2, 9);
  const ORDER = {
    1: [
      () => A(N(R(2, 60)), X(N(t9()), N(t9()))),
      () => { const b = t9(), c = t9(); return S(N(b * c + R(1, 40)), X(N(b), N(c))); },
      () => { const a = t9(), b = t9(); return S(X(N(a), N(b)), N(R(1, a * b - 1))); },
      () => A(X(N(t9()), N(t9())), N(R(2, 40))),
      () => { const c = t9(), q = t9(); return A(N(R(2, 50)), D(N(c * q), N(c))); },
      () => { const c = t9(), q = t9(); return S(N(q + R(1, 50)), D(N(c * q), N(c))); },
      () => { const b = t9(), q = t9(); return A(D(N(b * q), N(b)), N(R(2, 40))); },
      () => { const a = R(20, 90), b = R(2, a - 1); return A(S(N(a), N(b)), N(R(2, 30))); },
      () => { const b = t9(), q = R(2, 5), c = R(2, 5); return X(D(N(b * q), N(b)), N(c)); }
    ],
    2: [
      () => { const a = R(1, 8), b = R(1, 9 - a + 1); return X(A(N(a), N(b), 1), N(t9())); },
      () => { const d = t9(), b = R(2, 30); return X(S(N(b + d), N(b), 1), N(t9())); },
      () => { const c = t9(), q = t9(), s = c * q, a = R(1, s - 1); return D(A(N(a), N(s - a), 1), N(c)); },
      () => { const c = t9(), q = t9(), b = R(2, 40); return D(S(N(c * q + b), N(b), 1), N(c)); },
      () => { const a = R(1, 8), b = R(1, 9 - a + 1); return X(N(t9()), A(N(a), N(b), 1)); },
      () => { const d = t9(), c = R(1, 20); return X(N(t9()), S(N(c + d), N(c), 1)); },
      () => { const d = t9(), q = t9(), c = R(1, 20); return D(N(d * q), S(N(c + d), N(c), 1)); },
      () => { const a = R(40, 99), b = R(5, Math.floor(a / 2)), c = R(2, a - b - 1); return S(N(a), A(N(b), N(c), 1)); },
      () => { const a = R(30, 99), b = R(10, a), c = R(1, b - 1); return S(N(a), S(N(b), N(c), 1)); }
    ],
    3: [
      () => { const a = R(1, 6), b = R(1, 9 - a + 1), c = t9(), p = (a + b) * c; return S(X(A(N(a), N(b), 1), N(c)), N(R(1, p - 1))); },
      () => { const c = t9(), q = t9(), b = R(2, 40); return A(D(S(N(c * q + b), N(b), 1), N(c)), N(R(2, 40))); },
      () => { const b = t9(), c = t9(), a = R(2, 40); return S(A(N(a), X(N(b), N(c))), N(R(1, a + b * c - 1))); },
      () => { const a = t9(), b = t9(), c = t9(), d = t9(); return S(X(N(a), N(b)), X(N(c), N(d))); },
      () => { const b = t9(), q = t9(); return A(D(N(b * q), N(b)), X(N(t9()), N(t9()))); },
      () => { const c = t9(), q = R(2, 5), s = c * q, x = R(1, s - 1); return X(D(A(N(x), N(s - x), 1), N(c)), N(R(2, 9))); },
      () => { const d = t9(), q = t9(), s = d * q, x = R(1, s - 1); return S(N(q + R(1, 60)), D(A(N(x), N(s - x), 1), N(d))); },
      () => { const e = t9(), b = R(1, 30), f = R(2, 9), c = R(1, f - 1); return X(S(N(b + e), N(b), 1), A(N(c), N(f - c), 1)); },
      () => { const c = R(1, 30), e = t9(); return A(N(R(2, 40)), X(S(N(c + e), N(c), 1), N(t9()))); }
    ]
  };
  const OP_NAME = { "+": "сложение", "−": "вычитание", "×": "умножение", ":": "деление" };
  M.order = (L) => {
    const t = gen(() => pick(ORDER[L])(), (t) => okTree(t) && t.v > 0 && evalSchool(str(t)) === t.v);
    const s = str(t), v = t.v, ans = NUM(v), steps = stepsOf(t);
    const inter = steps.slice(0, -1).map((x) => x.v);
    const wrong = pickWrong(ans, [[evalLeftToRight(s), evalNoBrackets(s)], inter.concat([v + 10, v - 10]), [v + 1, v - 1, v + 2]]);
    const hasBr = steps.some((x) => x.br);
    const lvl = (o) => (o === "+" || o === "−" ? 1 : 2);
    const same = !hasBr && steps.every((x) => lvl(x.o) === lvl(steps[0].o));
    const words = ["Сначала", "потом", "затем"];
    const ex = steps.map((x, i) => `${words[i]} ${x.br ? "действие в скобках" : OP_NAME[x.o]}: ${x.l.v} ${x.o} ${x.r.v} = ${x.v}`);
    if (same) ex.unshift("Действия одной ступени — по порядку слева направо.");
    return { mode: "order", q: s + " = ?", ans, wrong, ex };
  };

  /* ---------- деление с остатком ---------- */
  const REM = (q, r) => ({ key: q + "|" + r, main: String(q), sub: "ост. " + r, q, r });
  M.rem = (L) => {
    let b, q;
    if (L === 1) { b = R(2, 5); q = R(1, 9); }
    else if (L === 2) { b = R(3, 9); q = R(2, 9); }
    else { b = R(3, 9); q = R(10, Math.floor(98 / b)); }
    const r = R(1, b - 1), n = b * q + r, ans = REM(q, r);
    const w = [];
    if (q > 1) w.push(REM(q - 1, r + b)); // остаток больше делителя — частая ошибка
    w.push(REM(q + 1, r));
    if (r + 1 < b) w.push(REM(q, r + 1)); else w.push(REM(q, r - 1 >= 1 ? r - 1 : r + 1));
    const tier2 = [REM(q, b - r), q > 1 ? REM(q - 1, r) : null, REM(q + 1, r > 1 ? r - 1 : r + 1), r > 1 ? REM(q, r - 1) : null].filter(Boolean);
    return {
      mode: "rem", q: `${n} : ${b} = ?`, ans,
      wrong: pickWrong(ans, [w, tier2, [REM(q + 2, r), REM(q, 0)]]),
      ex: [`Ближайшее меньшее число, которое делится на ${b}: ${b * q}`, `${b * q} : ${b} = ${q}`, `Остаток: ${n} − ${b * q} = ${r}`, `Остаток меньше делителя: ${r} < ${b}`]
    };
  };

  /* ---------- единицы измерения ---------- */
  const UNITS = [
    // [крупная, мелкая, во сколько раз, семья, подсказка, только «1 = ?»]
    ["км", "м", 1000, "len", "«Кило» значит «тысяча»"],
    ["м", "дм", 10, "len", "В метре 10 дециметров"],
    ["м", "см", 100, "len", "1 м = 10 дм, а 1 дм = 10 см, поэтому 10 × 10 = 100"],
    ["м", "мм", 1000, "len", "1 м = 100 см, а 1 см = 10 мм, поэтому 100 × 10 = 1000"],
    ["дм", "см", 10, "len", "В дециметре 10 сантиметров"],
    ["дм", "мм", 100, "len", "1 дм = 10 см, а 1 см = 10 мм, поэтому 10 × 10 = 100"],
    ["см", "мм", 10, "len", "В сантиметре 10 миллиметров"],
    ["т", "кг", 1000, "mass", "В тонне тысяча килограммов"],
    ["т", "ц", 10, "mass", "1 т = 1000 кг, а 1 ц = 100 кг, поэтому 1000 : 100 = 10"],
    ["ц", "кг", 100, "mass", "В центнере 100 килограммов"],
    ["кг", "г", 1000, "mass", "«Кило» значит «тысяча»"],
    ["ч", "мин", 60, "time", "Минутная стрелка проходит круг за 60 минут"],
    ["мин", "с", 60, "time", "Секундная стрелка проходит круг за 60 секунд"],
    ["сут.", "ч", 24, "time", "Сутки — это день и ночь, 24 часа"],
    ["нед.", "сут.", 7, "time", "В неделе 7 дней"],
    ["год", "мес.", 12, "time", "В году 12 месяцев", 1],
    ["век", "лет", 100, "time", "Век — это 100 лет", 1]
  ];
  const ALT = { len: [10, 100, 1000], mass: [10, 100, 1000], time: [60, 100, 24, 12, 10] };
  M.units = (L) => {
    const pool = L === 1 ? UNITS : UNITS.filter((u) => !u[5]);
    const [B, s, f, fam, hint] = pick(pool);
    const alts = ALT[fam].filter((x) => x !== f);
    if (L === 1) {
      const ans = NUM(f);
      return { mode: "units", q: `1 ${B} = ? ${s}`, ans, wrong: pickWrong(ans, [alts, [10, 100, 1000, 60]]), ex: [`1 ${B} = ${fmt(f)} ${s}`, hint] };
    }
    if (L === 2) {
      const n = R(2, 9);
      if (Math.random() < .35) { // обратная задача: 300 см = ? м
        const ans = NUM(n);
        return {
          mode: "units", q: `${fmt(n * f)} ${s} = ? ${B}`, ans,
          wrong: pickWrong(ans, [alts.map((a) => (n * f) % a === 0 ? (n * f) / a : null), [n + 1, n - 1, n * 10]]),
          ex: [`1 ${B} = ${fmt(f)} ${s}`, `${fmt(n * f)} : ${fmt(f)} = ${n}`]
        };
      }
      const v = n * f, ans = NUM(v);
      return {
        mode: "units", q: `${n} ${B} = ? ${s}`, ans,
        wrong: pickWrong(ans, [alts.map((a) => n * a), [v + f, v - f, n + f]]),
        ex: [`1 ${B} = ${fmt(f)} ${s}`, `${n} × ${fmt(f)} = ${fmt(v)}`]
      };
    }
    const n = R(1, 9);
    let m;
    if (f === 1000) m = pick([R(1, 9) * 100, R(1, 9) * 10, R(1, 99) * 10, R(1, 999)]);
    else m = R(1, f - 1);
    const v = n * f + m, ans = NUM(v);
    const concat = +(String(n) + String(m));
    return {
      mode: "units", q: `${n} ${B} ${fmt(m)} ${s} = ? ${s}`, ans,
      wrong: pickWrong(ans, [[concat, ...(fam === "time" ? [100] : alts).filter((a) => a > m).map((a) => n * a + m)], [v + 10, v - 10, n * f, f >= 100 ? v + 100 : v + 1]]),
      ex: n === 1 ? [`1 ${B} = ${fmt(f)} ${s}`, `${fmt(f)} + ${fmt(m)} = ${fmt(v)}`]
        : [`1 ${B} = ${fmt(f)} ${s}`, `${n} ${B} = ${n} × ${fmt(f)} = ${fmt(n * f)} ${s}`, `${fmt(n * f)} + ${fmt(m)} = ${fmt(v)}`]
    };
  };

  const MODES = ["mul", "div", "addsub", "mul2", "order", "rem", "units", "big"];
  function make(mode, L, used) {
    let t;
    for (let i = 0; i < 40; i++) {
      const m = mode === "mix" ? pick(MODES) : mode;
      t = M[m](L);
      if (!used || !used.has(t.q)) break;
    }
    if (used) used.add(t.q);
    return t;
  }

  root.BT = { make, MODES, fmt, evalSchool, evalLeftToRight, UNITS, _M: M };
})(typeof window !== "undefined" ? window : globalThis);
