"""Переводит скриншоты site/shots/*.png в чёткие webp (780×1600) и удаляет png."""
import pathlib
from PIL import Image

d = pathlib.Path(__file__).resolve().parent.parent / "site" / "shots"
for png in sorted(d.glob("*-*.png")):
    im = Image.open(png).convert("RGB")
    im.save(png.with_suffix(".webp"), "WEBP", quality=86, method=6)
    png.unlink()
    print(png.with_suffix(".webp").name, im.size)
