function loadDependency(src, type, onload) {
  const head = document.head;
  const minStyle = document.getElementById("min-style");
  const el = type === "script" ? document.createElement("script") : document.createElement("link");
  if (type === "script") {
    el.type = "text/javascript";
    el.src = src;
  } else {
    el.rel = "stylesheet";
    el.href = src;
  }
  if (type === "script" && onload != null) {
    el.onreadystatechange = onload;
    el.onload = onload;
  }
  head.appendChild(el);
  if (type === "link") {
    minStyle?.remove();
  }
}

Promise.all([
  includePartials().catch(e => console.error("Partials error:", e)),
  renderAllLists().catch(e => console.error("Lists error:", e))
]).then(() => {
  loadDependency("css/tui.css?v=8", "link");
  loadDependency("js/tui.js?v=0.18", "script", function () {
    init();
  });
});
