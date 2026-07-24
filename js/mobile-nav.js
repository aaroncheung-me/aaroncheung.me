// The single bottom-bar button doubles as both trigger and location
// indicator -- reads as "portfolio / current page" (tap to browse) rather
// than a bare hamburger icon, and flips to a "back to X" reading once the
// tree is open. Reuses #nav-location-content's text (js/tui.js's
// renderBreadcrumb/renderRootBreadcrumb keep it current on every
// navigation, mobile included -- it's just hidden via CSS on mobile, not
// unmaintained) instead of computing its own copy.
function mobileMenuBreadcrumbLabel() {
  const full = document.getElementById("nav-location-content")?.textContent || "portfolio";
  const parts = full.split(" / ");
  // Longer paths (a page nested inside a subfolder) get truncated to just
  // the last two segments -- the trailing, most-specific part of a
  // breadcrumb is the useful part on a narrow button, not "portfolio /".
  if (parts.length <= 2) return full;
  return "… / " + parts.slice(-2).join(" / ");
}

function updateMobileMenuButtonLabel(mode) {
  const btn = document.getElementById("mobile-menu-button");
  if (!btn) return;
  const label = mobileMenuBreadcrumbLabel();
  btn.textContent = mode === "list" ? `[‹ ${label}]` : `[${label}]`;
}

// Fades/slides the just-revealed panel in rather than snapping straight to
// its resting state -- only the incoming panel needs this, since the
// outgoing one is simply covered by the display:none swap (css/tui.css)
// the instant the mode class flips, nothing to animate out. Double rAF
// forces the browser to paint the pre-transition (opacity:0) state at
// least once before the class removal kicks the transition off; a single
// rAF sometimes lands before that paint and the "animation" just never
// happens. [data-reduced-motion="true"]'s global `transition: none` rule
// (css/tui.css) already neutralizes this when it matters, so there's no
// separate check needed here.
function animateMobilePanelIn(el) {
  if (!el) return;
  el.classList.add("mobile-panel-enter");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.classList.remove("mobile-panel-enter");
    });
  });
}

// Shows the same unified nav tree desktop uses -- no per-section filtering
// needed since (unlike the old 6-tab model) there's only ever one tree.
function showMobileList() {
  document.getElementById("section-container")?.classList.add("mobile-list-mode");
  updateMobileMenuButtonLabel("list");
  animateMobilePanelIn(document.getElementById("left-section"));
}

function showMobileDetailView() {
  document.getElementById("section-container")?.classList.remove("mobile-list-mode");
  updateMobileMenuButtonLabel("detail");
  animateMobilePanelIn(document.getElementById("right-section"));
}

// The one bottom-bar button does both jobs a separate menu + back button
// used to: opens the tree from content, and (since it doesn't re-render
// anything, just toggles which one is visible) closes back to whatever
// content was already showing, no distinct "back" control needed.
function toggleMobileMenu() {
  const container = document.getElementById("section-container");
  if (!container) return;
  if (container.classList.contains("mobile-list-mode")) {
    showMobileDetailView();
  } else {
    showMobileList();
  }
}

function initMobileNav() {
  const tabbar = document.getElementById("mobile-tabbar");
  if (!tabbar) {
    return;
  }

  document.getElementById("mobile-menu-button")?.addEventListener("click", toggleMobileMenu);
}
