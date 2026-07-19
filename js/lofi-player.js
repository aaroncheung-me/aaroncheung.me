// Site-wide Lofi Generator toggle -- lets the procedural generator (see
// projects/lofi-sketch/) follow the visitor across every page instead of
// only playing on its own Projects entry. This is NOT a single-page app, so
// a normal link click reloads the document and kills any running
// AudioContext -- there's no way to make it literally continue through a
// navigation without rearchitecting how the whole site routes. Instead this
// just remembers "was it on" (and the last toggle/volume settings) in
// localStorage and restarts the generator fresh on the next page. Since the
// music is procedurally generated rather than a fixed track, a restart
// sounds like a continuation, not a jump cut.
//
// Same convention as js/theme.js: a `site-` prefixed localStorage key, a
// getX()/setX() pair that mirrors a `data-x` attribute onto <html> and
// calls a sync function, hooked into theme.js's existing themeButtonObserver
// so the footer/mobile-header button re-syncs whenever a partial injects.

const LOFI_PLAYING_KEY = "site-lofi-playing";
const LOFI_SETTINGS_KEY = "site-lofi-settings";
const LOFI_SAMPLES_SRC = "/projects/lofi-sketch/lofi-samples.js";
const LOFI_ENGINE_SRC = "/projects/lofi-sketch/lofi-engine.js";

function getLofiPlaying() {
  return localStorage.getItem(LOFI_PLAYING_KEY) === "true";
}

// loadScriptOnce is defined in js/theme.js (loaded on every site, ahead of this file).
function loadLofiSketchAssets(callback) {
  loadScriptOnce(LOFI_SAMPLES_SRC, function () {
    loadScriptOnce(LOFI_ENGINE_SRC, callback);
  });
}

function saveLofiSettings(state) {
  localStorage.setItem(LOFI_SETTINGS_KEY, JSON.stringify({
    precipitation: state.precipitation,
    atmosphere: state.atmosphere,
    vinylEnabled: state.vinylEnabled,
    overallVolume: state.overallVolume,
    chordVolume: state.chordVolume,
    melodyVolume: state.melodyVolume,
    drumVolume: state.drumVolume,
    rainVolume: state.rainVolume,
    staticVolume: state.staticVolume,
    vinylVolume: state.vinylVolume,
  }));
}

// Friendly-name volume keys, matching LofiSketch.setVolume's own map
// (projects/lofi-sketch/lofi-engine.js) -- 'atmosphere' here is the mix
// slider (staticVolume), not the Cityscape/Forest/etc. toggle state.
function applySavedLofiSettings() {
  const raw = localStorage.getItem(LOFI_SETTINGS_KEY);
  if (!raw || !window.LofiSketch) return;
  let s;
  try { s = JSON.parse(raw); } catch (e) { return; }

  if (s.precipitation) window.LofiSketch.setPrecip(s.precipitation);
  if (s.atmosphere) window.LofiSketch.setAtmosphere(s.atmosphere);
  if (typeof s.vinylEnabled === "boolean") window.LofiSketch.setVinyl(s.vinylEnabled);

  const volumePercents = {
    overall: s.overallVolume, chord: s.chordVolume, melody: s.melodyVolume,
    drum: s.drumVolume, rain: s.rainVolume, atmosphere: s.staticVolume, vinyl: s.vinylVolume,
  };
  Object.keys(volumePercents).forEach((name) => {
    const v = volumePercents[name];
    if (typeof v === "number") window.LofiSketch.setVolume(name, Math.round(v * 100));
  });
}

// AudioContexts can't make sound without a user gesture. If the toggle was
// left on from a previous page, the engine initializes (silently, possibly
// suspended) and this fires it up on the first click/keypress anywhere on
// the new page -- in practice indistinguishable from instant, since almost
// any interaction satisfies the browser's autoplay policy.
let _lofiResumeArmed = false;
function armLofiAutoResume() {
  if (_lofiResumeArmed) return;
  _lofiResumeArmed = true;
  const resume = () => {
    if (window.LofiSketch) window.LofiSketch.ensureEngine();
  };
  document.addEventListener("pointerdown", resume, { once: true });
  document.addEventListener("keydown", resume, { once: true });
}

let _lofiStateSubscribed = false;
function subscribeLofiStateChanges() {
  if (_lofiStateSubscribed || !window.LofiSketch) return;
  _lofiStateSubscribed = true;
  // Keeps the footer's on/off flag in sync no matter which UI actually
  // started/stopped playback (this button, the home tile, or the full
  // control panel on the Projects page) -- and persists settings on every
  // change so the next page restores the same mix, not just on/off.
  window.LofiSketch.onStateChange((state) => {
    localStorage.setItem(LOFI_PLAYING_KEY, state.isPlaying ? "true" : "false");
    document.documentElement.setAttribute("data-lofi-playing", state.isPlaying ? "true" : "false");
    saveLofiSettings(state);
    syncLofiButton();
  });
}

function lofiEnsureStarted() {
  loadLofiSketchAssets(() => {
    subscribeLofiStateChanges();
    applySavedLofiSettings();
    window.LofiSketch.ensureEngine();
    window.LofiSketch.start();
    armLofiAutoResume();
  });
}

function setLofiPlaying(val) {
  localStorage.setItem(LOFI_PLAYING_KEY, val ? "true" : "false");
  document.documentElement.setAttribute("data-lofi-playing", val ? "true" : "false");
  syncLofiButton();
  if (val) {
    lofiEnsureStarted();
  } else if (window.LofiSketch) {
    window.LofiSketch.stop();
  }
}

function syncLofiButton() {
  const playing = getLofiPlaying();
  const footerBtn = document.getElementById("footer-lofi-btn");
  if (footerBtn) footerBtn.classList.toggle("active", playing);
  // Home tile's play button -- visible when paused, hidden once playing
  // (the live scope itself becomes the "it's playing" indicator).
  const tileBtn = document.getElementById("tile-lofi-play-btn");
  if (tileBtn) tileBtn.classList.toggle("lofi-tile-hidden", playing);
  if (typeof renderMobileQuickSettings === "function") renderMobileQuickSettings();
}

// If it was left on, pick it back up on this page too -- but only load the
// (large, samples-included) engine once the page has settled, not blocking
// anything else.
(function () {
  if (getLofiPlaying()) {
    document.documentElement.setAttribute("data-lofi-playing", "true");
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", lofiEnsureStarted);
    } else {
      lofiEnsureStarted();
    }
  }
})();
