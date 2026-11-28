// Создаёт site/accounts.js — список аккаунтов сайта БЕЗ паролей (только соль и PBKDF2-отпечаток).
// Запуск: node tools/make-accounts.mjs <accounts.json>   где accounts.json = [{"login":"...","password":"..."}]
// Сам accounts.json в git не попадает (.accounts.local.json в .gitignore).
import { readFileSync, writeFileSync } from "node:fs";
import { webcrypto as wc } from "node:crypto";

const src = process.argv[2];
if (!src) { console.error("usage: node tools/make-accounts.mjs accounts.json"); process.exit(1); }
const list = JSON.parse(readFileSync(src, "utf8"));
const ITER = 210000;
const enc = new TextEncoder();
const b64 = (u8) => Buffer.from(u8).toString("base64");

async function hash(login, password, salt) {
  const key = await wc.subtle.importKey("raw", enc.encode(login.trim().toLowerCase() + "\u0000" + password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await wc.subtle.deriveBits({ name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" }, key, 256));
}

const out = [];
for (const a of list) {
  const salt = wc.getRandomValues(new Uint8Array(16));
  out.push({ s: b64(salt), h: b64(await hash(a.login, a.password, salt)) });
}
const js = `/* Аккаунты сайта «Капля»: только соль и PBKDF2-SHA256 (${ITER} итераций) от «логин + пароль». Паролей здесь нет. */\nwindow.KAPLYA_ACCOUNTS = { iter: ${ITER}, list: ${JSON.stringify(out)} };\n`;
writeFileSync(new URL("../site/accounts.js", import.meta.url), js);
console.log("site/accounts.js:", out.length, "accounts");
