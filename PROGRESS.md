# PROGRESS — проект «Капля»

Рабочий журнал, чтобы продолжить работу после сжатия контекста. Последнее обновление: 2026-11-27.

## Кто и что
- Владелец: GitHub `vilam0652-hue`. Общается по-русски голосом (бывают «мусорные» слова от распознавания). Просит **не задавать вопросов — делать как лучше**.
- Аудитория: ученики 4 класса. Цель — профессиональный уровень, «чтобы хотелось платить» (монетизация пока только концепт, без реальной оплаты).
- Бренд: **«Капля»**. Коллекция из 10 Android-приложений (APK) + главный сайт, откуда их скачивают.

## Где что лежит
- Локально: `/home/user/src/kaplya` (git, ветка `main`).
- **Основной репозиторий: `vilam0652-hue/3dpremium56`** (remote `origin`). Старое содержимое (сайт LAYER LAB) сохранено в ветке `old-layerlab`.
- Старый репозиторий `vilam0652-hue/3dpremium` (remote `old-3dpremium`) — там был взломан Pages чужим доменом `goglw.com` (через фишинговую ссылку `max-vlweblogin.ink`). Файл CNAME удалён, но переехали в 3dpremium56. 3dpremium можно удалить, когда всё стабильно.
- Сайт: **https://vilam0652-hue.github.io/3dpremium56/** (Pages из `main` / root; владелец подтвердил, что открывается и не перекидывает).
- APK: **https://github.com/vilam0652-hue/3dpremium56/releases/tag/apk** (`kaplya-<id>.apk`).
- Переименовать репозиторий через прокси нельзя (403 на settings). Сайт/админка сами берут имя репозитория из адреса github.io.
- Сеть контейнера: нет доступа к github.io, dl.google.com, openrouter.ai, CDN. npm/pypi есть. gh api работает через `env -u GH_TOKEN gh api ...` (чтение runs/jobs/logs/releases можно; settings/pages/dispatch — нельзя).

## Состав (apps.json)
| id | Название | Вид | Иллюстрация |
|---|---|---|---|
| bust | 3D Bust | игра (собственная игра владельца, неон, three r128+bloom; стиль НЕ менять) | cube |
| buddy | Бадди — английский | учёба (курс как Duolingo, светлый стиль Liquid White) | dog |
| merge | Фруктовое слияние | игра (matter.js, фрукты + англ. названия; было «Слияние планет») | watermelon |
| space | Звёздный рейс | игра (three.js r128, спрайты Fluent, поддержка models/*.glb) | rocket |
| balloons | Шарики-примеры | игра (математика) | balloon |
| breakout | Стеклобой | игра (арканоид) | gem |
| multiply | Таблица-Турбо | учёба | abacus |
| words | Грамотей | учёба (орфография) | pen |
| world | Знайка | учёба (окружающий мир 4 кл.) | globe |
| grades | Мои оценки | учёба (приложение владельца из mon4a, формат данных `ocenki_v2` не ломать) | medal |

Удалены по просьбе владельца: «Капля Блоки» (у него есть 3D Bust), «English Start» (заменён «Бадди»).

## Дизайн (решения владельца)
- Нравится: **Liquid Black** — чёрный + белый + золото, «профессионально». Неон (стиль 3D Bust) отвергнут для коллекции, но сам 3D Bust оставлен как есть.
- «Бадди» — светлая версия (Liquid White: белое стекло, чёрные кнопки, золото), тёплый.
- **Не рисовать картинки кодом.** Генерировать в Gemini владелец отказался. Используем **Microsoft Fluent Emoji 3D (MIT)**: `shared/art/*.webp` (+ `shared/art/e/<код>.webp` и `map.js` для эмодзи курса). Полный набор (3391 шт.) распакован в `/tmp/claude-0/fe/x/package/assets/` (npm `@lobehub/fluent-emoji-3d@1.1.0`; при новом контейнере — `npm pack` заново).
- Шрифты: Unbounded (заголовки) + Manrope (текст), Nunito — в «Бадди»; всё локально в `shared/fonts`.
- 3D-модели из Meshy/Tripo — владелец не делает; код умеет грузить `apps/space/models/*.glb`, если появятся.

## Архитектура
- `shared/k.css` — дизайн-система Liquid Black (`.glass`, `.btn`, `.chip`, `.hud`, `.overlay .panel`, `.keypad`, `.progress`, токены).
- `shared/k.js` — `K.top`, `K.panel`, `K.sfx`, `K.burst`, `K.confetti`, `K.toast`, `K.coins` (валюта «капельки»), `K.best/getBest`, `K.store`, `K.img`, `K.art`, `K.artSrc`, `K.tilt`.
- `shared/three.min.js` = three r128 + `shared/lib/` (EffectComposer, UnrealBloomPass, GLTFLoader…), `shared/matter.min.js`.
- `android/` — одна WebView-обёртка на все приложения (`MainActivity.java`: localStorage, file access, мост `KaplyaNative.speak` для TTS). `android/build-all.sh` собирает APK по `apps.json` (создаёт mipmap-папки, копирует `shared/{k.css,k.js,fonts.css,fonts,art}` + lib/three для space, matter для merge).
- `.github/workflows/apk.yml` — на push в main (пути apps/shared/android/icons/apps.json) собирает все APK и кладёт в релиз `apk`. Подпись: секреты `KAPLYA_KEYSTORE_*` если есть, иначе debug-ключ из кэша Actions (кэш у GitHub сбоил → подпись может меняться, обновления ставить с удалением старой версии).
- Иконки: `icons/<id>.png` + `-192/-144/-96` (чёрное стекло + золотая рамка + Fluent-предмет; рендер Playwright-скриптом).
- Скрипты: `tools/inline-apps.py` (устарел, теперь `tools/build-site.py`), `tools/build-site.py` (страницы `app/<id>.html` + каталог на главной из `apps.json` + `site/content.json` + `site/shots/<id>-N.webp`), `tools/shots.js` + `tools/shots-webp.py` (скриншоты ×2, сервер на 8795), `tools/prepare-assets.py` (раскладка картинок/моделей от владельца), `tools/encrypt-admin.mjs`.

## Сайт
- `index.html` — главная (Liquid Black, парящие Fluent-иллюстрации в шапке, блок «Бадди», каталог игр/учёбы, установка, для родителей, подвал со ссылкой «Вход для администратора»). Стили сайта — `site/site.css`, скрипт — `site/site.js` (ссылки на APK по `data-apk`).
- `app/<id>.html` — подробные страницы приложений (галерея скриншотов, «коротко», характеристики, возможности, чему учит, как играть, другие приложения). Генерируются `tools/build-site.py`; тексты в `site/content.json`.
- `admin.html` — вход для администратора. Панель зашифрована AES-256-GCM (ключ PBKDF2-SHA256, 600k итераций из `логин + \0 + пароль`), в репо только `site/admin-data.js`. Панель: статистика скачиваний APK (GitHub API вживую), быстрые ссылки, ключ OpenRouter, обновления, безопасность.
- **Логин/пароль админа НЕ в репозитории**: `/tmp/claude-0/-home-user/19812890-67a8-596c-87f5-61e2ad221a1b/scratchpad/admin/creds.json`, исходник панели — `.../scratchpad/admin/panel.html`. Перешифровка: `node tools/encrypt-admin.mjs <creds.json> <panel.html>`. Если контейнер пересоздан и файлы пропали — сгенерировать новые креды и перешифровать, сообщить владельцу новые.
- Креды владельцу ещё НЕ отправлены — отправить в итоговом сообщении (посоветовать менеджер паролей).

## «Бадди» (английский)
- 8 разделов × 5 уроков (агент расширяет до 12), типы заданий: новое слово, картинка, перевод EN↔RU, аудирование, сборка фразы, пары. Косточки (серия), котики-хранители (заморозка, 60 печенек, до 3), сердечки (восстановление 20 мин), задания дня, магазин нарядов (Fluent-шляпы поверх щенка), награды, «Бадди Плюс» (концепт «Скоро»).
- Талисман: Fluent `dog.webp` + наряды/эмоции (`buddy-dog.js`, `buddyArt()`); старая `buddySVG` больше не используется для показа.
- ИИ-чат: OpenRouter, только бесплатные модели (список берётся из `/api/v1/models`, перебор при ошибке), ключ вводит взрослый во вкладке «Я», есть поле «свой сервер» (POST `{messages}` → `{reply}`) — под будущий Telegram-бот. Telegram Mini App: подключён `telegram-web-app.js`.

## Статус (2026-11-28)
- **Все 10 приложений улучшены агентами и проверены** (каждое — в отдельном коммите в main). Учебный контент «Знайки» (254 вопроса) и «Грамотея» (461 задание), английский «Бадди» (12 разделов) — перепроверены вручную, ошибок нет.
- В Android-обёртку добавлено разрешение INTERNET (нужно для ИИ-чата «Бадди»).
- Сайт: новые описания (`apps.json` desc, `site/content.json`), чёткие скриншоты ×2 в `site/shots/<id>-N.webp` (старые jpg удалены), страницы `app/<id>.html`, широкие карточки для заполнения рядов.
- Сборка APK и Pages на последнем коммите — успешно. Ветка `wip-agents` удалена.
- Логин/пароль админа отправлены владельцу в чат (в репо их нет).

## Что можно делать дальше
- Удаление старых репозиториев и переименование 3dpremium56 → kaplya — за владельцем.
- Постоянный ключ подписи APK (секреты `KAPLYA_KEYSTORE_*`), чтобы обновления ставились поверх.
- Telegram-бот/сервер для ИИ-чата «Бадди» (поле «свой сервер»: POST {messages} → {reply}).
- Пересъёмка скриншотов после изменений: сервер на 8795, `node tools/shots.js`, `python3 tools/shots-webp.py`, `python3 tools/build-site.py`.

## Вход на сайт (2026-11-28)
- Весь сайт (главная и `app/*.html`) закрыт входом: `site/gate.js` в `<head>` без сессии перекидывает на `login.html?next=…`. Сессия в localStorage `kaplya-session` (30 дней с «запомнить», иначе 1 день). Кнопка «Выйти» в подвале (`data-logout`). `admin.html` — отдельный вход администратора.
- Аккаунты: `site/accounts.js` (соль + PBKDF2-SHA256 210k от «логин в нижнем регистре + \0 + пароль»), исходник `.accounts.local.json` (в .gitignore), генератор `node tools/make-accounts.mjs .accounts.local.json`. Сейчас 2 аккаунта (логины/пароли — в `API.md`, не в git).
- Ограничение: репозиторий и релизы публичные, поэтому вход защищает страницы от обычных посетителей, но не исходники на GitHub и не прямые ссылки на APK.
- `API.md` (в .gitignore): ключ GigaChat API и аккаунты сайта.

## Свой сервер на VPS (2026-11-28)
- У владельца VPS в Финляндии: Ubuntu, 1 ГБ RAM. IP пока не сообщён, домена нет (по умолчанию `<IP-с-дефисами>.sslip.io`).
- `server/server.mjs` — Node 20 без зависимостей: вход проверяет сервер (cookie `kaplya`, HMAC, 30 дней), без входа отдаёт только `login.html` и общие файлы; закрыты `.*`, `*.md`, `server/ deploy/ tools/ android/`. `/apk/kaplya-<id>.apk` — только после входа (файлы в `/var/lib/kaplya/apk`, качает `deploy/update.sh` из релиза GitHub). `/api/chat?code=CHAT_CODE` — ИИ для «Бадди» (GigaChat → запасной OpenRouter), лимиты 60/день на IP, 8/мин, 3000/день всего. `/server-admin` (`server/admin.html`) — ученики (создание со сгенерированным паролем, сброс, удаление), статистика, адрес чата.
- Аккаунты при первом запуске: из `server/seed.json` (только PBKDF2-отпечатки: администратор = прежний логин админки, «Аккаунт 1», «Аккаунт 2»). Новые — scrypt.
- `deploy/install.sh` (одна команда, ставит Node 20, Caddy, swap 1 ГБ, сертификаты Минцифры для GigaChat, systemd `kaplya.service`, таймер `kaplya-update.timer` каждые 10 мин), `deploy/kaplyactl` (status, set-gigachat, set-openrouter, chat-url, new-chat-code, new-admin, update, logs, restart). Настройки: `/etc/kaplya/kaplya.env`.
- Сайт работает в двух режимах: GitHub Pages (как раньше, клиентская проверка) и сервер (https, не github.io → `login.html` идёт в `/api/login`, APK по `/apk/…`, у админа в подвале ссылка «Управление сервером»).
- Проверено локально: 15 проверок API + вход/выход в браузере. На реальном VPS ещё НЕ запускалось — ждём, когда владелец выполнит команду установки.
- Команда установки: `curl -fsSL https://raw.githubusercontent.com/vilam0652-hue/3dpremium56/main/deploy/install.sh | sudo bash`

## Полезное
- Артефакт с промптами для Gemini/Meshy (больше не нужен, владелец отказался генерировать): https://claude.ai/artifact/XA5TfNGDbevQ6LaSDwPuTQ
- Коммиты: автор `vilam0652-hue <vilam0652-hue@users.noreply.github.com>`, в конце сообщения строки `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` и `Claude-Session: https://claude.ai/code/session_01FxeEqjE8DP4WAVfJJi3LDx`.
- Push: `git -c push.negotiate=true push origin main` (предупреждение «push negotiation failed» — не ошибка).
