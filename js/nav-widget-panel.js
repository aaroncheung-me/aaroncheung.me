// Sidebar "mini display" panel -- lets a visitor flip between the same
// small live demos as the home page's tiles (js/home-tiles.js), but docked
// in the nav column instead of scrolled past once on the home page.
//
// Reuses home-tiles.js's mount functions directly (they were refactored to
// take a target element instead of a hardcoded id, specifically so this
// panel could reuse them without id collisions). Switching widgets just
// replaces the panel's innerHTML, which detaches the previous widget's
// frame element -- every home-tile mount function already has a
// `document.body.contains(...)` guard in its loop/observer that makes it
// self-terminate once its element is gone, so no separate teardown code is
// needed here.

const NAV_WIDGETS = [
  {
    id: "lofi",
    label: "Lofi Generator",
    caption: "reacts while it's playing",
    frameClass: "tile-lofi-frame",
    mount(frame) {
      // Same play button the home tile uses (id, classes, and all), just
      // under a different id -- both can be in the DOM at once while
      // viewing Home, so ids can't collide. js/lofi-player.js's
      // syncLofiButton() hides this one the same way it hides the home
      // tile's, once playing (the live scope becomes the "it's playing"
      // indicator).
      const playBtn = document.createElement("button");
      playBtn.id = "nav-widget-lofi-play-btn";
      playBtn.type = "button";
      playBtn.className = "footer-tray-btn tile-lofi-play-btn";
      playBtn.setAttribute("aria-label", "Play Lofi Generator, plays across the whole site");
      playBtn.textContent = "▶";
      playBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        setLofiPlaying(!getLofiPlaying());
      });
      frame.appendChild(playBtn);
      initTileLofi(frame);
    },
  },
  {
    id: "theme",
    label: "Theme Switcher",
    caption: "toggle to change the site, live",
    frameClass: "tile-theme-frame",
    mount(frame) {
      frame.innerHTML = `
        <button class="footer-tray-btn" id="nav-widget-palette-btn" onclick="toggleNavWidgetPopup(this,'palette')" aria-label="Change color palette">◐</button>
        <button class="footer-tray-btn" id="nav-widget-font-btn" onclick="toggleNavWidgetPopup(this,'font')" aria-label="Change font">Aa</button>
        <button class="footer-tray-btn" id="nav-widget-crt-btn" onclick="setCrt(!getCrt())" aria-label="Toggle CRT overlay">▦</button>
        <button class="footer-tray-btn" id="nav-widget-motion-btn" onclick="setReducedMotion(!getReducedMotion())" aria-label="Toggle reduced motion">▶</button>
        <button class="footer-tray-btn" id="nav-widget-theme-btn" onclick="toggleTheme()" aria-label="Toggle light/dark theme">☾</button>
      `;
    },
  },
  {
    id: "status",
    label: "Site Status",
    caption: "live from GitHub",
    frameClass: "nav-widget-status-frame",
    mount(frame) { loadSiteStatus(frame); },
  },
];

let navWidgetIndex = 0;

function renderNavWidget() {
  const content = document.getElementById("nav-widget-content");
  if (!content) return;
  const widget = NAV_WIDGETS[navWidgetIndex];

  content.innerHTML = `
    <div class="nav-widget-header">
      <button type="button" class="nav-widget-arrow" id="nav-widget-prev" aria-label="Previous widget">&lsaquo;</button>
      <span class="nav-widget-title">[${toNavLabel(widget.label)}]</span>
      <button type="button" class="nav-widget-arrow" id="nav-widget-next" aria-label="Next widget">&rsaquo;</button>
    </div>
    <div class="live-tile-frame ${widget.frameClass}" id="nav-widget-frame"></div>
    <p class="nav-widget-caption live-tile-caption">${widget.caption}</p>
  `;

  document.getElementById("nav-widget-prev").addEventListener("click", () => {
    navWidgetIndex = (navWidgetIndex - 1 + NAV_WIDGETS.length) % NAV_WIDGETS.length;
    renderNavWidget();
  });
  document.getElementById("nav-widget-next").addEventListener("click", () => {
    navWidgetIndex = (navWidgetIndex + 1) % NAV_WIDGETS.length;
    renderNavWidget();
  });

  widget.mount(document.getElementById("nav-widget-frame"));
}

function initNavWidgetPanel() {
  if (!document.getElementById("nav-widget-panel")) return;
  // Hidden entirely on mobile (css/tui.css) -- skip the mount work too
  // (canvas animations, GitHub fetches) rather than just hiding it visually.
  // Checked directly rather than via js/tui.js's isMobile(): this file loads
  // as a static deferred script, while tui.js is injected dynamically by
  // loader.js, so there's no guaranteed ordering between the two.
  if (window.innerWidth <= 768) return;
  renderNavWidget();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNavWidgetPanel);
} else {
  initNavWidgetPanel();
}
