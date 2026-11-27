"""Раскладывает картинки из Gemini и 3D-модели из Meshy по приложениям «Капли».

Использование: python3 tools/prepare-assets.py <папка или файлы>...
Имена файлов — как на странице с промптами (buddy-happy.png, icon-space.png, planet-05.png, ship.glb …).
Белый фон у Бадди и чёрный фон у планет и шариков убираются автоматически.
"""
import pathlib, re, shutil, sys
from PIL import Image, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent


def cut_background(im, white):
    """Убирает фон, заливая его от краёв картинки (белый или чёрный)."""
    im = im.convert("RGBA")
    w, h = im.size
    probe = im.convert("RGB").copy()
    key = (255, 0, 255)
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]
    for sx, sy in seeds:
        px = probe.getpixel((sx, sy))
        bright = sum(px) / 3
        if (white and bright > 200) or (not white and bright < 45):
            ImageDraw.floodfill(probe, (sx, sy), key, thresh=38 if white else 30)
    mask = Image.new("L", (w, h), 255)
    mp, pp = mask.load(), probe.load()
    for y in range(h):
        for x in range(w):
            if pp[x, y] == key:
                mp[x, y] = 0
    mask = mask.filter(ImageFilter.GaussianBlur(1.2))
    im.putalpha(mask)
    box = im.getbbox()
    return im.crop(box) if box else im


def square(im, size, pad=0.04):
    side = int(max(im.size) * (1 + pad * 2))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - im.width) // 2, (side - im.height) // 2), im)
    return canvas.resize((size, size), Image.LANCZOS)


def fit(im, size):
    im = im.copy(); im.thumbnail((size, size), Image.LANCZOS); return im


def handle(path):
    name = path.name.lower()
    stem = path.stem.lower()
    if name.endswith(".glb"):
        dest = ROOT / ("apps/buddy/models" if stem == "buddy" else "apps/space/models")
        dest.mkdir(parents=True, exist_ok=True)
        shutil.copy(path, dest / name)
        return f"3D-модель → {dest.relative_to(ROOT)}/{name}"
    try:
        im = Image.open(path)
    except Exception:
        return f"пропущен (не картинка): {path.name}"
    if re.fullmatch(r"buddy-(happy|cheer|think|oops|sleep|wave)|buddy-outfit-(tophat|cap|crown|scarf|bow)", stem):
        out = ROOT / "apps/buddy/img" / f"{stem}.png"; out.parent.mkdir(parents=True, exist_ok=True)
        square(cut_background(im, white=True), 768).save(out, optimize=True)
        return f"Бадди → {out.relative_to(ROOT)}"
    m = re.fullmatch(r"icon-([a-z]+)", stem)
    if m:
        app = m.group(1)
        base = im.convert("RGB")
        s = min(base.size); base = base.crop(((base.width - s) // 2, (base.height - s) // 2, (base.width + s) // 2, (base.height + s) // 2))
        base.resize((512, 512), Image.LANCZOS).save(ROOT / f"icons/{app}.png", optimize=True)
        for px in (192, 144, 96):
            base.resize((px, px), Image.LANCZOS).save(ROOT / f"icons/{app}-{px}.png", optimize=True)
        return f"иконка → icons/{app}.png"
    if stem in ("site-hero", "site-hero-mobile"):
        out = ROOT / "site" / ("hero.jpg" if stem == "site-hero" else "hero-mobile.jpg")
        fit(im.convert("RGB"), 2200 if stem == "site-hero" else 1400).save(out, quality=84, optimize=True, progressive=True)
        if stem == "site-hero":
            og = im.convert("RGB"); og.thumbnail((1200, 1200)); og.save(ROOT / "site/og.jpg", quality=82)
        return f"сайт → {out.relative_to(ROOT)}"
    if re.fullmatch(r"planet-(0[1-9]|1[01])", stem):
        out = ROOT / "apps/merge/img" / f"{stem}.png"; out.parent.mkdir(parents=True, exist_ok=True)
        square(cut_background(im, white=False), 384, pad=0).save(out, optimize=True)
        return f"планета → {out.relative_to(ROOT)}"
    if re.fullmatch(r"balloon-(gold|black|white)", stem):
        out = ROOT / "apps/balloons/img" / f"{stem}.png"; out.parent.mkdir(parents=True, exist_ok=True)
        fit(cut_background(im, white=False), 420).save(out, optimize=True)
        return f"шарик → {out.relative_to(ROOT)}"
    return f"не знаю, куда положить: {path.name}"


def main(args):
    files = []
    for a in args:
        p = pathlib.Path(a)
        files += sorted(x for x in p.rglob("*") if x.is_file()) if p.is_dir() else [p]
    for f in files:
        print(handle(f))


if __name__ == "__main__":
    main(sys.argv[1:])
