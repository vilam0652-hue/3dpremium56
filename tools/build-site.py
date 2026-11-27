"""Собирает страницы приложений для сайта (app/<id>.html) и обновляет каталог на главной.

Данные: apps.json (название, вид, пакет, иконка) + site/content.json (тексты) + site/shots/<id>-N.webp (скриншоты).
Запуск: python3 tools/build-site.py
"""
import html, json, pathlib, re, subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
apps = json.loads((ROOT / "apps.json").read_text(encoding="utf-8"))
content = json.loads((ROOT / "site/content.json").read_text(encoding="utf-8"))
E = lambda s: html.escape(str(s), quote=True)


def shots(app_id):
    return sorted(p.name for p in (ROOT / "site/shots").glob(f"{app_id}-*.webp"))


def apk_size(app_id):
    return content.get(app_id, {}).get("size", "≈1,5 МБ")


PAGE = """<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{name} — Капля</title>
<meta name="description" content="{tagline}. {about_short}">
<meta name="theme-color" content="#08080a">
<meta property="og:title" content="{name} — Капля">
<meta property="og:description" content="{tagline}">
<meta property="og:image" content="../icons/{id}.png">
<link rel="icon" href="../icons/{id}-96.png">
<link rel="stylesheet" href="../shared/k.css">
<link rel="stylesheet" href="../site/site.css">
<script src="../shared/k.js"></script>
</head>
<body>
<header class="nav glass">
  <a class="brand" href="../"><span class="logo-drop"></span><span>Капля</span></a>
  <nav><a href="../#games">Игры</a><a href="../#learn">Учёба</a><a href="../#install">Установка</a><a class="btn" data-apk="{id}" href="#">Скачать</a></nav>
</header>
<main class="wrap app-page">
  <a class="crumb" href="../#{section}">← {section_name}</a>
  <section class="app-hero">
    <img class="app-icon" src="../icons/{id}.png" alt="Иконка «{name}»" width="512" height="512">
    <div class="app-hero-text">
      <span class="eyebrow">{kind_name}</span>
      <h1>{name}</h1>
      <p class="lead">{tagline}</p>
      <div class="chips">{chips}</div>
      <div class="row"><a class="btn big" data-apk="{id}" href="#">Скачать APK</a><a class="btn big ghost" href="../#install">Как установить</a></div>
    </div>
  </section>

  <section class="gallery" aria-label="Скриншоты">{gallery}</section>

  <section class="split">
    <div class="stack about"><span class="eyebrow">{about_title}</span><h2 class="h-display">Коротко</h2><p>{about}</p></div>
    <div class="glass facts-card">
      <dl>
        <div><dt>Тип</dt><dd>{kind_name}</dd></div>
        <div><dt>Возраст</dt><dd>{age}</dd></div>
        <div><dt>Интернет</dt><dd>{internet}</dd></div>
        <div><dt>Размер</dt><dd>{size}</dd></div>
        <div><dt>Android</dt><dd>7.0 и новее</dd></div>
        <div><dt>Реклама</dt><dd>Нет</dd></div>
        <div><dt>Покупки</dt><dd>Нет</dd></div>
        <div><dt>Язык</dt><dd>Русский</dd></div>
      </dl>
    </div>
  </section>

  <section class="block-sm">
    <div class="sec-head"><div class="stack" style="gap:8px"><span class="eyebrow">Возможности</span><h2 class="h-display">Что внутри</h2></div></div>
    <div class="features">{features}</div>
  </section>

  <section class="split">
    <div class="glass list-card"><span class="eyebrow">Польза</span><h2>Чему учит</h2><ul class="ticks">{learn}</ul></div>
    <div class="glass list-card"><span class="eyebrow">Правила</span><h2>Как играть</h2><ol class="steps-list">{how}</ol></div>
  </section>

  <section class="block-sm">
    <div class="sec-head"><div class="stack" style="gap:8px"><span class="eyebrow">Ещё в Капле</span><h2 class="h-display">Другие приложения</h2></div></div>
    <div class="more">{more}</div>
  </section>
</main>
<footer class="wrap site-foot"><span>Капля · для начальной школы</span><span><a href="../admin.html">Вход для администратора</a></span></footer>
<script src="../site/site.js"></script>
</body>
</html>
"""


def build_page(a):
    c = content[a["id"]]
    kind_name = "Игра" if a["kind"] == "game" else "Учёба"
    internet = "Не нужен" if c.get("internet") is False else f"Нужен {c['internet']}"
    chips = "".join(f'<span class="chip">{E(x)}</span>' for x in [kind_name, c["age"], "Без интернета" if c.get("internet") is False else "Офлайн, кроме чата", "Без рекламы"])
    sh = shots(a["id"])
    gallery = "".join(
        f'<figure class="shot-frame"><img src="../site/shots/{s}" alt="Экран {i + 1}: {E(a["name"])}" loading="{"eager" if i < 2 else "lazy"}" width="780" height="1600"></figure>'
        for i, s in enumerate(sh)) or '<p class="muted">Скриншоты скоро появятся.</p>'
    feats = "".join(
        f'<div class="glass feature"><img src="../shared/art/{E(icon)}.webp" alt="" width="64" height="64"><h3>{E(t)}</h3><p>{E(d)}</p></div>'
        for icon, t, d in c["features"])
    more = "".join(
        f'<a class="more-item glass" href="{b["id"]}.html"><img src="../icons/{b["id"]}-192.png" alt="" width="96" height="96"><b>{E(b["name"])}</b><span>{"Игра" if b["kind"] == "game" else "Учёба"}</span></a>'
        for b in apps if b["id"] != a["id"])
    return PAGE.format(
        id=a["id"], name=E(a["name"]), tagline=E(c["tagline"]), about=E(c["about"]),
        about_short=E(c["about"].split(". ")[0]), kind_name=kind_name, section="games" if a["kind"] == "game" else "learn",
        section_name="Игры" if a["kind"] == "game" else "Учёба", about_title="Об игре" if a["kind"] == "game" else "О приложении",
        chips=chips, gallery=gallery, features=feats, age=E(c["age"]), internet=E(internet), size=E(apk_size(a["id"])),
        learn="".join(f"<li>{E(x)}</li>" for x in c["learn"]), how="".join(f"<li>{E(x)}</li>" for x in c["how"]), more=more)


def main():
    out = ROOT / "app"; out.mkdir(exist_ok=True)
    for a in apps:
        (out / f"{a['id']}.html").write_text(build_page(a), encoding="utf-8")
    # данные для каталога на главной
    cat = [{"id": a["id"], "name": a["name"], "kind": a["kind"], "desc": a["desc"], "tagline": content[a["id"]]["tagline"], "shot": (shots(a["id"]) or [None])[0]} for a in apps]
    p = ROOT / "index.html"
    s = p.read_text(encoding="utf-8")
    s = re.sub(r"/\*APPS\*/.*?/\*END\*/", lambda m: "/*APPS*/" + json.dumps(cat, ensure_ascii=False) + "/*END*/", s, flags=re.S)
    p.write_text(s, encoding="utf-8")
    print("pages:", len(apps))


if __name__ == "__main__":
    main()
