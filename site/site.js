/* Общий скрипт сайта: ссылки на APK и логотип. Имя репозитория берётся из адреса GitHub Pages. */
(function () {
  const seg = location.hostname.endsWith("github.io") ? location.pathname.split("/").filter(Boolean)[0] : null;
  const REPO = "vilam0652-hue/" + (seg || "3dpremium56");
  window.KAPLYA_APK = (id) => `https://github.com/${REPO}/releases/download/apk/kaplya-${id}.apk`;
  document.querySelectorAll("[data-apk]").forEach((a) => { a.href = window.KAPLYA_APK(a.dataset.apk); a.rel = "noopener"; });
  document.querySelectorAll(".logo-drop").forEach((el) => { if (window.K) el.innerHTML = K.dropSVG(); });
})();
