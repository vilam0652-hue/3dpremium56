/* Общий скрипт сайта: ссылки на APK и логотип. Имя репозитория берётся из адреса GitHub Pages. */
(function () {
  const seg = location.hostname.endsWith("github.io") ? location.pathname.split("/").filter(Boolean)[0] : null;
  const REPO = "vilam0652-hue/" + (seg || "3dpremium56");
  // на своём сервере APK отдаёт сервер (только после входа), на GitHub — раздел Releases
  const ON_SERVER = location.protocol === "https:" && !location.hostname.endsWith("github.io");
  const root = (document.currentScript && document.currentScript.src || "").replace(/site\/site\.js.*$/, "");
  window.KAPLYA_APK = (id) => ON_SERVER ? `${root}apk/kaplya-${id}.apk` : `https://github.com/${REPO}/releases/download/apk/kaplya-${id}.apk`;
  if (ON_SERVER) fetch(root + "api/me", { credentials: "same-origin" }).then((r) => r.ok ? r.json() : null).then((me) => {
    if (!me || !me.admin) return;
    document.querySelectorAll(".site-foot span:last-child").forEach((el) => { el.insertAdjacentHTML("afterbegin", `<a href="${root}server-admin">Управление сервером</a> · `); });
  }).catch(() => {});
  document.querySelectorAll("[data-apk]").forEach((a) => { a.href = window.KAPLYA_APK(a.dataset.apk); a.rel = "noopener"; });
  document.querySelectorAll(".logo-drop").forEach((el) => { if (window.K) el.innerHTML = K.dropSVG(); });
})();
