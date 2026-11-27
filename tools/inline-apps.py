"""Вставляет список приложений из apps.json в главный сайт index.html."""
import json, re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
apps = json.loads((root / "apps.json").read_text(encoding="utf-8"))
data = json.dumps([{k: a[k] for k in ("id", "name", "kind", "desc", "tint")} for a in apps], ensure_ascii=False)
p = root / "index.html"
s = p.read_text(encoding="utf-8")
s = re.sub(r"/\*APPS\*/.*?/\*END\*/", lambda m: "/*APPS*/" + data + "/*END*/", s, flags=re.S)
p.write_text(s, encoding="utf-8")
print("apps:", len(apps))
