// Снимает по 3 чётких скриншота каждого приложения (390×800, ×2) для сайта: site/shots/<id>-N.png
// Запуск: сервер из корня проекта на порту 8795, затем: node tools/shots.js [id ...]
// Потом: python3 tools/shots-webp.py — конвертирует в webp.
const { chromium } = require("playwright");
const path = require("path");
const OUT = path.join(__dirname, "..", "site", "shots");
const BASE = "http://localhost:8795/apps/";
const wait = (p, ms) => p.waitForTimeout(ms);
const clickIf = async (p, sel) => { const el = await p.$(sel); if (el && await el.isVisible()) { await el.click().catch(() => {}); return true; } return false; };

// Шаги для каждого приложения: функции, после каждой делается снимок.
const PLAN = {
  bust: [async (p) => wait(p, 3500), async (p) => { await clickIf(p, "#playBtn") || await clickIf(p, "button"); await wait(p, 3500); }],
  buddy: [
    async (p) => { await p.evaluate(() => { try { localStorage.setItem("buddy-english-v1", JSON.stringify({ name: "Аня", lessons: 9, xp: 160, cookies: 240, streak: 5, bestStreak: 5, lastDay: "", progress: { hello: 5, animals: 2 }, learned: [], cats: ["Мурзик"], owned: ["tophat"], outfit: "tophat", ach: { first: 1 }, quests: { day: "", c: {}, claimed: {} } })); } catch (e) {} }); await p.reload(); await wait(p, 1500); },
    async (p) => { await clickIf(p, ".node.current"); await wait(p, 900); await clickIf(p, "#nx"); await wait(p, 500); await clickIf(p, "#nx"); await wait(p, 700); },
    async (p) => { await p.evaluate(() => { const l = document.getElementById("lesson"); if (l) l.remove(); }); await clickIf(p, 'nav [data-tab="shop"]'); await wait(p, 900); }
  ],
  merge: [async (p) => wait(p, 1500), async (p) => { await clickIf(p, ".overlay .btn"); await wait(p, 600); const c = await p.$("canvas"); const b = c && await c.boundingBox(); if (b) for (let i = 0; i < 14; i++) { await p.mouse.click(b.x + 30 + (i * 53) % (b.width - 60), b.y + 60); await wait(p, 450); } await wait(p, 1200); }],
  space: [async (p) => wait(p, 2000), async (p) => { await clickIf(p, ".overlay .btn"); await wait(p, 4500); }],
  balloons: [async (p) => wait(p, 1500), async (p) => { await clickIf(p, ".overlay button") || await clickIf(p, ".overlay .btn"); await wait(p, 3000); }],
  breakout: [async (p) => wait(p, 1500), async (p) => { await clickIf(p, ".overlay .btn"); await wait(p, 700); await p.mouse.click(195, 520); await wait(p, 2200); }],
  multiply: [async (p) => wait(p, 1500), async (p) => { await clickIf(p, "[data-tilt]") || await clickIf(p, ".tcard"); await wait(p, 1200); }],
  words: [async (p) => wait(p, 1500), async (p) => { await clickIf(p, "[data-tilt]") || await clickIf(p, ".cat"); await wait(p, 1500); }],
  world: [async (p) => wait(p, 1500), async (p) => { await clickIf(p, "[data-tilt]") || await clickIf(p, ".cat"); await wait(p, 1200); const o = await p.$(".opt"); if (o) { await o.click(); await wait(p, 900); } }],
  grades: [async (p) => wait(p, 1500), async (p) => { await clickIf(p, '[data-act="add"]'); await wait(p, 800); }]
};

(async () => {
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(PLAN);
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  for (const id of ids) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    await p.goto(BASE + id + "/index.html");
    let n = 0;
    for (const step of PLAN[id]) { await step(p); await p.screenshot({ path: path.join(OUT, `${id}-${++n}.png`) }); }
    console.log(id, n);
    await ctx.close();
  }
  await browser.close();
})();
