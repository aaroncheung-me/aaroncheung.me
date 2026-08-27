// Bootstraps the studies site: loads shared partials (footer, mobile chrome)
// and builds the nav tree in parallel, then hands off to the router. Plays
// the same role as the main portfolio's js/loader/loader.js, just without
// the dynamic-script-injection step -- every studies-*.js file here is a
// small, regular <script defer> tag, so there's no ordering problem to solve
// beyond "wait for data before calling initStudiesRouter()".
function bootStudies() {
  Promise.all([includePartials(), renderStudiesTree()]).then(() => {
    initStudiesRouter();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootStudies);
} else {
  bootStudies();
}
