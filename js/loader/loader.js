function loadScript(src, onload) {
  const script = document.createElement("script");
  script.type = "text/javascript";
  script.src = src;
  script.onreadystatechange = onload;
  script.onload = onload;
  document.head.appendChild(script);
}

Promise.all([
  includePartials().catch(e => console.error("Partials error:", e)),
  renderAllLists().catch(e => console.error("Lists error:", e))
]).then(() => {
  loadScript("js/tui.js?v=0.23", function () {
    init();
  });
});
