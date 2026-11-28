/* Пропускает на страницу только после входа. Подключается в <head> до остального.
   Без входа — переход на login.html с возвратом на текущую страницу. */
(function () {
  var KEY = "kaplya-session";
  var root = document.currentScript && document.currentScript.src ? document.currentScript.src.replace(/site\/gate\.js.*$/, "") : "./";
  var ok = false;
  try {
    var s = JSON.parse(localStorage.getItem(KEY) || "null");
    ok = !!(s && s.u && s.exp > Date.now());
  } catch (e) { ok = false; }
  if (!ok) {
    document.documentElement.style.visibility = "hidden";
    location.replace(root + "login.html?next=" + encodeURIComponent(location.pathname + location.search + location.hash));
    return;
  }
  window.KAPLYA_LOGOUT = function () {
    try { localStorage.removeItem(KEY); } catch (e) { /* нет хранилища */ }
    var go = function () { location.replace(root + "login.html"); };
    try { fetch(root + "api/logout", { credentials: "same-origin" }).then(go, go); } catch (e) { go(); }
  };
  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-logout]").forEach(function (b) { b.addEventListener("click", function (e) { e.preventDefault(); window.KAPLYA_LOGOUT(); }); });
  });
})();
