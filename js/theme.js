const _IS_ART_SITE        = window.location.pathname.startsWith('/art');
const THEME_STORAGE_KEY   = _IS_ART_SITE ? "art-site-theme"  : "site-theme";
const REDUCED_MOTION_KEY  = "site-reduced-motion";
const PALETTE_STORAGE_KEY = "site-palette";
const FONT_STORAGE_KEY    = "site-font";
const CRT_STORAGE_KEY     = "site-crt";
const GLITCH_MIN_KEY      = "site-glitch-min";
const GLITCH_MAX_KEY      = "site-glitch-max";
const ART_FONT_KEY        = "art-site-font";
const ART_PALETTE_KEY     = "art-site-palette";

const GOOGLE_FONT_URLS = {
  "jetbrains": "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap",
  "ibm-plex":  "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&display=swap",
  "space":     "https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap",
};

// ── Art site palette ──────────────────────────────────────────────────────────

function getArtPalette() {
  return document.documentElement.getAttribute("data-art-palette") || "warm";
}

function setArtPalette(name) {
  if (name === "warm") {
    document.documentElement.removeAttribute("data-art-palette");
  } else {
    document.documentElement.setAttribute("data-art-palette", name);
  }
  localStorage.setItem(ART_PALETTE_KEY, name);
  syncThemeButtons();
}

// ── Art site font ─────────────────────────────────────────────────────────────

function getArtFont() {
  return document.documentElement.getAttribute("data-art-font") || "caveat";
}

function setArtFont(name) {
  if (name === "caveat") {
    document.documentElement.removeAttribute("data-art-font");
  } else {
    document.documentElement.setAttribute("data-art-font", name);
  }
  localStorage.setItem(ART_FONT_KEY, name);
  syncThemeButtons();
}

function getTheme() {
  return document.documentElement.getAttribute("data-theme") || "dark";
}

function setTheme(name) {
  document.body.classList.add("theme-transitioning");
  document.documentElement.setAttribute("data-theme", name);
  localStorage.setItem(THEME_STORAGE_KEY, name);
  syncThemeButtons();
  setTimeout(() => document.body.classList.remove("theme-transitioning"), 350);
}

function toggleTheme() {
  setTheme(getTheme() === "dark" ? "light" : "dark");
}

function getPalette() {
  return document.documentElement.getAttribute("data-palette") || "default";
}

function setPalette(name) {
  if (name === "default") {
    document.documentElement.removeAttribute("data-palette");
  } else {
    document.documentElement.setAttribute("data-palette", name);
  }
  localStorage.setItem(PALETTE_STORAGE_KEY, name);
  syncThemeButtons();
}

function getFont() {
  return document.documentElement.getAttribute("data-font") || "fira";
}

function loadGoogleFont(name) {
  const url = GOOGLE_FONT_URLS[name];
  if (!url) return;
  const id = `google-font-${name}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id   = id;
  link.rel  = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
}

function setFont(name) {
  loadGoogleFont(name);
  if (name === "fira") {
    document.documentElement.removeAttribute("data-font");
  } else {
    document.documentElement.setAttribute("data-font", name);
  }
  localStorage.setItem(FONT_STORAGE_KEY, name);
  syncThemeButtons();
}

function getCrt() {
  return document.documentElement.getAttribute("data-crt") === "on";
}

function setCrt(val) {
  document.documentElement.setAttribute("data-crt", val ? "on" : "off");
  localStorage.setItem(CRT_STORAGE_KEY, val ? "on" : "off");
  syncThemeButtons();
}

// ── Glitch effect on/off + frequency ───────────────────────────────────────
// Whether glitch-artifacts.js's flashes are enabled, and the random gap
// (seconds) between them. Bounds here (0.2-15s) must match the
// <input type="range"> min/max in data/ui-elements.json's slider markup --
// there's no shared source for them.
const GLITCH_ENABLED_KEY = "site-glitch-enabled";
const GLITCH_BOUND_MIN = 0.2;
const GLITCH_BOUND_MAX = 15;
const GLITCH_DEFAULT_MIN = 0.5;
const GLITCH_DEFAULT_MAX = 4.5;
const GLITCH_MIN_GAP = 0.2; // smallest allowed distance between the two handles

function getGlitchEnabled() {
  return localStorage.getItem(GLITCH_ENABLED_KEY) !== "off"; // on by default
}

function setGlitchEnabled(val) {
  localStorage.setItem(GLITCH_ENABLED_KEY, val ? "on" : "off");
  syncThemeButtons();
}

function getGlitchMin() {
  const v = parseFloat(localStorage.getItem(GLITCH_MIN_KEY));
  return Number.isFinite(v) ? v : GLITCH_DEFAULT_MIN;
}

function getGlitchMax() {
  const v = parseFloat(localStorage.getItem(GLITCH_MAX_KEY));
  return Number.isFinite(v) ? v : GLITCH_DEFAULT_MAX;
}

function setGlitchRange(min, max) {
  min = Math.max(GLITCH_BOUND_MIN, Math.min(min, max - GLITCH_MIN_GAP));
  max = Math.min(GLITCH_BOUND_MAX, Math.max(max, min + GLITCH_MIN_GAP));
  localStorage.setItem(GLITCH_MIN_KEY, String(min));
  localStorage.setItem(GLITCH_MAX_KEY, String(max));
  syncGlitchRangeUI();
}

// Reads both sliders live so dragging one past the other pushes it out of
// the way, rather than refusing to move at the minimum gap.
function handleGlitchRangeInput() {
  const minEl = document.getElementById('glitch-min-range');
  const maxEl = document.getElementById('glitch-max-range');
  if (!minEl || !maxEl) return;
  setGlitchRange(parseFloat(minEl.value), parseFloat(maxEl.value));
}

// Safe to call before the sliders exist in the DOM (each lookup just no-ops).
function syncGlitchRangeUI() {
  const minEl = document.getElementById('glitch-min-range');
  const maxEl = document.getElementById('glitch-max-range');
  const fill  = document.getElementById('glitch-range-fill');
  const val   = document.getElementById('glitch-range-val');
  if (!minEl || !maxEl) return;

  const min = getGlitchMin();
  const max = getGlitchMax();
  minEl.value = min;
  maxEl.value = max;

  if (fill) {
    const pct = (v) => ((v - GLITCH_BOUND_MIN) / (GLITCH_BOUND_MAX - GLITCH_BOUND_MIN)) * 100;
    fill.style.left  = pct(min) + '%';
    fill.style.width = (pct(max) - pct(min)) + '%';
  }
  if (val) {
    // Guard against a no-op write: textContent always creates a new text
    // node (a childList mutation) even when unchanged, and this function is
    // called from themeButtonObserver (itself a childList+subtree
    // MutationObserver) -- an unconditional write here would retrigger that
    // observer forever and freeze the tab.
    const text = `${min.toFixed(1)}s – ${max.toFixed(1)}s`;
    if (val.textContent !== text) val.textContent = text;
  }
}

function getReducedMotion() {
  return document.documentElement.getAttribute("data-reduced-motion") === "true";
}

function setReducedMotion(val) {
  document.documentElement.setAttribute("data-reduced-motion", val ? "true" : "false");
  localStorage.setItem(REDUCED_MOTION_KEY, val ? "true" : "false");
  syncThemeButtons();
}

function setActiveByData(attr, value, isActive) {
  document.querySelectorAll(`[data-${attr}="${value}"]`).forEach((el) => el.classList.toggle("active", isActive));
}

function syncThemeButtons() {
  const theme = getTheme();
  setActiveByData("theme-btn", "dark", theme === "dark");
  setActiveByData("theme-btn", "light", theme === "light");

  const palette = getPalette();
  setActiveByData("palette-btn", "default", palette === "default");
  setActiveByData("palette-btn", "ocean", palette === "ocean");
  setActiveByData("palette-btn", "forest", palette === "forest");
  setActiveByData("palette-btn", "ember", palette === "ember");

  const font = getFont();
  setActiveByData("font-btn", "fira", font === "fira");
  setActiveByData("font-btn", "jetbrains", font === "jetbrains");
  setActiveByData("font-btn", "ibm-plex", font === "ibm-plex");
  setActiveByData("font-btn", "space", font === "space");

  const crt = getCrt();
  setActiveByData("crt-btn", "on", crt);
  setActiveByData("crt-btn", "off", !crt);

  const glitchEnabled = getGlitchEnabled();
  setActiveByData("glitch-btn", "on", glitchEnabled);
  setActiveByData("glitch-btn", "off", !glitchEnabled);

  const reduced = getReducedMotion();
  setActiveByData("motion-btn", "on", !reduced);
  setActiveByData("motion-btn", "off", reduced);

  const themeSymbol = theme === "dark" ? "☾" : "☀";
  const footerThemeBtn = document.getElementById("footer-theme-btn");
  if (footerThemeBtn && footerThemeBtn.textContent !== themeSymbol) {
    footerThemeBtn.textContent = themeSymbol;
  }
  const mobileThemeBtn = document.getElementById("mobile-header-theme-btn");
  if (mobileThemeBtn && mobileThemeBtn.textContent !== themeSymbol) {
    mobileThemeBtn.textContent = themeSymbol;
  }

  const footerMotionBtn = document.getElementById("footer-motion-btn");
  const motionSymbol = getReducedMotion() ? "‖" : "▶";
  if (footerMotionBtn && footerMotionBtn.textContent !== motionSymbol) {
    footerMotionBtn.textContent = motionSymbol;
  }

  document.getElementById("footer-palette-btn")?.classList.toggle("active",
    _IS_ART_SITE ? getArtPalette() !== "warm" : getPalette() !== "default");
  document.getElementById("footer-font-btn")?.classList.toggle("active",    getFont()    !== "fira");
  document.getElementById("footer-crt-btn")?.classList.toggle("active",     getCrt());
  document.getElementById("mobile-header-crt-btn")?.classList.toggle("active", getCrt());

  const mobilMotionBtn = document.getElementById("mobile-header-motion-btn");
  const mobilMotionSymbol = getReducedMotion() ? "‖" : "▶";
  if (mobilMotionBtn && mobilMotionBtn.textContent !== mobilMotionSymbol) {
    mobilMotionBtn.textContent = mobilMotionSymbol;
  }
}

// ── Footer popup ─────────────────────────────────────────────────────────────

// Add an entry here (and a matching tab in partials/footer.html) when a new
// minisite goes live. '/' must stay first -- currentSiteTab() falls back to
// it for any unmatched path.
const SITE_TABS = [
  { path: '/',      label: 'aaroncheung.me/portfolio/', elId: 'footer-tab-portfolio', navLabel: 'main portfolio' },
  { path: '/art/',  label: 'aaroncheung.me/art/',       elId: 'footer-tab-art',       navLabel: 'art portfolio' },
  { path: '/sound/', label: 'aaroncheung.me/sound/',     elId: 'footer-tab-sound',     navLabel: 'sound/music site' },
];

function currentSiteTab() {
  return SITE_TABS.find(s => s.path !== '/' && window.location.pathname.startsWith(s.path)) || SITE_TABS[0];
}

function currentSitePath() {
  return currentSiteTab().path;
}

const FOOTER_POPUP_CONFIGS = {
  // Only used by the mobile header's site tab, which opens this as a
  // dropdown (desktop already lists sites as separate tabs).
  sites: {
    title: 'sites',
    options: SITE_TABS.map(s => ({ value: s.path, label: s.label })),
    get: currentSitePath,
    set: (value) => { if (value !== currentSitePath()) siteNavigate(value); },
  },
  palette: _IS_ART_SITE ? {
    title: 'palette',
    options: [
      { value: 'warm',     label: 'warm'     },
      { value: 'cool',     label: 'cool'     },
      { value: 'verdant',  label: 'verdant'  },
      { value: 'dusk',     label: 'dusk'     },
    ],
    get: getArtPalette,
    set: setArtPalette,
  } : {
    title: 'palette',
    options: [
      { value: 'default',   label: 'default'   },
      { value: 'ocean',     label: 'ocean'     },
      { value: 'forest',    label: 'forest'    },
      { value: 'ember',     label: 'ember'     },
    ],
    get: getPalette,
    set: setPalette,
  },
  font: _IS_ART_SITE ? {
    title: 'handwriting',
    options: [
      { value: 'caveat',   label: 'caveat'       },
      { value: 'kalam',    label: 'kalam'        },
      { value: 'patrick',  label: 'patrick hand' },
    ],
    get: getArtFont,
    set: setArtFont,
  } : {
    title: 'font',
    options: [
      { value: 'fira',      label: 'fira mono'  },
      { value: 'jetbrains', label: 'jetbrains'  },
      { value: 'ibm-plex',  label: 'ibm plex'   },
      { value: 'space',     label: 'space mono' },
    ],
    get: getFont,
    set: setFont,
  },
};

let _popupCloseHandler = null;

function toggleFooterPopup(button, type) {
  const popup = document.getElementById('footer-popup');
  if (!popup.hidden && popup.dataset.type === type) { closeFooterPopup(); return; }

  const cfg     = FOOTER_POPUP_CONFIGS[type];
  const current = cfg.get();

  popup.innerHTML =
    `<div class="popup-title">${cfg.title}</div>` +
    cfg.options.map(o =>
      `<button class="popup-option${o.value === current ? ' active' : ''}"
               onclick="selectFooterPopupOption('${type}','${o.value}')">
         <span class="popup-dot">${o.value === current ? '●' : ' '}</span>${o.label}
       </button>`
    ).join('');

  popup.dataset.type = type;

  if (type === 'sites') {
    // Anchor to the mobile header's own edges, not the button's -- the
    // button is inset in a taller row, so anchoring to it can land the
    // popup a few px off from the header's actual border.
    const headerRect = document.getElementById('mobile-header').getBoundingClientRect();
    popup.style.left      = headerRect.left + 'px';
    popup.style.right     = '';
    popup.style.transform = '';
    popup.style.top       = (headerRect.bottom + 4) + 'px';
    popup.style.bottom    = '';
  } else {
    // Same anchor-to-bar-edge reasoning as the 'sites' branch above; opens
    // above or below the trigger, whichever keeps the popup on-screen.
    const rect = button.getBoundingClientRect();
    const footerRect = document.getElementById('footer').getBoundingClientRect();
    const openAbove = rect.top > window.innerHeight / 2;
    popup.style.left      = (rect.left + rect.width / 2) + 'px';
    popup.style.right     = '';
    popup.style.transform = 'translateX(-50%)';
    popup.style.top    = openAbove ? '' : (footerRect.bottom + 4) + 'px';
    popup.style.bottom = openAbove ? (window.innerHeight - footerRect.top + 4) + 'px' : '';
  }
  popup.removeAttribute('hidden');

  requestAnimationFrame(() => {
    _popupCloseHandler = (e) => {
      if (!popup.contains(e.target) && e.target !== button) closeFooterPopup();
    };
    document.addEventListener('click', _popupCloseHandler);
  });
}

function closeFooterPopup() {
  const popup = document.getElementById('footer-popup');
  if (!popup) return;
  popup.hidden = true;
  popup.innerHTML = '';
  document.removeEventListener('click', _popupCloseHandler);
  _popupCloseHandler = null;
}

bindEscapeToClose(() => {
  const popup = document.getElementById('footer-popup');
  return !!popup && !popup.hidden;
}, closeFooterPopup);

function selectFooterPopupOption(type, value) {
  FOOTER_POPUP_CONFIGS[type].set(value);
  closeFooterPopup();
}

// Preload any non-default saved font so it's ready before the user opens UI Elements
(function () {
  const saved = localStorage.getItem(FONT_STORAGE_KEY);
  if (saved && saved !== "fira") loadGoogleFont(saved);
})();

// ── Footer clock (shared across all sites) ───────────────────────────────────

function initFooterClock() {
  function tick() {
    const now  = new Date();
    const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    const date = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const el   = document.getElementById("footer-datetime");
    if (el) el.textContent = `${date}  ${time}`;
    const mobileEl = document.getElementById("mobile-header-datetime");
    if (mobileEl) mobileEl.textContent = time;
  }

  // Populate immediately if the footer is already in the DOM; otherwise wait
  // for includePartials() to inject it (avoids up-to-1s delay + layout shift)
  if (document.getElementById("footer-datetime")) {
    tick();
  } else {
    const obs = new MutationObserver(() => {
      if (document.getElementById("footer-datetime")) {
        obs.disconnect();
        tick();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  setInterval(tick, 1000);
}

initFooterClock();

// ── Site tab navigation ───────────────────────────────────────────────────────

function siteNavigate(url) {
  if (getReducedMotion()) { window.location.href = url; return; }
  // Matches on role="main" rather than a hardcoded id list, so a new site's
  // fade-out works automatically as long as it keeps that attribute.
  const el = document.querySelector('[role="main"]');
  if (el) {
    el.style.transition = 'opacity 0.15s ease-out';
    el.style.opacity = '0';
  }
  setTimeout(() => { window.location.href = url; }, 160);
}

// ── Site tab swap (runs once via MutationObserver when footer loads) ──────────
// Static markup in footer.html assumes the portfolio is current; this only
// needs to rewrite tabs when you're not. Driven by SITE_TABS, so adding a
// site there is enough.

let _siteTabsSetup = false;

function setupSiteTabs() {
  if (_siteTabsSetup) return;
  const current = currentSiteTab();
  if (current.path === '/') { _siteTabsSetup = true; return; }
  if (!SITE_TABS.every(s => document.getElementById(s.elId))) return; // partial hasn't loaded yet
  _siteTabsSetup = true;

  SITE_TABS.forEach(s => {
    const el = document.getElementById(s.elId);
    el.outerHTML = s.path === current.path
      ? `<span class="footer-tab" id="${s.elId}">[<span class="tab-dot">●</span> ${s.label}<span class="cursor-blink"></span>]</span>`
      : `<button class="footer-tab footer-tab-link" id="${s.elId}" onclick="siteNavigate('${s.path}')" aria-label="Go to ${s.navLabel}">[${s.label}]</button>`;
  });
}

// ── Mobile header site tab (same idea, for the mobile header) ─────────────────

let _mobileHeaderSiteTabSetup = false;

function setupMobileHeaderSiteTab() {
  if (_mobileHeaderSiteTabSetup) return;
  const current = currentSiteTab();
  if (current.path === '/') { _mobileHeaderSiteTabSetup = true; return; }
  const tab = document.getElementById('mobile-header-site-tab');
  if (!tab) return;
  _mobileHeaderSiteTabSetup = true;
  tab.innerHTML = `[<span class="tab-dot">●</span> ${current.label}]`;
}

// Sync active states whenever the buttons are rendered into the DOM
const themeButtonObserver = new MutationObserver(() => {
  syncThemeButtons();
  syncGlitchRangeUI();
  setupSiteTabs();
  setupMobileHeaderSiteTab();
});
themeButtonObserver.observe(document.body, { childList: true, subtree: true });
