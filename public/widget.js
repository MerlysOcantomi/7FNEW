(function () {
  var script = document.currentScript;
  if (!script) return;
  var key = script.getAttribute("data-key");
  if (!key) return;

  var host = script.src.replace(/\/widget\.js(\?.*)?$/, "");
  var isOpen = false;

  var btn = document.createElement("div");
  btn.setAttribute("aria-label", "Open chat");
  btn.setAttribute("role", "button");
  btn.setAttribute("tabindex", "0");
  btn.innerHTML =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>';
  btn.style.cssText =
    "position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:28px;background:#0F172A;color:white;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,0.15);z-index:9998;transition:transform 0.15s;";

  var iframe = document.createElement("iframe");
  iframe.src = host + "/widget/chat?key=" + encodeURIComponent(key);
  iframe.title = "Chat";
  iframe.style.cssText =
    "position:fixed;bottom:20px;right:20px;width:380px;height:520px;border:none;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.12);z-index:9999;display:none;";

  document.body.appendChild(btn);
  document.body.appendChild(iframe);

  function open() {
    isOpen = true;
    iframe.style.display = "block";
    btn.style.display = "none";
  }

  function close() {
    isOpen = false;
    iframe.style.display = "none";
    btn.style.display = "flex";
  }

  btn.addEventListener("click", open);
  btn.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") open();
  });
  btn.addEventListener("mouseenter", function () {
    btn.style.transform = "scale(1.08)";
  });
  btn.addEventListener("mouseleave", function () {
    btn.style.transform = "scale(1)";
  });

  window.addEventListener("message", function (e) {
    if (e.data === "7f_chat_close") close();
  });
})();
