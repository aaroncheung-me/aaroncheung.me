// Glitch hero: up to two transparent-PNG copies of the art overlap freely —
// a "normal" ambient copy, and a zoomed copy only visible through an
// error-window's clipped viewport. js/pages.js overrides layout per page via setHeroLayout().

(function () {
  const hero = document.getElementById('glitch-hero');
  if (!hero) return;

  const bg = document.getElementById('glitch-hero-bg');
  const windows = Array.from(hero.querySelectorAll('.error-window'));

  const ASPECT = 3500 / 2800; // chrchie.png is 2800x3500

  const DEFAULT_LAYOUT = {
    ambientVisible: true,  // is the "normal" layer shown as the always-on hero background?
    hasZoom: true,         // does a second, zoomed hidden layer exist at all?
    visibleScale: 0.85,    // size multiplier for the normal layer, after it's fitted to the screen
    visibleShiftX: -0.03,  // fraction of heroW, nudges the normal layer horizontally
    visibleShiftY: 0,      // fraction of heroH, nudges the normal layer vertically (added to the top MARGIN)
    zoomTargetW: 1500,     // fixed px width for the zoomed layer
    focus: { x: 0.50, y: 0.30 },      // fraction of the image the zoom centers on
    zoomShift: { x: 0.30, y: -0 }, // fraction of heroW/heroH, nudges the zoom layer's center
  };

  let layout = { ...DEFAULT_LAYOUT };

  // Per-window start position plus a small pixel jitter on each hidden
  // layer, so each window looks like a slightly misaligned read of the same
  // file rather than a seamless crop. Window 1 stays un-jittered as the
  // clean reference.
  const WINDOWS = [
    { start: { x: 0.10, y: 0.00 }, anchor: 'right', jitterNormal: { x: 0,  y: 0  }, jitterZoom: { x: 0,  y: 0  } },
    { start: { x: 0.28, y: 0.33 }, jitterNormal: { x: 3,  y: -2 }, jitterZoom: { x: -5, y: 3  } },
    { start: { x: 0.15, y: 0.56 }, jitterNormal: { x: -3, y: 3  }, jitterZoom: { x: 4,  y: -3 } },
    { start: { x: 0.42, y: 0.60 }, jitterNormal: { x: 2,  y: 2  }, jitterZoom: { x: -3, y: -4 } },
  ];

  let boxes = { normal: { w: 0, h: 0, x: 0, y: 0 }, zoom: { w: 0, h: 0, x: 0, y: 0 }, zoomEnabled: true };

  // Matches tui.css's mobile breakpoint.
  function isMobile() {
    return window.innerWidth <= 768;
  }

  // Matches art.css's tablet tier (769–1350px).
  function isTablet() {
    return window.innerWidth > 768 && window.innerWidth <= 1350;
  }

  function computeBoxes() {
    const heroW = hero.clientWidth;
    const heroH = hero.clientHeight;

    // Height-driven fit (tall portrait art), clearing footer/mobile-header.
    // Width and height must always derive from the same ASPECT ratio or the
    // box distorts against the image.
    const mobile = isMobile();
    const tablet = isTablet();
    const MARGIN = mobile ? 72 : 10; // px, breathing room from the top edge (clears #mobile-header, ~2.5rem, plus a gap so it's not flush against it)
    const FOOTER_CLEARANCE = mobile ? 16 : 80; // px, clears the desktop #footer; just a small margin on mobile (no bottom bar to clear)
    const availH = heroH - FOOTER_CLEARANCE - (mobile ? MARGIN : 0);
    const scale = mobile ? 1.1 : tablet ? 1 : layout.visibleScale;
    // Per-page shift values assume a wide desktop hero, so mobile/tablet ignore them.
    const shiftX = (mobile || tablet) ? 0 : layout.visibleShiftX;
    const shiftY = (mobile || tablet) ? 0 : layout.visibleShiftY;
    // Clamp after scaling, not before — scale>1 (mobile) could otherwise push the result back past heroW.
    const normalW = Math.min((availH / ASPECT) * scale, heroW);
    const normalH = normalW * ASPECT;
    const normal = {
      w: normalW,
      h: normalH,
      x: heroW * shiftX,
      y: MARGIN + heroH * shiftY,
    };

    // Fixed absolute size regardless of the normal layer's scale, so the
    // reveal stays a legible close-up. Disabled on mobile/tablet — a second
    // overlapping layer reads as clutter below desktop width.
    const zoomEnabled = layout.hasZoom && !mobile && !tablet;
    let zoom = { w: 0, h: 0, x: 0, y: 0 };
    if (zoomEnabled) {
      const zoomW = layout.zoomTargetW;
      const zoomH = zoomW * ASPECT;
      const centerX = heroW / 2 + heroW * layout.zoomShift.x;
      const centerY = heroH / 2 + heroH * layout.zoomShift.y;
      zoom = {
        w: zoomW,
        h: zoomH,
        x: centerX - layout.focus.x * zoomW,
        y: centerY - layout.focus.y * zoomH,
      };
    }

    boxes = { normal, zoom, zoomEnabled };

    // Forced on for mobile even when ambientVisible is false — otherwise
    // the page reads as a blank screen until a window is dragged open.
    bg.hidden = !layout.ambientVisible;
    bg.style.width  = normal.w + 'px';
    bg.style.height = normal.h + 'px';
    bg.style.left   = normal.x + 'px';
    bg.style.top    = normal.y + 'px';
  }

  // Cached here (off the hot path) rather than read fresh in placeWindow(),
  // which runs on every drag pointermove — re-reading offset* there would
  // force a synchronous reflow every frame.
  function cacheWindowMetrics(win) {
    win._w = win.offsetWidth;
    win._h = win.offsetHeight;
    win._barH = win.querySelector('.error-window-viewport').offsetTop;
  }

  function syncInnerImage(win, winLeft, winTop) {
    const imgNormal = win.querySelector('.error-window-img-normal');
    const imgZoom   = win.querySelector('.error-window-img-zoom');
    const top = winTop + win._barH;
    const jitter = win._jitter || { normal: { x: 0, y: 0 }, zoom: { x: 0, y: 0 } };

    function place(img, box, offset) {
      img.style.width  = box.w + 'px';
      img.style.height = box.h + 'px';
      img.style.left   = (box.x - winLeft + offset.x) + 'px';
      img.style.top    = (box.y - top + offset.y) + 'px';
    }
    place(imgNormal, boxes.normal, jitter.normal);

    imgZoom.hidden = !boxes.zoomEnabled;
    if (boxes.zoomEnabled) place(imgZoom, boxes.zoom, jitter.zoom);
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function placeWindow(win, left, top) {
    const heroW = hero.clientWidth;
    const heroH = hero.clientHeight;
    // Floor keeps a dragged window from sliding up behind the fixed #mobile-header.
    const minTop = isMobile() ? 48 : 0;
    const clampedLeft = clamp(left, 0, Math.max(0, heroW - win._w));
    const clampedTop  = clamp(top, minTop, Math.max(minTop, heroH - win._h));
    win.style.left = clampedLeft + 'px';
    win.style.top  = clampedTop + 'px';
    syncInnerImage(win, clampedLeft, clampedTop);
  }

  function initWindows() {
    const heroW = hero.clientWidth;
    const heroH = hero.clientHeight;
    windows.forEach((win, i) => {
      const cfg = WINDOWS[i % WINDOWS.length];
      win._jitter = { normal: cfg.jitterNormal, zoom: cfg.jitterZoom };
      cacheWindowMetrics(win);
      // 'right'-anchored windows treat start.x as a gap from the right edge
      // (heroW - own width - gap) instead of a fraction from the left, so
      // they load in right-anchored at any hero width.
      const left = cfg.anchor === 'right'
        ? heroW - win._w - heroW * cfg.start.x
        : heroW * cfg.start.x;
      placeWindow(win, left, heroH * cfg.start.y);
    });
  }

  function relayout() {
    computeBoxes();
    windows.forEach(win => {
      // Skip hidden windows (offsetParent null) — their offsetLeft/Top read
      // as 0 while hidden, which would otherwise pile them at the
      // top-left corner once they reappear.
      if (win.offsetParent === null) return;
      const left = win.offsetLeft;
      const top  = win.offsetTop;
      cacheWindowMetrics(win); // CSS media-query breakpoints can change window size on resize
      placeWindow(win, left, top);
    });
  }

  computeBoxes();
  initWindows();
  window.addEventListener('resize', relayout);

  // Lets js/pages.js override the layout per page — pass only the keys that
  // differ from DEFAULT_LAYOUT; anything omitted resets back to default.
  window.setHeroLayout = function (overrides) {
    layout = { ...DEFAULT_LAYOUT, ...overrides };
    relayout();
  };

  // Stacking order — whichever window you touched last stays on top
  // All windows share one z-index; re-appending the touched window as the
  // last DOM child brings it to front without an ever-growing z-index counter.

  function bringToFront(win) {
    win.parentNode.appendChild(win);
  }

  windows.forEach(win => {
    const bar = win.querySelector('.error-window-bar');
    const viewport = win.querySelector('.error-window-viewport');
    let dragging = false;
    let startX = 0, startY = 0, originLeft = 0, originTop = 0;

    // Clicking the image area (not the bar) still raises the window, but
    // doesn't involve pointer capture at all, so reordering the DOM here is
    // never a problem.
    viewport.addEventListener('pointerdown', () => bringToFront(win));

    bar.addEventListener('pointerdown', e => {
      // bringToFront() must run before setPointerCapture — reordering after
      // capture silently releases it, which was breaking drags once the
      // cursor left the bar's bounds.
      bringToFront(win);
      dragging = true;
      win.classList.add('dragging');
      startX = e.clientX;
      startY = e.clientY;
      originLeft = win.offsetLeft;
      originTop  = win.offsetTop;
      bar.setPointerCapture(e.pointerId);
    });

    bar.addEventListener('pointermove', e => {
      if (!dragging) return;
      placeWindow(win, originLeft + (e.clientX - startX), originTop + (e.clientY - startY));
    });

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      win.classList.remove('dragging');
      if (bar.releasePointerCapture && e.pointerId != null) {
        try { bar.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    }

    bar.addEventListener('pointerup', endDrag);
    bar.addEventListener('pointercancel', endDrag);
  });

  // Spawn-in
  // Re-triggered on every page open (js/pages.js's showPage(), skipped on
  // gallery) so windows pop in fresh each time.

  const SPAWN_STEP = 90; // ms between each window's pop-in, matches js/gallery.js's own stagger
  const SPAWN_BASE_DELAY = 250; // ms before the first window starts, on top of its own per-window stagger

  function spawnHeroWindows() {
    windows.forEach((win, i) => {
      if (win.offsetParent === null) return; // hidden (e.g. .gallery-active) — nothing to animate
      // Remove + reflow + re-add rather than just re-adding — these same 4
      // elements persist across every call, so a plain class toggle
      // wouldn't restart an already-finished CSS animation the second time
      // a page opens.
      win.classList.remove('window-spawn');
      win.style.opacity = '';
      void win.offsetWidth;
      win.style.animationDelay = (SPAWN_BASE_DELAY + i * SPAWN_STEP) + 'ms';
      win.classList.add('window-spawn');
      win.addEventListener('animationend', function onEnd(e) {
        if (e.animationName !== 'gallery-pop-in') return;
        win.classList.remove('window-spawn');
        win.style.opacity = '1';
        win.removeEventListener('animationend', onEnd);
      });
    });
  }

  window.spawnHeroWindows = spawnHeroWindows;

  // "Not responding" error toast — theme + font
  // The art section's tokens never actually respond to data-theme/data-art-font — this toast is a playful nudge instead of the controls silently no-oping.

  const toast = document.getElementById('glitch-hero-toast');
  if (toast) {
    let toastTimer = null;
    function showToast(text) {
      toast.textContent = text;
      toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
    }

    const observer = new MutationObserver((mutations) => {
      mutations.forEach(m => {
        if (m.attributeName === 'data-theme' && document.documentElement.getAttribute('data-theme') === 'light') {
          showToast('ERR 0x4C49 — light_mode.exe not responding');
        } else if (m.attributeName === 'data-art-font' && document.documentElement.hasAttribute('data-art-font')) {
          showToast('ERR 0x466E74 — font_swap.exe not responding');
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-art-font'] });
  }
})();
