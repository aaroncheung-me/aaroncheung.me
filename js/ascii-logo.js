(function () {
  const PALETTES = [
    '.,:-=+*#%@',
    '·:;!|1',
    '.oO0@',
    '-+xX#',
  ];

  const CHAR_ASPECT = MONO_CHAR_ASPECT;
  const COL_MIN     = 5;
  const FADE_MIN    = 0.0;
  const FADE_MAX    = 2.5;
  const FORM_STEPS  = 30;
  const FORM_MS     = 30;
  const HOLD_MS     = 10000;
  const DISSOLVE_MS = 30;
  const PAUSE_MS    = 150;

  function buildAscii(img, cols, chars, fadeFactor) {
    const rows = Math.round(cols * (img.naturalHeight / img.naturalWidth) * CHAR_ASPECT);
    const canvas = document.createElement('canvas');
    canvas.width  = cols;
    canvas.height = rows;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, cols, rows);
    const { data } = ctx.getImageData(0, 0, cols, rows);
    let out = '';
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        const alpha = data[i + 3] / 255;
        if (alpha < 0.05) { out += ' '; continue; }
        // Gamma-boost alpha so semi-transparent (lighter/shaded) regions still
        // read as solid characters instead of fading into the background.
        const boostedAlpha = Math.pow(alpha, 0.6);
        const density = Math.min(1, boostedAlpha * fadeFactor);
        const idx = Math.min(Math.floor(density * chars.length), chars.length - 1);
        out += chars[idx];
      }
      out += '\n';
    }
    return out;
  }

  function fitSize(pre, width, cols) {
    fitMonospaceFontSize(pre, width, cols, CHAR_ASPECT);
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function createAsciiLogo(cfg) {
    const IMG_ID       = cfg.imgId       || 'logo';
    const CONTAINER_ID = cfg.containerId || 'logo-container';
    const COL_MAX      = cfg.colMax      || 450;

    let paletteIdx  = 0;
    let currentCols = COL_MIN;
    let animTimer   = null;
    let visibilityHandler = null;

    function runAnimation(img, pre, sizeState) {
      let step      = 0;
      let phase     = 'forward';
      let pausedForVisibility = false;

      function frame() {
        if (!document.body.contains(pre)) return;
        if (document.hidden) { pausedForVisibility = true; return; }

        if (phase === 'forward') {
          const t    = step / FORM_STEPS;
          const cols = Math.round(lerp(COL_MIN, COL_MAX, t));
          const fade = lerp(FADE_MIN, FADE_MAX, t);
          pre.textContent = buildAscii(img, cols, PALETTES[paletteIdx], fade);
          currentCols = cols;
          fitSize(pre, sizeState.width, cols);
          step++;
          if (step > FORM_STEPS) {
            // Render once and sit still (no flicker) for HOLD_MS before dissolving.
            phase = 'hold';
            animTimer = setTimeout(frame, HOLD_MS);
          } else {
            animTimer = setTimeout(frame, FORM_MS);
          }

        } else if (phase === 'hold') {
          phase = 'backward';
          step  = FORM_STEPS;
          animTimer = setTimeout(frame, DISSOLVE_MS);

        } else {
          const t    = step / FORM_STEPS;
          const cols = Math.round(lerp(COL_MIN, COL_MAX, t));
          const fade = lerp(FADE_MIN, FADE_MAX, t);
          pre.textContent = buildAscii(img, cols, PALETTES[paletteIdx], fade);
          currentCols = cols;
          fitSize(pre, sizeState.width, cols);
          step--;
          if (step < 0) {
            paletteIdx = (paletteIdx + 1) % PALETTES.length;
            phase = 'forward';
            step  = 0;
            animTimer = setTimeout(frame, PAUSE_MS);
          } else {
            animTimer = setTimeout(frame, DISSOLVE_MS);
          }
        }
      }

      if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
      visibilityHandler = () => {
        if (document.hidden) {
          if (animTimer !== null) {
            clearTimeout(animTimer);
            animTimer = null;
          }
          pausedForVisibility = true;
        } else if (pausedForVisibility) {
          pausedForVisibility = false;
          frame();
        }
      };
      document.addEventListener('visibilitychange', visibilityHandler);

      frame();
    }

    return function init() {
      if (animTimer !== null) {
        clearTimeout(animTimer);
        animTimer = null;
      }
      if (visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler);
        visibilityHandler = null;
      }

      const preId = IMG_ID + '-ascii';
      const existing = document.getElementById(preId);
      if (existing) existing.remove();

      const img = document.getElementById(IMG_ID);
      const container = document.getElementById(CONTAINER_ID);
      if (!img || !container) return;

      const pre = document.createElement('pre');
      pre.id = preId;

      function start() {
        if (document.documentElement.getAttribute('data-reduced-motion') === 'true') {
          img.style.display = '';
          return;
        }

        const aspectRatio = img.naturalHeight / img.naturalWidth;
        const sizeState = { width: container.clientWidth };

        function pinHeight() {
          pre.style.height = Math.round(sizeState.width * aspectRatio) + 'px';
        }

        img.style.display = 'none';
        container.appendChild(pre);
        pinHeight();

        new ResizeObserver(() => {
          if (!document.body.contains(pre)) return;
          sizeState.width = container.clientWidth;
          pinHeight();
          fitSize(pre, sizeState.width, currentCols);
        }).observe(container);

        runAnimation(img, pre, sizeState);
      }

      (function poll() {
        if (!document.body.contains(img)) return;
        if (img.naturalWidth > 0) { start(); }
        else requestAnimationFrame(poll);
      })();
    };
  }

  window.initAsciiLogo = createAsciiLogo({ imgId: 'logo', containerId: 'logo-container', colMax: 450 });

  new MutationObserver(() => {
    window.initAsciiLogo();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduced-motion'] });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.initAsciiLogo();
    });
  } else {
    window.initAsciiLogo();
  }
})();
