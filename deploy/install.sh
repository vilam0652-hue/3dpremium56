#!/usr/bin/env bash
# Установка сервера «Капли» на VPS с Ubuntu (20.04+). Запуск от root:
#   curl -fsSL https://raw.githubusercontent.com/vilam0652-hue/3dpremium56/main/deploy/install.sh | sudo bash
# Свой домен (необязательно):  ... | sudo bash -s -- kaplya.ru
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/vilam0652-hue/3dpremium56.git}"
DOMAIN="${1:-${DOMAIN:-}}"
APP=/opt/kaplya/repo
DATA=/var/lib/kaplya
ETC=/etc/kaplya
say() { printf '\n\033[1;33m▶ %s\033[0m\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "Запусти от root: sudo bash install.sh"; exit 1; }
. /etc/os-release
[ "${ID:-}" = "ubuntu" ] || [ "${ID:-}" = "debian" ] || echo "Внимание: скрипт проверен на Ubuntu/Debian, у тебя ${PRETTY_NAME:-неизвестная система}."

say "Проверяю, не заняты ли порты 80 и 443 другой программой"
BUSY=$(ss -ltnpH '( sport = :80 or sport = :443 )' 2>/dev/null | grep -v caddy || true)
if [ -n "$BUSY" ]; then
  echo "Порты 80/443 уже заняты:"; echo "$BUSY"
  echo "Похоже, на сервере уже работает другой сайт (nginx/apache). Установка остановлена, чтобы ничего не сломать."
  echo "Напиши об этом Claude — он подскажет, как поставить Каплю рядом."
  exit 1
fi

say "Ставлю нужные пакеты"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git ca-certificates gnupg jq openssl debian-keyring debian-archive-keyring apt-transport-https >/dev/null

if ! swapon --show | grep -q .; then
  say "Добавляю файл подкачки 1 ГБ (у сервера мало памяти)"
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  say "Ставлю Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi

if ! command -v caddy >/dev/null; then
  say "Ставлю Caddy (веб-сервер с автоматическим HTTPS)"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq && apt-get install -y -qq caddy >/dev/null
fi

say "Скачиваю Каплю с GitHub"
id kaplya >/dev/null 2>&1 || useradd --system --home /opt/kaplya --shell /usr/sbin/nologin kaplya
mkdir -p /opt/kaplya "$DATA/apk" "$ETC"
if [ -d "$APP/.git" ]; then git -C "$APP" pull -q --ff-only; else git clone -q --depth 50 "$REPO_URL" "$APP"; fi
chown -R kaplya:kaplya /opt/kaplya "$DATA"

say "Сертификаты для GigaChat (Минцифры)"
{ curl -fsSL https://gu-st.ru/content/lending/russian_trusted_root_ca_pem.crt; echo; curl -fsSL https://gu-st.ru/content/lending/russian_trusted_sub_ca_pem.crt; } > "$ETC/ru-ca.pem" 2>/dev/null || echo "Не удалось скачать — GigaChat может не работать, будет OpenRouter."

if [ ! -f "$ETC/kaplya.env" ]; then
  say "Создаю настройки и секреты"
  cat > "$ETC/kaplya.env" <<EOF
PORT=8080
SITE_DIR=$APP
DATA_DIR=$DATA
SESSION_SECRET=$(openssl rand -hex 32)
CHAT_CODE=$(openssl rand -hex 8)
CHAT_DAILY_PER_IP=60
CHAT_DAILY_TOTAL=3000
NODE_EXTRA_CA_CERTS=$ETC/ru-ca.pem
GIGACHAT_KEY=
OPENROUTER_KEY=
EOF
fi
chown root:kaplya "$ETC/kaplya.env"; chmod 640 "$ETC/kaplya.env"

if [ -z "$DOMAIN" ]; then
  IP=$(curl -4 -fsS https://api.ipify.org || curl -4 -fsS https://ifconfig.me)
  DOMAIN="${IP//./-}.sslip.io"
fi
echo "$DOMAIN" > "$ETC/domain"

say "Настраиваю HTTPS для $DOMAIN"
CF=/etc/caddy/Caddyfile
BLOCK="# kaplya-begin
$DOMAIN {
	encode zstd gzip
	reverse_proxy 127.0.0.1:8080
}
# kaplya-end"
if [ ! -s "$CF" ] || grep -q '/usr/share/caddy' "$CF"; then
  printf '%s\n' "$BLOCK" > "$CF"
elif grep -q '# kaplya-begin' "$CF"; then
  sed -i '/# kaplya-begin/,/# kaplya-end/d' "$CF"; printf '%s\n' "$BLOCK" >> "$CF"
else
  cp "$CF" "$CF.bak-$(date +%s)"; printf '\n%s\n' "$BLOCK" >> "$CF"
fi

say "Запускаю службы"
install -m 644 "$APP/deploy/kaplya.service" /etc/systemd/system/kaplya.service
install -m 644 "$APP/deploy/kaplya-update.service" /etc/systemd/system/kaplya-update.service
install -m 644 "$APP/deploy/kaplya-update.timer" /etc/systemd/system/kaplya-update.timer
install -m 755 "$APP/deploy/kaplyactl" /usr/local/bin/kaplyactl
systemctl daemon-reload
systemctl enable --now kaplya.service kaplya-update.timer >/dev/null
systemctl restart caddy
if command -v ufw >/dev/null && ufw status | grep -q active; then ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; fi

say "Скачиваю APK на сервер"
bash "$APP/deploy/update.sh" || true

. "$ETC/kaplya.env"
cat <<EOF

========================================================
  Капля установлена!

  Сайт:  https://$DOMAIN
  Входи теми же логином и паролем, что и раньше.
  Управление сервером (для администратора): https://$DOMAIN/server-admin

  Адрес чата для «Бадди» (вставь в «Я» → «Свой сервер»):
  https://$DOMAIN/api/chat?code=$CHAT_CODE

  Подключить GigaChat:   sudo kaplyactl set-gigachat
  Подключить OpenRouter: sudo kaplyactl set-openrouter
  Состояние:             sudo kaplyactl status
========================================================
EOF
