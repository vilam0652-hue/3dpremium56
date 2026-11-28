#!/usr/bin/env bash
# Обновление Капли с GitHub и скачивание свежих APK. Запускается таймером каждые 10 минут (от root).
set -euo pipefail
APP=/opt/kaplya/repo
DATA=/var/lib/kaplya
cd "$APP"
G() { runuser -u kaplya -- git -C "$APP" "$@"; }
OLD=$(G rev-parse HEAD)
G pull -q --ff-only || echo "git pull не удался"
NEW=$(G rev-parse HEAD)

# какой репозиторий на GitHub (из адреса origin)
SLUG=$(G remote get-url origin | sed -E 's#^.*github\.com[:/]##; s#\.git$##')
AUTH=()
[ -n "${GITHUB_TOKEN:-}" ] && AUTH=(-H "Authorization: Bearer $GITHUB_TOKEN")
REL=$(curl -fsS "${AUTH[@]}" "https://api.github.com/repos/$SLUG/releases/tags/apk" || true)
if [ -n "$REL" ]; then
  echo "$REL" | jq -r '.assets[] | [.name, .updated_at, .browser_download_url] | @tsv' | while IFS=$'\t' read -r NAME STAMP URL; do
    DEST="$DATA/apk/$NAME"; MARK="$DATA/apk/.$NAME.stamp"
    if [ ! -f "$DEST" ] || [ "$(cat "$MARK" 2>/dev/null)" != "$STAMP" ]; then
      if curl -fsSL "${AUTH[@]}" -o "$DEST.tmp" "$URL"; then mv "$DEST.tmp" "$DEST"; echo "$STAMP" > "$MARK"; echo "APK обновлён: $NAME"; else rm -f "$DEST.tmp"; fi
    fi
  done
  chown -R kaplya:kaplya "$DATA/apk"
fi

if [ "$OLD" != "$NEW" ]; then systemctl restart kaplya; echo "Капля обновлена до ${NEW:0:7}"; fi
