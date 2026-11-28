// Сервер «Капли» для своего VPS. Node.js 20+, без внешних зависимостей.
// Что делает:
//  • отдаёт сайт только после входа (логин/пароль проверяет сервер, сессия — подписанная cookie);
//  • отдаёт APK только вошедшим (/apk/<id>.apk);
//  • ИИ-чат для «Бадди»: POST /api/chat?code=<код класса> {messages} → {reply} (GigaChat, запасной — OpenRouter);
//  • админка учеников: /server-admin (только для администратора).
// Настройки — переменные окружения (см. deploy/kaplya.env.example).
import http from "node:http";
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, createReadStream, renameSync } from "node:fs";
import { join, normalize, extname, dirname } from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV = process.env;
const PORT = +(ENV.PORT || 8080);
const SITE_DIR = ENV.SITE_DIR || join(HERE, "..");
const DATA_DIR = ENV.DATA_DIR || join(HERE, "..", ".data");
const SECRET = ENV.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const CHAT_CODE = ENV.CHAT_CODE || "";
const DAILY_PER_IP = +(ENV.CHAT_DAILY_PER_IP || 60);
const DAILY_TOTAL = +(ENV.CHAT_DAILY_TOTAL || 3000);
const SESSION_DAYS = 30;
mkdirSync(join(DATA_DIR, "apk"), { recursive: true });

/* ---------------- хранилище ---------------- */
const USERS = join(DATA_DIR, "users.json");
const STATS = join(DATA_DIR, "stats.json");
const readJSON = (f, d) => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return d; } };
const writeJSON = (f, v) => { const t = f + ".tmp"; writeFileSync(t, JSON.stringify(v, null, 1)); renameSync(t, f); };
let users = readJSON(USERS, null);
if (!users) {
  // первый запуск: переносим аккаунты сайта (только отпечатки, без паролей)
  const seed = readJSON(join(HERE, "seed.json"), { iter: 210000, list: [] });
  users = seed.list.map((a, i) => ({ id: crypto.randomUUID(), label: a.label || `Аккаунт ${i + 1}`, kind: "pbkdf2", iter: seed.iter, s: a.s, h: a.h, admin: !!a.admin, created: Date.now() }));
  writeJSON(USERS, users);
}
let stats = readJSON(STATS, { chat: {}, downloads: {}, logins: 0 });
let statsDirty = false;
setInterval(() => { if (statsDirty) { writeJSON(STATS, stats); statsDirty = false; } }, 15000).unref();
const today = () => new Date().toISOString().slice(0, 10);

/* ---------------- пароли ---------------- */
const pbkdf2 = (login, password, s, iter) => crypto.pbkdf2Sync(login.trim().toLowerCase() + "\u0000" + password, Buffer.from(s, "base64"), iter, 32, "sha256");
const scrypt = (password, s) => crypto.scryptSync(password, Buffer.from(s, "base64"), 32, { N: 16384, r: 8, p: 1 });
const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(a, b);
function findUser(login, password) {
  const l = String(login || "").trim().toLowerCase(), p = String(password || "");
  if (!l || !p || l.length > 80 || p.length > 200) return null;
  for (const u of users) {
    if (u.kind === "scrypt" && u.login === l && same(scrypt(p, u.s), Buffer.from(u.h, "base64"))) return u;
    if (u.kind === "pbkdf2" && same(pbkdf2(l, p, u.s, u.iter), Buffer.from(u.h, "base64"))) return u;
  }
  return null;
}
function newPassword() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789", S = "!#%*+-=?@_";
  const pick = (set, n) => Array.from(crypto.randomBytes(n), (b) => set[b % set.length]).join("");
  return pick(A, 6) + pick(S, 1) + pick(A, 5) + pick(S, 1) + pick(A, 4);
}

/* ---------------- сессии (подписанная cookie) ---------------- */
const sign = (v) => crypto.createHmac("sha256", SECRET).update(v).digest("base64url");
function makeSession(u) {
  const body = Buffer.from(JSON.stringify({ uid: u.id, exp: Date.now() + SESSION_DAYS * 864e5 })).toString("base64url");
  return body + "." + sign(body);
}
function readSession(req) {
  const m = /(?:^|;\s*)kaplya=([^;]+)/.exec(req.headers.cookie || "");
  if (!m) return null;
  const [body, sig] = m[1].split(".");
  if (!body || !sig || !same(Buffer.from(sign(body)), Buffer.from(sig))) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString());
    if (s.exp < Date.now()) return null;
    return users.find((u) => u.id === s.uid) || null;
  } catch { return null; }
}
const cookie = (v, maxAge) => `kaplya=${v}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

/* ---------------- ограничения частоты ---------------- */
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now(), h = hits.get(key) || { n: 0, t: now };
  if (now - h.t > windowMs) { h.n = 0; h.t = now; }
  h.n++; hits.set(key, h);
  return h.n > max;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (now - v.t > 864e5) hits.delete(k); }, 36e5).unref();

/* ---------------- ответы ---------------- */
const ip = (req) => (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
function send(res, code, body, headers = {}) {
  const data = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(code, { "Content-Type": typeof body === "object" && !Buffer.isBuffer(body) ? "application/json; charset=utf-8" : "text/plain; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(data);
}
async function readBody(req, max = 64 * 1024) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > max) throw new Error("too big"); chunks.push(c); }
  const raw = Buffer.concat(chunks).toString();
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}

/* ---------------- статика ---------------- */
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ico": "image/x-icon", ".glb": "model/gltf-binary", ".apk": "application/vnd.android.package-archive", ".txt": "text/plain; charset=utf-8" };
const PUBLIC = [/^\/login\.html$/, /^\/shared\//, /^\/icons\//, /^\/site\/site\.css$/, /^\/favicon/];
const BLOCKED = /(^|\/)\.|\.md$|^\/(server|deploy|tools|android)\//;
function serveFile(res, rel, cacheable) {
  const file = normalize(join(SITE_DIR, rel));
  if (!file.startsWith(normalize(SITE_DIR))) return send(res, 403, "Нет доступа");
  let st; try { st = statSync(file); } catch { return send(res, 404, "Не найдено"); }
  if (st.isDirectory()) return serveFile(res, join(rel, "index.html"), cacheable);
  res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream", "Content-Length": st.size, "Cache-Control": cacheable ? "public, max-age=3600" : "no-cache", "X-Content-Type-Options": "nosniff" });
  createReadStream(file).pipe(res);
}

/* ---------------- ИИ-чат для «Бадди» ---------------- */
const SYSTEM = "You are Buddy, a kind and cheerful puppy from London who teaches English to Russian-speaking children aged 8-11 (A1 level). Answer in very simple English, 1-3 short sentences, add Russian translation of hard words in brackets. Gently correct mistakes. End with one easy question. Keep everything child-safe, never ask for personal data. No markdown.";
let giga = { token: "", exp: 0 };
async function gigachat(messages) {
  if (!ENV.GIGACHAT_KEY) throw new Error("no gigachat key");
  if (!giga.token || giga.exp < Date.now() + 60000) {
    const r = await fetch("https://ngw.devices.sberbank.ru:9443/api/v2/oauth", {
      method: "POST", headers: { Authorization: "Basic " + ENV.GIGACHAT_KEY, RqUID: crypto.randomUUID(), "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: "scope=" + (ENV.GIGACHAT_SCOPE || "GIGACHAT_API_PERS"), signal: AbortSignal.timeout(15000)
    });
    if (!r.ok) throw new Error("gigachat oauth " + r.status);
    const j = await r.json(); giga = { token: j.access_token, exp: j.expires_at || Date.now() + 25 * 60000 };
  }
  const r = await fetch("https://gigachat.devices.sberbank.ru/api/v1/chat/completions", {
    method: "POST", headers: { Authorization: "Bearer " + giga.token, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ model: ENV.GIGACHAT_MODEL || "GigaChat", messages, max_tokens: 300, temperature: 0.7 }), signal: AbortSignal.timeout(30000)
  });
  if (r.status === 401) giga.token = "";
  if (!r.ok) throw new Error("gigachat " + r.status);
  const j = await r.json(); return j.choices?.[0]?.message?.content || "";
}
async function openrouter(messages) {
  if (!ENV.OPENROUTER_KEY) throw new Error("no openrouter key");
  const models = (ENV.OPENROUTER_MODELS || "openrouter/free,meta-llama/llama-3.3-70b-instruct:free,google/gemma-3-27b-it:free").split(",");
  let last;
  for (const model of models) {
    try {
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST", headers: { Authorization: "Bearer " + ENV.OPENROUTER_KEY, "Content-Type": "application/json", "X-Title": "Kaplya Buddy" },
        body: JSON.stringify({ model: model.trim(), messages, max_tokens: 300 }), signal: AbortSignal.timeout(30000)
      });
      if (!r.ok) { last = new Error("openrouter " + r.status); continue; }
      const j = await r.json(); const t = j.choices?.[0]?.message?.content; if (t) return t;
    } catch (e) { last = e; }
  }
  throw last || new Error("openrouter failed");
}
async function chat(req, res, url) {
  if (!CHAT_CODE || url.searchParams.get("code") !== CHAT_CODE) return send(res, 403, { error: "bad code" }, CORS);
  const day = today(), who = ip(req);
  stats.chat[day] = stats.chat[day] || { n: 0 };
  if (stats.chat[day].n >= DAILY_TOTAL || limited("chat:" + who + ":" + day, DAILY_PER_IP, 864e5) || limited("chatm:" + who, 8, 60000))
    return send(res, 429, { error: "limit", reply: "Woof! Бадди устал и отдыхает. Давай продолжим завтра! (Let's talk tomorrow!)" }, CORS);
  const body = await readBody(req);
  const msgs = (Array.isArray(body.messages) ? body.messages : []).filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string").slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 600) }));
  if (!msgs.length) return send(res, 400, { error: "no messages" }, CORS);
  const messages = [{ role: "system", content: SYSTEM }, ...msgs];
  let reply = "", via = "";
  try { reply = await gigachat(messages); via = "gigachat"; } catch (e) {
    console.warn("gigachat:", e.message);
    try { reply = await openrouter(messages); via = "openrouter"; } catch (e2) { console.warn("openrouter:", e2.message); }
  }
  if (!reply) return send(res, 502, { error: "ai unavailable" }, CORS);
  stats.chat[day].n++; stats.chat[day][via] = (stats.chat[day][via] || 0) + 1; statsDirty = true;
  send(res, 200, { reply: reply.replace(/<think>[\s\S]*?<\/think>/g, "").trim() }, CORS);
}
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };

/* ---------------- админка ---------------- */
async function admin(req, res, me, path) {
  if (!me?.admin) return send(res, 403, { error: "admin only" });
  if (req.method === "GET" && path === "/api/admin/state") {
    const days = Object.keys(stats.chat).sort().slice(-14).map((d) => ({ day: d, ...stats.chat[d] }));
    return send(res, 200, { users: users.map((u) => ({ id: u.id, label: u.label, login: u.login || null, admin: u.admin, created: u.created, last: u.last || null })), chat: days, downloads: stats.downloads, logins: stats.logins, chatUrl: CHAT_CODE ? `https://${req.headers.host}/api/chat?code=${CHAT_CODE}` : null, ai: { gigachat: !!ENV.GIGACHAT_KEY, openrouter: !!ENV.OPENROUTER_KEY } });
  }
  if (req.method === "POST" && path === "/api/admin/users") {
    const b = await readBody(req); const login = String(b.login || "").trim().toLowerCase();
    if (!/^[a-z0-9_.-]{3,40}$/.test(login)) return send(res, 400, { error: "Логин: 3–40 символов, латиница, цифры, _ . -" });
    if (users.some((u) => u.login === login)) return send(res, 409, { error: "Такой логин уже есть" });
    const password = newPassword(), s = crypto.randomBytes(16).toString("base64");
    users.push({ id: crypto.randomUUID(), label: String(b.label || login).slice(0, 60), login, kind: "scrypt", s, h: scrypt(password, s).toString("base64"), admin: !!b.admin, created: Date.now() });
    writeJSON(USERS, users);
    return send(res, 200, { login, password });
  }
  const m = /^\/api\/admin\/users\/([\w-]+)(\/reset)?$/.exec(path);
  if (m) {
    const u = users.find((x) => x.id === m[1]); if (!u) return send(res, 404, { error: "Нет такого аккаунта" });
    if (req.method === "DELETE") {
      if (u.id === me.id) return send(res, 400, { error: "Нельзя удалить самого себя" });
      users = users.filter((x) => x.id !== u.id); writeJSON(USERS, users); return send(res, 200, { ok: true });
    }
    if (req.method === "POST" && m[2]) {
      if (!u.login) return send(res, 400, { error: "У старого аккаунта нет логина на сервере — создай новый" });
      const password = newPassword(), s = crypto.randomBytes(16).toString("base64");
      Object.assign(u, { kind: "scrypt", s, h: scrypt(password, s).toString("base64") }); writeJSON(USERS, users);
      return send(res, 200, { login: u.login, password });
    }
  }
  send(res, 404, { error: "not found" });
}

/* ---------------- маршруты ---------------- */
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    const path = decodeURIComponent(url.pathname);
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "same-origin");

    if (path === "/api/chat") { if (req.method === "OPTIONS") return send(res, 204, "", CORS); if (req.method === "POST") return await chat(req, res, url); }
    if (path === "/api/health") return send(res, 200, { ok: true });
    if (path === "/api/login" && req.method === "POST") {
      if (limited("login:" + ip(req), 10, 10 * 60000)) return send(res, 429, { error: "Слишком много попыток. Подожди 10 минут." });
      const b = await readBody(req); const u = findUser(b.login, b.password);
      if (!u) return send(res, 401, { error: "Неверный логин или пароль." });
      u.last = Date.now(); writeJSON(USERS, users); stats.logins++; statsDirty = true;
      return send(res, 200, { ok: true, admin: u.admin }, { "Set-Cookie": cookie(makeSession(u), SESSION_DAYS * 86400) });
    }
    if (path === "/api/logout") return send(res, 200, { ok: true }, { "Set-Cookie": cookie("", 0) });

    const me = readSession(req);
    if (path === "/api/me") return me ? send(res, 200, { label: me.label, admin: me.admin }) : send(res, 401, { error: "no session" });
    if (path.startsWith("/api/admin/")) return await admin(req, res, me, path);
    if (BLOCKED.test(path)) return send(res, 404, "Не найдено");
    if (PUBLIC.some((r) => r.test(path))) return serveFile(res, path, path !== "/login.html");

    if (!me) {
      if (path.startsWith("/apk/") || path.startsWith("/api/")) return send(res, 401, "Нужен вход");
      res.writeHead(302, { Location: "/login.html?next=" + encodeURIComponent(path + url.search) }); return res.end();
    }
    const apk = /^\/apk\/kaplya-([a-z]+)\.apk$/.exec(path);
    if (apk) {
      const file = join(DATA_DIR, "apk", `kaplya-${apk[1]}.apk`);
      if (!existsSync(file)) return send(res, 404, "Файл ещё не скачан на сервер. Подожди 10 минут.");
      stats.downloads[apk[1]] = (stats.downloads[apk[1]] || 0) + 1; statsDirty = true;
      const st = statSync(file);
      res.writeHead(200, { "Content-Type": MIME[".apk"], "Content-Length": st.size, "Content-Disposition": `attachment; filename="kaplya-${apk[1]}.apk"`, "Cache-Control": "no-store" });
      return createReadStream(file).pipe(res);
    }
    if (path === "/server-admin") {
      if (!me.admin) {
        res.writeHead(403, { "Content-Type": MIME[".html"], "Cache-Control": "no-store" });
        return res.end(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Только для администратора — Капля</title>
<link rel="stylesheet" href="/shared/k.css"><script src="/shared/k.js"></script><style>.g{min-height:100vh;display:grid;place-items:center;padding:24px 16px}.c{width:min(420px,100%);padding:30px 24px;border-radius:28px;display:flex;flex-direction:column;gap:14px}.c h1{font-family:var(--f-display);font-weight:700;font-size:1.5rem;margin:0}.c p{margin:0;color:var(--muted)}.c .btn{width:100%}</style></head>
<body><main class="g"><div class="c glass"><span class="eyebrow">Управление сервером</span><h1>Только для администратора</h1>
<p>Сейчас ты вошёл как «${String(me.label).replace(/[<>&"]/g, "")}». Чтобы управлять учениками, выйди и войди логином администратора.</p>
<button class="btn" id="sw">Войти как администратор</button><a class="btn ghost" href="/">Вернуться на сайт</a></div></main>
<script>document.getElementById("sw").onclick=async()=>{await fetch("/api/logout");try{localStorage.removeItem("kaplya-session")}catch(e){}location.href="/login.html?next=%2Fserver-admin"}</script></body></html>`);
      }
      res.writeHead(200, { "Content-Type": MIME[".html"], "Cache-Control": "no-store" }); return res.end(readFileSync(join(HERE, "admin.html")));
    }
    return serveFile(res, path, /\.(webp|png|woff2|glb|js|css)$/.test(path));
  } catch (e) {
    console.error(e); if (!res.headersSent) send(res, 500, "Ошибка сервера");
  }
});
server.listen(PORT, "127.0.0.1", () => console.log(`Капля: http://127.0.0.1:${PORT}  (сайт: ${SITE_DIR}, данные: ${DATA_DIR}, аккаунтов: ${users.length})`));
