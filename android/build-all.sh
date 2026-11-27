#!/usr/bin/env bash
# Собирает отдельный APK для каждого приложения из apps.json.
# Запускается в GitHub Actions; результат кладётся в dist/kaplya-<id>.apk
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION="${GITHUB_RUN_NUMBER:-1}"
ONLY="${1:-}"
rm -rf dist && mkdir -p dist
RES=android/app/src/main/res
mkdir -p "$RES/mipmap-xxxhdpi" "$RES/mipmap-xxhdpi" "$RES/mipmap-xhdpi"

for row in $(jq -r '.[] | @base64' apps.json); do
  get() { echo "$row" | base64 -d | jq -r "$1"; }
  id=$(get .id); name=$(get .name); pkg=$(get .pkg)
  if [ -n "$ONLY" ] && [ "$ONLY" != "$id" ]; then continue; fi
  echo "::group::$name ($id)"

  web="android/build/web/$id"
  rm -rf "$web" && mkdir -p "$web/apps" "$web/shared"
  cp -r "apps/$id" "$web/apps/$id"
  cp -r shared/k.css shared/k.js shared/fonts.css shared/fonts shared/art "$web/shared/"
  [ "$id" = "space" ] && cp -r shared/three.min.js shared/lib "$web/shared/"
  [ "$id" = "merge" ] && cp shared/matter.min.js "$web/shared/"

  cp "icons/$id-192.png" "$RES/mipmap-xxxhdpi/ic_launcher.png"
  cp "icons/$id-144.png" "$RES/mipmap-xxhdpi/ic_launcher.png"
  cp "icons/$id-96.png"  "$RES/mipmap-xhdpi/ic_launcher.png"

  gradle -p android --no-daemon -q assembleRelease \
    -PappId="$id" -PappPkg="$pkg" -PappName="$name" -PappVersion="$VERSION"
  cp android/app/build/outputs/apk/release/app-release.apk "dist/kaplya-$id.apk"
  echo "::endgroup::"
done
ls -la dist
