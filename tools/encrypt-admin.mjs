// Шифрует содержимое админ-панели логином и паролем админа.
// В репозиторий попадает только шифр (site/admin-data.js); логин, пароль и исходник панели — нет.
// Запуск: node tools/encrypt-admin.mjs <creds.json> <panel.html>
import { readFileSync, writeFileSync } from "node:fs";
import { webcrypto as wc } from "node:crypto";

const [credsPath, panelPath] = process.argv.slice(2);
if (!credsPath || !panelPath) { console.error("usage: node tools/encrypt-admin.mjs creds.json panel.html"); process.exit(1); }
const { login, password } = JSON.parse(readFileSync(credsPath, "utf8"));
const panel = readFileSync(panelPath, "utf8");
const ITER = 600000;
const enc = new TextEncoder();
const b64 = (u8) => Buffer.from(u8).toString("base64");

const salt = wc.getRandomValues(new Uint8Array(16));
const iv = wc.getRandomValues(new Uint8Array(12));
const base = await wc.subtle.importKey("raw", enc.encode(login.trim() + "\u0000" + password), "PBKDF2", false, ["deriveKey"]);
const key = await wc.subtle.deriveKey({ name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
const ct = new Uint8Array(await wc.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(panel)));
const out = `/* Зашифрованная админ-панель «Капли» (AES-256-GCM, ключ PBKDF2-SHA256 ${ITER} итераций). Без логина и пароля не расшифровать. */\nwindow.ADMIN_BLOB = ${JSON.stringify({ v: 1, iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) })};\n`;
writeFileSync(new URL("../site/admin-data.js", import.meta.url), out);
console.log("site/admin-data.js:", out.length, "bytes");
