// Шифрует содержимое админ-панели так, чтобы её открывал любой из нескольких администраторов.
// Панель шифруется случайным ключом; этот ключ «заворачивается» отдельно логином+паролем каждого админа.
// В репозиторий попадает только шифр (site/admin-data.js); логины, пароли и исходник панели — нет.
// Запуск: node tools/encrypt-admin.mjs <panel.html> <creds1.json> [creds2.json ...]
//   creds.json: {"login": "...", "password": "..."} или массив таких объектов
import { readFileSync, writeFileSync } from "node:fs";
import { webcrypto as wc } from "node:crypto";

const [panelPath, ...credFiles] = process.argv.slice(2);
if (!panelPath || !credFiles.length) { console.error("usage: node tools/encrypt-admin.mjs panel.html creds.json [...]"); process.exit(1); }
const creds = credFiles.flatMap((f) => [].concat(JSON.parse(readFileSync(f, "utf8"))));
const panel = readFileSync(panelPath, "utf8");
const ITER = 600000;
const enc = new TextEncoder();
const b64 = (u8) => Buffer.from(u8).toString("base64");
const rnd = (n) => wc.getRandomValues(new Uint8Array(n));

const dataKey = rnd(32);
const iv = rnd(12);
const dk = await wc.subtle.importKey("raw", dataKey, "AES-GCM", false, ["encrypt"]);
const ct = new Uint8Array(await wc.subtle.encrypt({ name: "AES-GCM", iv }, dk, enc.encode(panel)));
const keys = [];
for (const { login, password } of creds) {
  const salt = rnd(16), wiv = rnd(12);
  const base = await wc.subtle.importKey("raw", enc.encode(login.trim().toLowerCase() + "\u0000" + password), "PBKDF2", false, ["deriveKey"]);
  const kek = await wc.subtle.deriveKey({ name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  keys.push({ salt: b64(salt), iv: b64(wiv), wk: b64(new Uint8Array(await wc.subtle.encrypt({ name: "AES-GCM", iv: wiv }, kek, dataKey))) });
}
keys.sort(() => Math.random() - 0.5);
const out = `/* Зашифрованная админ-панель «Капли» (AES-256-GCM, ключи PBKDF2-SHA256 ${ITER} итераций). Без логина и пароля не расшифровать. */\nwindow.ADMIN_BLOB = ${JSON.stringify({ v: 2, iter: ITER, iv: b64(iv), ct: b64(ct), keys })};\n`;
writeFileSync(new URL("../site/admin-data.js", import.meta.url), out);
console.log("site/admin-data.js:", out.length, "bytes,", keys.length, "admins");
