// Ambient glitch flashes fire on their own randomized timer, independent of
// user interaction. Each artifact is a DOM node that removes itself via its
// own animationend (see .glitch-artifact in tui.css). Gated by the CRT
// toggle and its own enable/frequency settings (js/theme.js).

(function () {
  const container = document.getElementById('glitch-artifacts');
  if (!container) return;

  function crtOn() {
    return document.documentElement.getAttribute('data-crt') === 'on';
  }

  function glitchEnabled() {
    return typeof getGlitchEnabled === 'function' ? getGlitchEnabled() : true;
  }

  function spawn() {
    const artifact = document.createElement('div');
    artifact.className = 'glitch-artifact' + (Math.random() < 0.35 ? ' glitch-artifact--tint' : '');
    artifact.style.top = (Math.random() * container.clientHeight) + 'px';
    artifact.style.height = (4 + Math.random() * 14) + 'px';
    artifact.addEventListener('animationend', () => artifact.remove());
    container.appendChild(artifact);
  }

  // Randomized gap between firings (not a fixed setInterval) so it doesn't
  // read as a mechanical loop; re-rolled after each firing.
  function scheduleNext() {
    const min = (typeof getGlitchMin === 'function' ? getGlitchMin() : 0.5) * 1000;
    const max = (typeof getGlitchMax === 'function' ? getGlitchMax() : 4.5) * 1000;
    const delay = min + Math.random() * Math.max(0, max - min);
    setTimeout(() => {
      // Checks happen at fire time, not load time, so toggling any setting
      // mid-session takes effect on the very next tick.
      if (crtOn() && glitchEnabled() && document.visibilityState === 'visible') spawn();
      scheduleNext();
    }, delay);
  }

  scheduleNext();
})();
