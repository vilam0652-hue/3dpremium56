/* Звёздный рейс — 3D-раннер на three.js r128.
   Картинки — 3D-иллюстрации Microsoft Fluent (MIT) как спрайты.
   Если в models/ лежат ship.glb / asteroid-1.glb / asteroid-2.glb / star.glb — берём их вместо спрайтов. */
(() => {
  "use strict";
  const BEST_ID = "space-m";            // рекорд в метрах
  const LOCK_Q = /[?&]hq\b/.test(location.search); // для скриншотов: не снижать качество
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const LANES = [-2.6, 0, 2.6];
  const T_SHIELD = 8, T_MAGNET = 9, T_NITRO = 4;

  const topBar = K.top({ title: "Звёздный рейс" });
  const $ = (id) => document.getElementById(id);

  // кнопка паузы в верхней панели
  const pauseBtn = document.createElement("button");
  pauseBtn.className = "k-back"; pauseBtn.setAttribute("aria-label", "Пауза"); pauseBtn.hidden = true;
  pauseBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4.2" height="14" rx="1.6"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.6"/></svg>`;
  topBar.insertBefore(pauseBtn, topBar.querySelector(".k-snd") || topBar.querySelector(".k-wallet"));

  // ---------- рендер ----------
  const cv = $("gl");
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: "high-performance" }); }
  catch (e) {
    K.panel({ title: "Нет 3D-графики", text: "На этом устройстве не включается 3D. Попробуй обновить браузер или телефон." });
    return;
  }
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  renderer.setPixelRatio(DPR);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050507);
  scene.fog = new THREE.FogExp2(0x050507, 0.0155);
  const cam = new THREE.PerspectiveCamera(62, 1, .1, 400);
  cam.position.set(0, 4.4, 10.5);
  let baseFov = 62;

  let composer = null, bloom = null, bloomScale = .5, useBloom = false;
  const BLOOM_BASE = .58;
  if (THREE.EffectComposer && THREE.UnrealBloomPass) {
    try {
      composer = new THREE.EffectComposer(renderer);
      composer.addPass(new THREE.RenderPass(scene, cam));
      bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), BLOOM_BASE, .55, .84);
      const bs = bloom.setSize.bind(bloom); // свечение считаем в уменьшенном размере — дешевле
      bloom.setSize = (w, h) => bs(Math.max(64, Math.round(w * bloomScale)), Math.max(64, Math.round(h * bloomScale)));
      composer.addPass(bloom);
      useBloom = true;
    } catch (e) { composer = null; bloom = null; }
  }

  // мягкие отражения (нужны для GLB-моделей)
  { const pm = new THREE.PMREMGenerator(renderer), env = new THREE.Scene();
    [[0xffffff, 6, 8, 4, 3], [0xf3d9a0, -7, 4, -3, 3], [0x6b5020, 0, -6, 6, 4], [0xffffff, 0, 6, -8, 2]].forEach(([c, x, y, z, r]) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, y, z); env.add(m); });
    scene.environment = pm.fromScene(env, .04).texture;
    env.traverse((n) => { if (n.isMesh) { n.geometry.dispose(); n.material.dispose(); } }); pm.dispose(); }
  scene.add(new THREE.HemisphereLight(0xfff2d6, 0x1a1408, .6));
  const sun = new THREE.DirectionalLight(0xffffff, 1); sun.position.set(4, 12, 8); scene.add(sun);
  const pl1 = new THREE.PointLight(0xd6b15e, 1.2, 30); pl1.position.set(-6, 4, 2); scene.add(pl1);

  // ---------- текстуры ----------
  const texLoader = new THREE.TextureLoader();
  const ART = { rocket: K.artSrc("rocket"), rock: K.artSrc("rock"), comet: K.artSrc("comet"), star: K.artSrc("star"),
    shield: K.artSrc("shield"), planet: K.artSrc("planet"), lightning: K.artSrc("lightning"), magnet: "art/magnet.webp" };
  const TEX = {};
  for (const n in ART) { TEX[n] = texLoader.load(ART[n]); TEX[n].anisotropy = 4; }

  function canvasTex(size, draw) {
    const c = document.createElement("canvas"); c.width = c.height = size;
    draw(c.getContext("2d"), size);
    return new THREE.CanvasTexture(c);
  }
  const radial = (stops) => (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    stops.forEach(([o, a]) => r.addColorStop(o, `rgba(255,255,255,${a})`));
    g.fillStyle = r; g.fillRect(0, 0, s, s);
  };
  const DOT = canvasTex(64, radial([[0, 1], [.2, .95], [.45, .35], [.7, .08], [1, 0]]));     // круглая точка-звезда
  const GLOW = canvasTex(128, radial([[0, 1], [.15, .7], [.4, .22], [.7, .05], [1, 0]]));    // мягкое свечение
  const RING = canvasTex(128, radial([[0, 0], [.55, 0], [.72, .25], [.86, .9], [.93, .35], [1, 0]])); // кольцо
  function cloudTex(rgb, seed) {
    let s = seed; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    return canvasTex(256, (g, S) => {
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 18; i++) {
        const x = S * (.2 + rnd() * .6), y = S * (.25 + rnd() * .5), r = S * (.12 + rnd() * .3);
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, `rgba(${rgb},${.14 + rnd() * .14})`); gr.addColorStop(1, `rgba(${rgb},0)`);
        g.fillStyle = gr; g.fillRect(0, 0, S, S);
      }
      g.globalCompositeOperation = "destination-in";
      const m = g.createRadialGradient(S / 2, S / 2, S * .15, S / 2, S / 2, S / 2);
      m.addColorStop(0, "rgba(0,0,0,1)"); m.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = m; g.fillRect(0, 0, S, S);
    });
  }

  // ---------- точки: звёздное небо и частицы (круглые, с мягким краем) ----------
  const PT_VS = `
    attribute float size; attribute vec4 col; attribute float tw;
    uniform float uScale, uMove, uWrap, uTime;
    varying vec4 vC;
    void main() {
      vec3 p = position; float a = col.a;
      if (uWrap > 0.) {
        p.z = mod(p.z + uMove, uWrap) - uWrap + 12.;
        a *= smoothstep(-uWrap + 12., -uWrap + 70., p.z) * (1. - smoothstep(5., 12., p.z));
      }
      float s = size;
      if (tw > 0.) { float k = .6 + .4 * sin(uTime * tw + p.x * 13.7 + p.y * 7.3); s *= .8 + .2 * k; a *= k; }
      vC = vec4(col.rgb, a);
      vec4 mv = modelViewMatrix * vec4(p, 1.);
      gl_PointSize = s * uScale / max(.1, -mv.z);
      gl_Position = projectionMatrix * mv;
    }`;
  const PT_FS = `
    uniform sampler2D map; varying vec4 vC;
    void main() { float t = texture2D(map, gl_PointCoord).a * vC.a; if (t < .004) discard; gl_FragColor = vec4(vC.rgb, t); }`;
  const ptLayers = [];
  function makePoints(n, wrap) {
    const g = new THREE.BufferGeometry();
    const P = new Float32Array(n * 3), S = new Float32Array(n), C = new Float32Array(n * 4), T = new Float32Array(n);
    g.setAttribute("position", new THREE.BufferAttribute(P, 3));
    g.setAttribute("size", new THREE.BufferAttribute(S, 1));
    g.setAttribute("col", new THREE.BufferAttribute(C, 4));
    g.setAttribute("tw", new THREE.BufferAttribute(T, 1));
    const u = { map: { value: DOT }, uScale: { value: 500 }, uMove: { value: 0 }, uWrap: { value: wrap || 0 }, uTime: { value: 0 } };
    const m = new THREE.ShaderMaterial({ uniforms: u, vertexShader: PT_VS, fragmentShader: PT_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts);
    const L = { pts, g, P, S, C, T, u }; ptLayers.push(L); return L;
  }
  const STAR_COLS = [[1, .97, .9], [1, .86, .58], [.95, .92, .85], [.78, .85, 1], [1, .78, .5]];
  const pick = (a) => a[(Math.random() * a.length) | 0];
  function fillStar(L, i, x, y, z, size, alpha, tw) {
    const c = pick(STAR_COLS);
    L.P[i * 3] = x; L.P[i * 3 + 1] = y; L.P[i * 3 + 2] = z; L.S[i] = size;
    L.C[i * 4] = c[0]; L.C[i * 4 + 1] = c[1]; L.C[i * 4 + 2] = c[2]; L.C[i * 4 + 3] = alpha; L.T[i] = tw;
  }
  // 1) дальнее небо — неподвижная сфера, мерцает
  const sky = makePoints(1100, 0);
  for (let i = 0; i < 1100; i++) {
    let x, y, z; do { x = Math.random() * 2 - 1; y = Math.random() * 2 - 1; z = Math.random() * 2 - 1; } while (x * x + y * y + z * z > 1 || z > -.15 || y < -.12);
    const l = Math.hypot(x, y, z), R = 250;
    const big = Math.random() < .05;
    fillStar(sky, i, x / l * R, y / l * R * .8 + 6, z / l * R, big ? 1.9 + Math.random() : .55 + Math.random() * .9, big ? 1 : .55 + Math.random() * .45, .6 + Math.random() * 2.2);
  }
  // 2) средний слой — звёзды пролетают мимо
  const mid = makePoints(520, 230);
  for (let i = 0; i < 520; i++) {
    const side = Math.random() < .5 ? -1 : 1;
    fillStar(mid, i, side * (6 + Math.random() * 80), -3 + Math.random() * 55, Math.random() * 230, .14 + Math.random() * .22, .5 + Math.random() * .5, 0);
  }
  // 3) ближняя пыль — чувство скорости
  const dust = makePoints(170, 130);
  for (let i = 0; i < 170; i++) fillStar(dust, i, (Math.random() - .5) * 30, -.2 + Math.random() * 9, Math.random() * 130, .05 + Math.random() * .05, .45, 0);
  sky.pts.renderOrder = -10;

  // ---------- частицы эффектов (пул, без созданий во время игры) ----------
  const FXN = 900, fx = makePoints(FXN, 0);
  const fxV = new Float32Array(FXN * 3), fxLife = new Float32Array(FXN), fxMax = new Float32Array(FXN), fxS0 = new Float32Array(FXN),
    fxA0 = new Float32Array(FXN), fxG = new Float32Array(FXN), fxW = new Float32Array(FXN), fxDrag = new Float32Array(FXN), fxGrow = new Float32Array(FXN);
  let fxCur = 0, fxLive = 0;
  function emit(x, y, z, vx, vy, vz, life, size, c, a = 1, opt = {}) {
    const i = fxCur; fxCur = (fxCur + 1) % FXN;
    fx.P[i * 3] = x; fx.P[i * 3 + 1] = y; fx.P[i * 3 + 2] = z;
    fxV[i * 3] = vx; fxV[i * 3 + 1] = vy; fxV[i * 3 + 2] = vz;
    fxLife[i] = fxMax[i] = life; fxS0[i] = size; fxA0[i] = a;
    fx.C[i * 4] = c[0]; fx.C[i * 4 + 1] = c[1]; fx.C[i * 4 + 2] = c[2]; fx.C[i * 4 + 3] = a; fx.S[i] = size;
    fxG[i] = opt.g || 0; fxW[i] = opt.w == null ? 1 : opt.w; fxDrag[i] = opt.drag || 0; fxGrow[i] = opt.grow || 0;
    fxLive = FXN;
  }
  function updateFx(dt, v) {
    if (!fxLive) return;
    let alive = 0;
    for (let i = 0; i < FXN; i++) {
      if (fxLife[i] <= 0) continue;
      fxLife[i] -= dt;
      if (fxLife[i] <= 0) { fx.S[i] = 0; fx.C[i * 4 + 3] = 0; continue; }
      alive++;
      const d = Math.max(0, 1 - fxDrag[i] * dt);
      fxV[i * 3] *= d; fxV[i * 3 + 1] = fxV[i * 3 + 1] * d - fxG[i] * dt; fxV[i * 3 + 2] *= d;
      fx.P[i * 3] += fxV[i * 3] * dt; fx.P[i * 3 + 1] += fxV[i * 3 + 1] * dt; fx.P[i * 3 + 2] += (fxV[i * 3 + 2] + v * fxW[i]) * dt;
      const k = fxLife[i] / fxMax[i];
      fx.S[i] = fxS0[i] * (fxGrow[i] ? 1 + (1 - k) * fxGrow[i] : Math.sqrt(k));
      fx.C[i * 4 + 3] = fxA0[i] * k;
    }
    fx.g.attributes.position.needsUpdate = true; fx.g.attributes.size.needsUpdate = true; fx.g.attributes.col.needsUpdate = true;
    if (!alive) fxLive = 0;
  }
  const C_GOLD = [1, .82, .45], C_WHITE = [1, .97, .88], C_FIRE = [1, .55, .18], C_HOT = [1, .9, .6], C_ROCK = [.75, .68, .55], C_RED = [1, .4, .3];
  function burst(p, n, cols, speed, life, size, opt) {
    for (let i = 0; i < n; i++) {
      let x, y, z; do { x = Math.random() * 2 - 1; y = Math.random() * 2 - 1; z = Math.random() * 2 - 1; } while (x * x + y * y + z * z > 1);
      const s = speed * (.4 + Math.random() * .8);
      emit(p.x, p.y, p.z, x * s, y * s + (opt && opt.up || 0), z * s, life * (.6 + Math.random() * .6), size * (.6 + Math.random() * .7), pick(cols), 1, opt);
    }
  }

  // вспышки-ореолы (пул спрайтов)
  const flashes = [];
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 }));
    s.visible = false; s.userData = { t: 0, d: 1, s0: 1, s1: 3 }; scene.add(s); flashes.push(s);
  }
  let flashCur = 0;
  function flashAt(p, color, s0, s1, d, tex) {
    const f = flashes[flashCur]; flashCur = (flashCur + 1) % flashes.length;
    f.material.map = tex || GLOW; f.material.color.set(color); f.position.copy(p);
    Object.assign(f.userData, { t: 0, d, s0, s1 }); f.visible = true;
  }
  function updateFlashes(dt, v) {
    for (const f of flashes) {
      if (!f.visible) continue;
      const u = f.userData; u.t += dt; const k = u.t / u.d;
      if (k >= 1) { f.visible = false; continue; }
      const e = 1 - Math.pow(1 - k, 3);
      f.scale.setScalar(u.s0 + (u.s1 - u.s0) * e); f.material.opacity = 1 - k; f.position.z += v * dt * .6;
    }
  }

  // ---------- космос: туманности, планета, свет горизонта ----------
  const deco = [];
  const mkSprite = (tex, size, o = {}) => {
    const m = new THREE.Sprite(new THREE.SpriteMaterial(Object.assign({ map: tex, transparent: true, depthWrite: false }, o)));
    m.scale.set(size, size, 1); return m;
  };
  [["214,177,94", 11, -70, 40, -215, 170, .55], ["156,100,50", 23, 60, 28, -225, 190, .5], ["110,90,170", 37, -15, 62, -235, 220, .32],
   ["214,177,94", 51, 90, 70, -240, 160, .3], ["60,90,150", 71, -110, 20, -230, 160, .28], ["230,150,90", 97, 20, 10, -215, 130, .3]]
    .forEach(([rgb, seed, x, y, z, s, o]) => {
      const n = mkSprite(cloudTex(rgb, seed), s, { blending: THREE.AdditiveBlending, fog: false, opacity: o, rotation: Math.random() * 6 });
      n.position.set(x, y, z); n.renderOrder = -9; n.userData.spin = (Math.random() - .5) * .02; scene.add(n); deco.push(n);
    });
  const planet = mkSprite(TEX.planet, 40, { fog: false, color: 0x9c968c });
  planet.position.set(-58, 34, -225); planet.renderOrder = -8; scene.add(planet);
  const horizon = mkSprite(GLOW, 1, { blending: THREE.AdditiveBlending, fog: false, color: 0xd6a04e, opacity: .32 });
  horizon.scale.set(330, 60, 1); horizon.position.set(0, -6, -215); horizon.renderOrder = -7; scene.add(horizon);

  // ---------- дорога из золотого света ----------
  const grid = new THREE.GridHelper(200, 80, 0x8c6a2a, 0x2c2418);
  grid.position.y = -.4; grid.material.transparent = true; grid.material.opacity = .4; grid.material.depthWrite = false; scene.add(grid);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 400), new THREE.MeshBasicMaterial({ color: 0x050507 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -.45, -150); ground.renderOrder = -5; scene.add(ground);
  const laneGeo = new THREE.PlaneGeometry(1, 220);
  [[-3.9, .1, .75], [-1.3, .05, .35], [1.3, .05, .35], [3.9, .1, .75]].forEach(([x, w, o]) => {
    const l = new THREE.Mesh(laneGeo, new THREE.MeshBasicMaterial({ color: 0xd6b15e, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false }));
    l.scale.x = w; l.rotation.x = -Math.PI / 2; l.position.set(x, -.38, -95); scene.add(l);
  });

  // ---------- ракета ----------
  const ship = new THREE.Group(); ship.position.set(0, .9, 0); scene.add(ship);
  const shipSprite = mkSprite(TEX.rocket, 2.7, { rotation: Math.PI / 4, color: 0xe4e0da }); shipSprite.position.y = .3; ship.add(shipSprite);
  const nozzleGlow = mkSprite(GLOW, 1.4, { blending: THREE.AdditiveBlending, color: 0xff9a40, opacity: .9 }); scene.add(nozzleGlow);
  const bubble = mkSprite(RING, 4.4, { blending: THREE.AdditiveBlending, color: 0xf3e3b0, opacity: 0, depthTest: false }); bubble.position.y = .2; ship.add(bubble);
  const aura = mkSprite(RING, 3, { blending: THREE.AdditiveBlending, color: 0xff7a8a, opacity: 0, depthTest: false }); aura.position.y = .2; ship.add(aura);
  const engineLight = new THREE.PointLight(0xffb060, 1.2, 6); engineLight.position.set(0, -.2, 1.6); ship.add(engineLight);
  let shipModel = null, nozzle = { y: -.85, z: .25, r: .85 };

  // настоящие 3D-модели, если положены в models/
  const MODELS = { rocks: [], star: null };
  function loadGLB(name, size) {
    return new Promise((res) => {
      if (!THREE.GLTFLoader) return res(null);
      new THREE.GLTFLoader().load("models/" + name, (g) => {
        const o = g.scene, box = new THREE.Box3().setFromObject(o), v = box.getSize(new THREE.Vector3());
        const k = size / Math.max(v.x, v.y, v.z, 1e-6); o.scale.setScalar(k);
        o.position.sub(box.getCenter(new THREE.Vector3()).multiplyScalar(k));
        o.traverse((n) => { if (n.isMesh && n.material) n.material.envMapIntensity = 1.2; });
        const w = new THREE.Group(); w.add(o); res(w);
      }, undefined, () => res(null));
    });
  }
  loadGLB("ship.glb", 3.4).then((m) => { if (!m) return; m.rotation.y = Math.PI; shipSprite.visible = false; shipModel = m; ship.add(m); nozzle = { y: 0, z: 1.75, r: 0 }; });
  ["asteroid-1.glb", "asteroid-2.glb"].forEach((f) => loadGLB(f, 2).then((m) => m && MODELS.rocks.push(m)));
  loadGLB("star.glb", 1.1).then((m) => { if (m) MODELS.star = m; });

  // ---------- объекты трассы (пулы, без утечек) ----------
  const pools = {};
  let objs = [];
  function take(kind, make) {
    const p = pools[kind] || (pools[kind] = []);
    const o = p.pop() || make();
    o.userData = { kind, dead: false };
    o.visible = true; scene.add(o); objs.push(o); return o;
  }
  function kill(o) { if (o.userData.dead) return; o.userData.dead = true; scene.remove(o); (pools[o.userData.kind] || (pools[o.userData.kind] = [])).push(o); }
  const BONUS = {
    shield: { tex: "shield", name: "Щит", color: 0xbcd8ff },
    magnet: { tex: "magnet", name: "Магнит", color: 0xff8a9a },
    nitro: { tex: "lightning", name: "Нитро", color: 0xffb050 }
  };
  function makeBonusSprite(b) {
    const s = mkSprite(TEX[BONUS[b].tex], 1.6, { fog: false });
    const halo = mkSprite(GLOW, 1.7, { blending: THREE.AdditiveBlending, color: BONUS[b].color, opacity: .8 });
    halo.position.z = -.05; s.add(halo);
    const ring = mkSprite(RING, 1.5, { blending: THREE.AdditiveBlending, color: 0xf3e3b0, opacity: .55 }); s.add(ring);
    return s;
  }

  // ---------- состояние ----------
  let lane = 1, speed = 0, dist = 0, stars = 0, lives = 3, playing = false, paused = false;
  let nextZ = 0, inv = 0, shieldT = 0, magnetT = 0, nitroT = 0, time = 0, last = 0;
  let timeScale = 1, slowT = 0, slowCd = 0, shake = 0, bloomPulse = 0, nitroK = 0;
  let prevFree = 1, rows = 0, lastBonusAt = 0, lastHitAt = 0, nears = 0, bonuses = 0, nitros = 0, emitAcc = 0;
  let camX = 0, lookX = 0, roll = 0, shipVx = 0, overT = 0;

  const $dist = $("dist"), $stars = $("stars"), $hearts = $("hearts"), $mrow = $("mrow"), $buffs = $("buffs"), $edges = $("edges");
  const HEART = `<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.4-9.3C1.2 8.2 3.4 4.5 7 4.5c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 3.6 0 5.8 3.7 4.4 7.2C19.5 16.4 12 21 12 21z" fill="#d6b15e" stroke="#f3e3b0"/></svg>`;
  const drawHearts = () => { $hearts.innerHTML = [0, 1, 2].map((i) => HEART.replace("<svg", `<svg class="${i < lives ? "" : "off"}"`)).join(""); };
  const bump = (el) => { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); };
  function pop(text, small) {
    const d = document.createElement("div"); d.className = "pop" + (small ? " small" : ""); d.textContent = text;
    document.body.appendChild(d); setTimeout(() => d.remove(), 1150);
  }
  const artImg = (n) => n === "magnet" ? "art/magnet.webp" : K.artSrc(n);

  // ---------- миссии на забег ----------
  const EXTRA = [
    { id: "bonus", icon: "sparkles", text: "Возьми 2 бонуса", goal: 2 },
    { id: "near", icon: "comet", text: "Проскочи у самого камня 3 раза", goal: 3 },
    { id: "clean", icon: "heart", text: "Пролети 600 м без ударов", goal: 600 },
    { id: "nitro", icon: "lightning", text: "Включи нитро", goal: 1 },
    { id: "stars10", icon: "star-glow", text: "Собери 10 звёзд за 300 м", goal: 10 }
  ];
  let missions = [];
  function newMissions() {
    const lastId = K.store.get("space-lastm", "");
    const pool = EXTRA.filter((m) => m.id !== lastId);
    const ex = pick(pool); K.store.set("space-lastm", ex.id);
    missions = [
      { id: "stars", icon: "star", text: "Собери 30 звёзд", goal: 30 },
      { id: "dist", icon: "rocket", text: "Пролети 1500 м", goal: 1500 },
      Object.assign({}, ex)
    ].map((m) => Object.assign(m, { val: 0, done: false, shown: "" }));
  }
  function missionVal(m) {
    switch (m.id) {
      case "stars": return stars;
      case "dist": return Math.floor(dist);
      case "bonus": return bonuses;
      case "near": return nears;
      case "clean": return Math.floor(dist - lastHitAt);
      case "nitro": return nitros;
      case "stars10": return stars; // считается только первые 300 м
    }
    return 0;
  }
  function drawMissionChips() {
    $mrow.innerHTML = missions.map((m, i) => `<div class="mchip glass" data-i="${i}"><img src="${artImg(m.icon)}" alt=""><span>0/${m.goal}</span></div>`).join("");
  }
  function updateMissions() {
    missions.forEach((m, i) => {
      if (m.done) return;
      let v = missionVal(m);
      if (m.id === "stars10" && dist > 300) { m.failed = true; }
      if (m.failed) { v = m.val; } else { m.val = Math.max(m.val, v); }
      const txt = m.failed ? "—" : `${Math.min(m.val, m.goal)}/${m.goal}`;
      const chip = $mrow.children[i];
      if (chip && txt !== m.shown) { m.shown = txt; chip.lastChild.textContent = txt; }
      if (!m.failed && m.val >= m.goal) {
        m.done = true;
        if (chip) { chip.lastChild.textContent = "готово"; chip.classList.add("done", "flash"); const r = chip.getBoundingClientRect(); K.burst(r.left + r.width / 2, r.top + r.height / 2, 22); }
        K.sfx("clear"); pop("Миссия выполнена!", true); K.vibrate(30);
      }
    });
  }
  const mlistHTML = (final) => `<div class="mtitle">Миссии полёта</div><ul class="mlist">${missions.map((m) =>
    `<li class="${m.done ? "done" : ""}"><img src="${artImg(m.done ? "check" : m.icon)}" alt=""><span>${m.text}</span>${final ? `<em>${m.done ? "+5" : m.failed ? "—" : `${Math.min(m.val, m.goal)}/${m.goal}`}</em>` : ""}</li>`).join("")}</ul>`;

  // ---------- бонусы на экране ----------
  const buffEls = {};
  function setBuff(b, t, max) {
    let el = buffEls[b];
    if (t > 0) {
      if (!el) {
        el = buffEls[b] = document.createElement("div"); el.className = "buff glass";
        el.innerHTML = `<img src="${artImg(BONUS[b].tex)}" alt="${BONUS[b].name}"><div class="progress"><i></i></div>`;
        $buffs.appendChild(el);
      }
      el.lastChild.firstChild.style.width = Math.max(0, t / max * 100).toFixed(1) + "%";
    } else if (el) { el.remove(); delete buffEls[b]; }
  }

  // ---------- сложность ----------
  const diff = () => 1 - Math.exp(-dist / 2600);            // 0 → 1 плавно
  const targetSpeed = () => 21 + 27 * diff();
  const rowGap = () => 21 - 9 * diff();

  function spawnRow(z) {
    rows++;
    const dk = diff();
    const two = rows > 2 && Math.random() < .12 + .45 * dk;
    let rockLanes;
    if (two) {
      const opts = [0, 1, 2].filter((l) => Math.abs(l - prevFree) <= 1); // свободная полоса всегда достижима
      const f = pick(opts); prevFree = f; rockLanes = [0, 1, 2].filter((l) => l !== f);
    } else {
      const r = (Math.random() * 3) | 0; rockLanes = [r];
      if (prevFree === r) prevFree = r === 1 ? pick([0, 2]) : 1;
    }
    for (const li of rockLanes) {
      const s = .85 + Math.random() * .4;
      let m;
      if (MODELS.rocks.length) {
        const mi = (Math.random() * MODELS.rocks.length) | 0;
        m = take("m" + mi, () => MODELS.rocks[mi].clone()); m.scale.setScalar(s);
        m.userData.sx = Math.random() * 2; m.userData.sy = Math.random() * 2;
      } else if (Math.random() < .2) {
        m = take("comet", () => mkSprite(TEX.comet, 2.4, { fog: false })); m.scale.set(2.5 * s, 2.5 * s, 1); m.material.rotation = Math.PI / 4;
      } else {
        m = take("rock", () => mkSprite(TEX.rock, 2.3, { color: 0xb4aea4, fog: false })); m.scale.set(2.3 * s, 2.3 * s, 1);
        m.material.rotation = Math.random() * 6; m.userData.spin = (Math.random() - .5) * 1.6;
      }
      m.position.set(LANES[li], .9, z); m.rotation.set(0, 0, 0);
      Object.assign(m.userData, { t: "rock", r: s });
    }
    const free = [0, 1, 2].filter((l) => !rockLanes.includes(l));
    let starLane = -1;
    if (Math.random() < .62) {
      starLane = pick(free);
      const n = Math.max(2, Math.min(5, Math.floor((rowGap() - 3) / 3) + 1));
      for (let k = 0; k < n; k++) {
        const s = MODELS.star ? take("starM", () => MODELS.star.clone()) : take("star", () => mkSprite(TEX.star, 1.25, { fog: false }));
        s.position.set(LANES[starLane], 1, z - k * 3);
        Object.assign(s.userData, { t: "star", y0: 1 });
      }
    }
    const bfree = free.filter((l) => l !== starLane);
    if (playing && bfree.length && dist - lastBonusAt > 260 && Math.random() < .28) {
      lastBonusAt = dist;
      const r = Math.random(), b = r < .38 ? "shield" : r < .72 ? "magnet" : "nitro";
      const s = take("b-" + b, () => makeBonusSprite(b));
      s.position.set(LANES[pick(bfree)], 1.1, z);
      Object.assign(s.userData, { t: "bonus", b, y0: 1.1 });
    }
  }

  // ---------- управление ----------
  let hintOn = false;
  function hideHint() { if (!hintOn) return; hintOn = false; $edges.classList.add("off"); setTimeout(() => { if (!hintOn) $edges.hidden = true; }, 650); }
  function showHint() { hintOn = true; $edges.hidden = false; requestAnimationFrame(() => $edges.classList.remove("off")); setTimeout(hideHint, 4500); }
  function move(d) {
    if (!playing || paused) return;
    const n = Math.max(0, Math.min(2, lane + d));
    if (n !== lane) { lane = n; K.sfx("tap"); hideHint(); }
    else { shake = Math.max(shake, .08); }
  }
  addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "ф") move(-1);
    else if (e.key === "ArrowRight" || e.key === "d" || e.key === "в") move(1);
    else if (e.key === "Escape" || e.key === "p" || e.key === "з") pause();
  });
  let ptr = null;
  cv.addEventListener("pointerdown", (e) => {
    if (ptr) return; // второй палец игнорируем
    ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), swiped: false };
    try { cv.setPointerCapture(e.pointerId); } catch (_) { /* нет */ }
  });
  cv.addEventListener("pointermove", (e) => {
    if (!ptr || e.pointerId !== ptr.id || ptr.swiped) return;
    const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
    if (Math.abs(dx) > 26 && Math.abs(dx) > Math.abs(dy) * 1.3) { ptr.swiped = true; move(dx > 0 ? 1 : -1); }
  });
  const endPtr = (e) => {
    if (!ptr || e.pointerId !== ptr.id) return;
    if (e.type === "pointerup" && !ptr.swiped) {
      const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y, held = performance.now() - ptr.t;
      if (Math.hypot(dx, dy) < 18 && held < 500) {           // это тап, а не попытка свайпа
        const w = innerWidth;
        if (ptr.x < w * .4) move(-1); else if (ptr.x > w * .6) move(1); // по центру — ничего
      }
    }
    ptr = null;
  };
  cv.addEventListener("pointerup", endPtr);
  cv.addEventListener("pointercancel", endPtr);
  cv.addEventListener("contextmenu", (e) => e.preventDefault());

  // ---------- размер и качество ----------
  const QL = [{ pr: DPR, bloom: true, bs: .5 }, { pr: Math.min(DPR, 1.5), bloom: true, bs: .35 }, { pr: Math.min(DPR, 1.5), bloom: false }, { pr: 1, bloom: false }];
  let ql = 0, fpsAcc = 0, fpsN = 0, qlCool = 3;
  const tmpV2 = new THREE.Vector2();
  function ptScale() {
    renderer.getDrawingBufferSize(tmpV2);
    const k = tmpV2.y / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2));
    ptLayers.forEach((L) => { L.u.uScale.value = k; });
  }
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    if (composer) composer.setSize(w, h);
    cam.aspect = w / h; baseFov = cam.aspect < .8 ? 70 : 60; cam.fov = baseFov + nitroK * 9; cam.updateProjectionMatrix(); ptScale();
  }
  function setQuality(l) {
    ql = l; const q = QL[l];
    renderer.setPixelRatio(q.pr); bloomScale = q.bs || .5; useBloom = q.bloom && !!composer;
    if (composer) composer.setPixelRatio(q.pr);
    resize();
  }
  addEventListener("resize", resize);
  setQuality(0);

  // ---------- игровые события ----------
  const flashEl = $("flash");
  function hit(o) {
    const p = o.position.clone();
    if (nitroT > 0 || shieldT > 0) {                         // щит и нитро разбивают камни
      burst(p, 26, [C_ROCK, C_GOLD, C_WHITE], 9, .7, .35, { g: 10, w: .6, drag: 1.5 });
      flashAt(p, 0xf3e3b0, 1, 4, .35); kill(o); K.sfx("pop", .8); shake = Math.max(shake, .25); bloomPulse = .5;
      return;
    }
    if (inv > 0) return;
    o.userData.hit = true;
    lives--; drawHearts(); bump($hearts); $hearts.classList.remove("hurt"); void $hearts.offsetWidth; $hearts.classList.add("hurt");
    inv = 2; lastHitAt = dist; speed *= .8; shake = .7;
    burst(p, 40, [C_ROCK, C_GOLD, C_FIRE, C_WHITE], 11, .9, .45, { g: 12, w: .5, drag: 1.2 });
    flashAt(p, 0xff8050, 1, 6, .45); kill(o);
    K.sfx("boom"); K.vibrate(90);
    flashEl.classList.add("on"); setTimeout(() => flashEl.classList.remove("on"), 70);
    if (lives <= 0) over();
  }
  function nearMiss(o) {
    nears++;
    K.sfx("pop", 1.6); pop("Чуть-чуть!");
    burst(new THREE.Vector3(o.position.x, o.position.y, ship.position.z), 12, [C_WHITE, C_GOLD], 5, .4, .2, { w: .8, drag: 2 });
    if (slowCd <= 0 && nitroT <= 0 && !REDUCED) { slowT = .42; slowCd = 3; }
  }
  function collect(o) {
    const u = o.userData, p = o.position;
    if (u.t === "star") {
      stars++; $stars.textContent = stars; bump($stars);
      K.sfx("coin");
      flashAt(p, 0xffd27a, .6, 3.2, .32);
      burst(p, 14, [C_GOLD, C_WHITE, C_HOT], 6, .45, .22, { w: .6, drag: 2.5 });
      bloomPulse = Math.min(.6, bloomPulse + .22);
    } else {
      const b = u.b; bonuses++;
      flashAt(p, BONUS[b].color, 1, 7, .5, RING); flashAt(p, 0xffffff, 1, 4, .3);
      burst(p, 30, [C_WHITE, C_GOLD], 8, .6, .3, { w: .6, drag: 2 });
      K.sfx(b === "nitro" ? "clear" : "good"); K.vibrate(25); bloomPulse = .8;
      if (b === "shield") { shieldT = T_SHIELD; pop("Щит!"); }
      if (b === "magnet") { magnetT = T_MAGNET; pop("Магнит!"); }
      if (b === "nitro") { nitroT = T_NITRO; nitros++; pop("Нитро!"); }
    }
    kill(o);
  }

  // ---------- полосы скорости для нитро ----------
  const SL = 46, slPos = new Float32Array(SL * 6), slGeo = new THREE.BufferGeometry();
  slGeo.setAttribute("position", new THREE.BufferAttribute(slPos, 3));
  const slMat = new THREE.LineBasicMaterial({ color: 0xf3d9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const speedLines = new THREE.LineSegments(slGeo, slMat); speedLines.frustumCulled = false; scene.add(speedLines);
  const slLen = new Float32Array(SL);
  for (let i = 0; i < SL; i++) {
    const a = Math.random() * Math.PI, r = 4 + Math.random() * 6;
    const x = Math.cos(a) * r, y = 1 + Math.sin(a) * r * .8, z = -Math.random() * 70;
    slLen[i] = 3 + Math.random() * 6;
    slPos.set([x, y, z, x, y, z - slLen[i]], i * 6);
  }

  // ---------- главный цикл ----------
  let raf = 0;
  const loop = () => { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } };
  const stopLoop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };

  function tick(t) {
    raf = 0;
    if (paused || document.hidden) return;
    raf = requestAnimationFrame(tick);
    const raw = last ? (t - last) / 1000 : 1 / 60; last = t;
    const rdt = Math.min(.05, raw);

    // адаптивное качество: при низком FPS — меньше свечения и пикселей
    if (!LOCK_Q && ql < QL.length - 1 && raw < .25) {
      qlCool -= raw;
      if (qlCool <= 0) {
        fpsAcc += raw; fpsN++;
        if (fpsAcc > 2) { if (fpsN / fpsAcc < 42) { setQuality(ql + 1); qlCool = 1.5; } fpsAcc = 0; fpsN = 0; }
      }
    }

    // слоу-мо «чуть-чуть»
    slowT -= rdt; slowCd -= rdt;
    timeScale += ((slowT > 0 ? .28 : 1) - timeScale) * Math.min(1, rdt * (slowT > 0 ? 18 : 6));
    if (!playing && overT > 0) { overT -= rdt; timeScale = .35; }
    const dt = rdt * timeScale; time += dt;

    if (playing) {
      const ts = targetSpeed();
      speed += (ts - speed) * Math.min(1, dt * .8);
      dist += speed * (nitroT > 0 ? 1.6 : 1) * dt;
      const di = Math.floor(dist);
      if ($dist.textContent !== String(di)) $dist.textContent = di;
      inv = Math.max(0, inv - dt);
      if (shieldT > 0) { shieldT -= dt; setBuff("shield", shieldT, T_SHIELD); }
      if (magnetT > 0) { magnetT -= dt; setBuff("magnet", magnetT, T_MAGNET); }
      if (nitroT > 0) { nitroT -= dt; setBuff("nitro", nitroT, T_NITRO); if (nitroT <= 0) inv = Math.max(inv, 1.2); }
      updateMissions();
    }
    const v = playing ? speed * (nitroT > 0 ? 1.6 : 1) : 9;
    if (playing) {
      nextZ += v * dt;
      while (nextZ > -112) { spawnRow(nextZ - 0); nextZ -= rowGap(); }
    }
    nitroK += ((nitroT > 0 ? 1 : 0) - nitroK) * Math.min(1, rdt * 4);

    // ракета: переход по полосам с наклоном
    const prevX = ship.position.x, tx = playing ? LANES[lane] : 0;
    ship.position.x += (tx - ship.position.x) * Math.min(1, dt * 13);
    shipVx = (ship.position.x - prevX) / Math.max(dt, 1e-4);
    const rollT = Math.max(-.55, Math.min(.55, -shipVx * .045));
    roll += (rollT - roll) * Math.min(1, rdt * 12);
    ship.position.y = .9 + Math.sin(time * 3) * .08;
    const blink = inv > 0 && nitroT <= 0 && Math.floor(time * 14) % 2;
    if (shipModel) { ship.rotation.z = roll; ship.rotation.y = roll * .3; shipModel.visible = !blink; }
    else { shipSprite.material.rotation = Math.PI / 4 + roll * .9; shipSprite.material.opacity = blink ? .25 : 1; shipSprite.scale.x = 2.7 * (1 - Math.abs(roll) * .12); }
    // огонь двигателя
    const shipOn = shipModel ? true : shipSprite.visible;
    const nx = ship.position.x + Math.sin(roll) * nozzle.r, ny = ship.position.y + .3 + nozzle.y * Math.cos(roll), nz = ship.position.z + nozzle.z;
    if (ship.visible && shipOn) {
      emitAcc += dt * (playing ? 110 : 60) * (1 + nitroK * 1.5);
      while (emitAcc >= 1) {
        emitAcc--;
        const hot = Math.random() < .35;
        emit(nx + (Math.random() - .5) * .18, ny, nz,
          (Math.random() - .5) * .9 + Math.sin(roll) * 2, -1.6 - Math.random() * 1.6, 2 + Math.random() * 2,
          .22 + Math.random() * .22 + nitroK * .15, (hot ? .5 : .75) * (1 + nitroK * .5), hot ? C_HOT : (Math.random() < .5 ? C_FIRE : C_GOLD), hot ? 1 : .8, { w: .45, drag: 1 });
      }
      nozzleGlow.visible = true; nozzleGlow.position.set(nx, ny + .05, nz + .1);
      nozzleGlow.scale.setScalar((1.2 + Math.random() * .35) * (1 + nitroK * .6)); engineLight.intensity = 1 + Math.random() * .4;
    } else nozzleGlow.visible = false;
    // щит и магнит вокруг ракеты
    bubble.material.opacity += ((shieldT > 0 ? .55 + Math.sin(time * 6) * .12 - (shieldT < 2 && Math.floor(time * 8) % 2 ? .35 : 0) : 0) - bubble.material.opacity) * Math.min(1, rdt * 10);
    bubble.material.rotation += rdt * .8;
    aura.material.opacity = magnetT > 0 ? .25 + .2 * Math.sin(time * 5) : 0;
    aura.scale.setScalar(3 + ((time * 1.6) % 1) * 3);

    // камера с инерцией, покачиванием и тряской
    camX += (ship.position.x * .55 - camX) * Math.min(1, rdt * 3.2);
    lookX += (ship.position.x * .32 - lookX) * Math.min(1, rdt * 4.5);
    shake = Math.max(0, shake - rdt * 1.6);
    const sh = REDUCED ? 0 : shake * shake;
    cam.position.set(camX + (Math.random() - .5) * sh, 4.4 + (Math.random() - .5) * sh - nitroK * .35, 10.5 - nitroK * 1.2);
    cam.lookAt(lookX, 1, -6);
    cam.rotateZ(roll * .06);
    const fov = baseFov + nitroK * 9;
    if (Math.abs(cam.fov - fov) > .01) { cam.fov = fov; cam.updateProjectionMatrix(); ptScale(); }

    // мир
    grid.position.z = (grid.position.z + v * dt) % 2.5;
    mid.u.uMove.value = (mid.u.uMove.value + v * dt * .9) % 230;
    dust.u.uMove.value = (dust.u.uMove.value + v * dt * 1.1) % 130;
    sky.u.uTime.value = time;
    sky.pts.rotation.z += dt * .002;
    deco.forEach((n) => { n.material.rotation += n.userData.spin * dt; });
    planet.material.rotation = Math.sin(time * .05) * .05;
    if (nitroK > .01) {
      slMat.opacity = nitroK * .7; speedLines.visible = true;
      for (let i = 0; i < SL; i++) {
        let z = slPos[i * 6 + 2] + v * dt * 1.6;
        if (z > 12) z -= 80;
        slPos[i * 6 + 2] = z; slPos[i * 6 + 5] = z - slLen[i] * (1 + nitroK);
      }
      slGeo.attributes.position.needsUpdate = true;
    } else speedLines.visible = false;

    // объекты трассы
    const sp = ship.position;
    for (let i = 0; i < objs.length; i++) {
      const o = objs[i], u = o.userData;
      if (u.dead) continue;
      o.position.z += v * dt;
      if (o.isSprite) { const f = Math.min(1, Math.max(0, (o.position.z + 112) / 40)); o.material.opacity = f * f; }
      if (u.t === "rock") {
        if (o.isSprite) { if (u.spin) o.material.rotation += u.spin * dt; }
        else { o.rotation.x += u.sx * dt; o.rotation.y += u.sy * dt; }
      } else {
        if (!u.mag) o.position.y = u.y0 + Math.sin(time * 4 + o.position.z * .3) * .15;
        if (!o.isSprite) o.rotation.y += dt * 3;
        else if (u.t === "bonus") { o.children[1].material.rotation += dt * 2; o.children[0].material.opacity = .6 + .3 * Math.sin(time * 6); }
      }
      if (playing) {
        const dz = o.position.z - sp.z, dx = Math.abs(o.position.x - sp.x);
        if (u.t === "rock") {
          const R = .95 * u.r;
          if (!u.hit && Math.abs(dz) < R && dx < 1.15) { hit(o); continue; }
          if (dz < -R && dz > -R - v * .3 && dx < 1.15) u.danger = true;
          else if (u.danger && !u.passed && !u.hit && dz > R) { u.passed = true; nearMiss(o); }
        } else {
          if (magnetT > 0 && dz > -16 && dz < 1.5 && (u.t === "star")) {
            u.mag = true; const k = Math.min(1, dt * 9);
            o.position.x += (sp.x - o.position.x) * k; o.position.y += (sp.y + .3 - o.position.y) * k;
            if (dz > -10) o.position.z += (sp.z - o.position.z) * k;
          }
          const dz2 = o.position.z - sp.z, dx2 = Math.abs(o.position.x - sp.x);
          if (Math.abs(dz2) < 1.3 && dx2 < 1.5) { collect(o); continue; }
        }
      }
      if (o.position.z > 14) kill(o);
    }
    let j = 0; for (let i = 0; i < objs.length; i++) if (!objs[i].userData.dead) objs[j++] = objs[i];
    objs.length = j;

    updateFx(dt, v);
    updateFlashes(dt, v);

    bloomPulse = Math.max(0, bloomPulse - rdt * 2.2);
    if (useBloom) { bloom.strength = BLOOM_BASE + bloomPulse + nitroK * .25; composer.render(rdt); }
    else renderer.render(scene, cam);
  }

  // ---------- пауза ----------
  let closePause = null;
  function pause() {
    if (!playing || paused) return;
    paused = true; stopLoop(); ptr = null;
    closePause = K.panel({
      title: "Пауза",
      text: `Пролетел ${Math.floor(dist)} м, собрал ${stars} ${K.plural(stars, "звезду", "звезды", "звёзд")}.`,
      extra: mlistHTML(true),
      buttons: [{ label: "Продолжить", cls: "big", onClick: resume }]
    });
  }
  function resume() { paused = false; closePause = null; loop(); }
  pauseBtn.addEventListener("click", () => { K.sfx("tap"); pause(); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { if (playing) pause(); stopLoop(); }
    else if (!paused) loop();
  });

  // ---------- конец и старт ----------
  function over() {
    playing = false; pauseBtn.hidden = true; overT = 1;
    burst(ship.position, 80, [C_FIRE, C_GOLD, C_WHITE, C_RED], 14, 1.2, .55, { g: 6, w: .3, drag: 1 });
    flashAt(ship.position, 0xffa040, 2, 12, .7); flashAt(ship.position, 0xffffff, 1, 6, .4, RING);
    ship.visible = false; nozzleGlow.visible = false; shake = 1;
    ["shield", "magnet", "nitro"].forEach((b) => setBuff(b, 0, 1));
    shieldT = magnetT = nitroT = 0;
    const d = Math.floor(dist);
    const rec = K.best(BEST_ID, d);
    const done = missions.filter((m) => m.done).length;
    const drops = Math.floor(d / 60) + Math.floor(stars / 2) + done * 5;
    setTimeout(() => {
      K.sfx(rec && d > 0 ? "win" : "lose");
      if (rec && d > 0) K.confetti();
      K.panel({
        title: rec && d > 0 ? "Новый рекорд!" : "Полёт окончен",
        stars: done,
        score: d, scoreLabel: "метров пролетел",
        extra: `<div class="res">
            <div><img src="${K.artSrc("star")}" alt=""><b>${stars}</b><small>звёзды</small></div>
            <div><img src="${K.artSrc("trophy")}" alt=""><b>${K.getBest(BEST_ID)}</b><small>рекорд, м</small></div>
            <div>${K.dropSVG("")}<b>+${drops}</b><small>капельки</small></div>
          </div>${mlistHTML(true)}`,
        buttons: [{ label: "Ещё полёт", cls: "big", onClick: () => { newMissions(); start(); } }]
      });
      setTimeout(() => K.coins.add(drops, document.querySelector(".overlay .big-score")), 450);
    }, 1100);
  }
  function start() {
    objs.forEach((o) => kill(o)); objs.length = 0;
    lane = 1; speed = 14; dist = 0; stars = 0; lives = 3; inv = 0; shieldT = magnetT = nitroT = 0;
    nextZ = -48; rows = 0; prevFree = 1; lastBonusAt = 60; lastHitAt = 0; nears = 0; bonuses = 0; nitros = 0;
    slowT = 0; slowCd = 0; overT = 0; timeScale = 1;
    ship.visible = true; ship.position.x = 0; camX = 0; lookX = 0;
    $stars.textContent = 0; $dist.textContent = 0; drawHearts();
    drawMissionChips(); updateMissions();
    playing = true; paused = false; pauseBtn.hidden = false;
    const runs = K.store.get("space-runs", 0);
    if (!start.once || runs < 3) showHint();
    start.once = true; K.store.set("space-runs", runs + 1);
    loop();
  }

  if (/[?&]dbg\b/.test(location.search)) window.__space = { give: (b) => { bonuses++; if (b === "shield") shieldT = T_SHIELD; if (b === "magnet") magnetT = T_MAGNET; if (b === "nitro") { nitroT = T_NITRO; nitros++; } }, state: () => ({ dist, stars, lives, ql, playing, paused, objs: objs.length, pools: Object.keys(pools).map((k) => k + ":" + pools[k].length).join(",") }), god: () => { lives = 99; } };

  // первый экран
  drawHearts(); newMissions(); drawMissionChips();
  loop();
  const best = K.getBest(BEST_ID);
  K.panel({
    title: "Звёздный рейс",
    text: "Облетай камни и собирай звёзды. У тебя 3 жизни.",
    extra: `<div class="legend">
        <div><img src="${K.artSrc("shield")}" alt=""><b>Щит</b><small>камни не страшны</small></div>
        <div><img src="art/magnet.webp" alt=""><b>Магнит</b><small>звёзды летят к тебе</small></div>
        <div><img src="${K.artSrc("lightning")}" alt=""><b>Нитро</b><small>супер-скорость</small></div>
      </div>${mlistHTML(false)}${best ? `<p>Твой рекорд: <b style="color:var(--gold-hi)">${best} м</b></p>` : ""}`,
    buttons: [{ label: "Полетели!", cls: "big", onClick: start }]
  });
})();
