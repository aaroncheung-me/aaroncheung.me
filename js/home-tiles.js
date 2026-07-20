// Homepage "live demo" tiles: miniature, self-playing/interactive versions of
// the real project demos. Each tile's script lazy-loads only once it scrolls
// into view (via IntersectionObserver).

function isReducedMotion() {
  return document.documentElement.getAttribute('data-reduced-motion') === 'true';
}

// loadScriptOnce is defined in js/theme.js (loaded ahead of this file).

// Tracks last known cursor position so a tile that finishes lazy-loading
// mid-hover can react immediately instead of waiting for the next mousemove.
let lastMouseX = null;
let lastMouseY = null;
document.addEventListener('mousemove', (e) => {
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});

// Jumpy: AI vs AI self-play

const HOME_JUMPY_MOVE_MS = 800;

function homeJumpyNewState() {
  const board = jumpyInitialBoard();
  return {
    board,
    player: JUMPY_WHITE,
    visited: new Map([[jumpyStateKey(board, JUMPY_WHITE), 1]]),
    moveCount: 0,
    status: 'ongoing',
  };
}

function homeJumpyRender(state, boardEl) {
  boardEl.innerHTML = '';
  for (let i = 0; i < JUMPY_BOARD_SIZE; i++) {
    const value = jumpyGetSquare(state.board, i);
    const cell = document.createElement('div');
    cell.className = 'tile-jumpy-square';
    if (value === JUMPY_WHITE) cell.classList.add('text-blue');
    if (value === JUMPY_BLACK) cell.classList.add('text-green');
    cell.textContent = `[${jumpySquareSymbol(value)}]`.replace('[]', '[ ]');
    boardEl.appendChild(cell);
  }
}

function homeJumpyStep(state) {
  const move = jumpyGetBestMoveAvoidingRepeat(state.board, state.player, state.visited);
  jumpyAdvanceState(state, move);
}

function startJumpyTile() {
  const boardEl = document.getElementById('tile-jumpy-board');
  if (!boardEl) return;

  let state = homeJumpyNewState();
  homeJumpyRender(state, boardEl);

  if (isReducedMotion()) return;

  const timer = setInterval(() => {
    if (!document.body.contains(boardEl)) {
      clearInterval(timer);
      return;
    }
    if (state.status !== 'ongoing') {
      state = homeJumpyNewState();
    } else {
      homeJumpyStep(state);
    }
    homeJumpyRender(state, boardEl);
  }, HOME_JUMPY_MOVE_MS);
}

function initTileJumpy() {
  loadScriptOnce('projects/jumpy/jumpy-engine.js', startJumpyTile);
}

// Cursor Heatmap: the tile itself is the heatmap zone

const HOME_HEATMAP_BLOB_RADIUS = 18;
const HOME_HEATMAP_MOVE_ALPHA = 16;
const HOME_HEATMAP_DWELL_ALPHA = 8;
const HOME_HEATMAP_TICK_MS = 100;

function startHeatmapTile() {
  const frame = document.getElementById('tile-heatmap-frame');
  if (!frame) return;
  // A canvas already here is never a live instance to preserve -- it's
  // either stale markup baked into tui.js's cached HOME_CONTENT_HTML (this
  // tile's own lazy-load can beat tui.js's slower fetch chain to the punch
  // on first load, so the snapshot captures an inert canvas with no
  // listeners/timer attached) or a leftover from an earlier visit. Always
  // clear and rebuild rather than trusting it, same as js/ascii-logo.js does.
  frame.querySelectorAll('canvas').forEach((c) => c.remove());

  let width = 0;
  let height = 0;
  let accumCanvas = null;
  let accumCtx = null;
  let visibleCanvas = null;
  let visibleCtx = null;
  let pointer = null;
  const lut = cursorHeatmapBuildGradientLUT();

  function drawBlob(x, y, alpha) {
    cursorHeatmapDrawBlobOn(accumCtx, x, y, alpha, HOME_HEATMAP_BLOB_RADIUS);
  }

  function redraw() {
    cursorHeatmapRedrawOn(accumCtx, visibleCtx, width, height, lut);
  }

  // CSS size and buffer resolution are set together from the same
  // width/height (below) so they can't drift apart -- a mouse position
  // relative to the canvas rect is already a buffer coordinate, no
  // rescaling needed.
  function toBufferCoords(clientX, clientY) {
    const rect = visibleCanvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  // Creates canvases/listeners/timer once the frame has a real size, and
  // resyncs on every later change (font reflow, resize, ...) -- this tile's
  // IntersectionObserver can fire before render-lists.js's async fetch has
  // given the frame any width.
  function ensureSize() {
    const w = frame.clientWidth;
    const h = frame.clientHeight;
    if (!w || !h || (w === width && h === height)) return;
    width = w;
    height = h;

    if (!accumCanvas) {
      accumCanvas = document.createElement('canvas');
      // willReadFrequently -- shares cursorHeatmapRedrawOn(), which calls getImageData() every tick.
      accumCtx = accumCanvas.getContext('2d', { willReadFrequently: true });
    }
    accumCanvas.width = width;
    accumCanvas.height = height;

    const isFirstCreation = !visibleCanvas;
    if (isFirstCreation) {
      visibleCanvas = document.createElement('canvas');
      visibleCtx = visibleCanvas.getContext('2d');
    } else {
      // A real resize, not first creation -- old pointer coords were
      // relative to the previous size, no longer valid.
      pointer = null;
    }

    // Done before wiring the hover listeners below, so the "already
    // hovering" check has a correctly-sized rect (not a default 300x150 canvas).
    visibleCanvas.width = width;
    visibleCanvas.height = height;
    visibleCanvas.style.width = width + 'px';
    visibleCanvas.style.height = height + 'px';

    if (isFirstCreation) {
      frame.appendChild(visibleCanvas);

      visibleCanvas.addEventListener('mousemove', (e) => {
        pointer = toBufferCoords(e.clientX, e.clientY);
        drawBlob(pointer.x, pointer.y, HOME_HEATMAP_MOVE_ALPHA);
      });
      visibleCanvas.addEventListener('mouseleave', () => {
        pointer = null;
      });

      // The cursor may already be over this tile when the script finishes
      // loading -- without this, that hover stays invisible until the next
      // mousemove (which may never come).
      if (lastMouseX !== null && lastMouseY !== null) {
        const rect = visibleCanvas.getBoundingClientRect();
        if (lastMouseX >= rect.left && lastMouseX <= rect.right && lastMouseY >= rect.top && lastMouseY <= rect.bottom) {
          pointer = toBufferCoords(lastMouseX, lastMouseY);
          drawBlob(pointer.x, pointer.y, HOME_HEATMAP_MOVE_ALPHA);
        }
      }

      const timer = setInterval(() => {
        if (!document.body.contains(visibleCanvas)) {
          clearInterval(timer);
          return;
        }
        if (pointer) {
          drawBlob(pointer.x, pointer.y, HOME_HEATMAP_DWELL_ALPHA);
        }
        redraw();
      }, HOME_HEATMAP_TICK_MS);
    }

    redraw();
  }

  new ResizeObserver(ensureSize).observe(frame);
}

function initTileHeatmap() {
  loadScriptOnce('projects/heatmap/cursor-heatmap-demo.js', startHeatmapTile);
}

// Lofi Generator: doesn't auto-play (that's the footer toggle's job, and
// starting audio without a click would both violate autoplay policy and be
// a rude surprise) -- the tile just reflects whatever LofiSketch is
// currently doing. Flat line if nothing's playing anywhere on the site,
// live scope if it is.

function startLofiTile() {
  const frame = document.getElementById('tile-lofi-frame');
  if (!frame) return;
  // See startHeatmapTile()'s comment -- a pre-existing canvas here can be
  // stale markup from the same HOME_CONTENT_HTML race, not a live instance.
  frame.querySelectorAll('canvas').forEach((c) => c.remove());

  const canvas = document.createElement('canvas');
  frame.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let animId = null;

  function resize() {
    const w = frame.clientWidth;
    const h = frame.clientHeight;
    if (!w || !h || (w === width && h === height)) return;
    width = w;
    height = h;
    canvas.width = width;
    canvas.height = height;
  }
  new ResizeObserver(resize).observe(frame);
  resize();

  function siteVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function drawIdle() {
    if (!document.body.contains(canvas)) return;
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = siteVar('--clr-border', '#8090a8');
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawPlaying() {
    const analyser = window.LofiSketch && window.LofiSketch.getAnalyser();
    if (!analyser || !document.body.contains(canvas) || !window.LofiSketch.isPlaying()) {
      animId = null;
      drawIdle();
      return;
    }
    animId = requestAnimationFrame(drawPlaying);
    const bufferLength = analyser.fftSize;
    const data = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(data);

    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = siteVar('--clr-green', '#7ee787');
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const sliceWidth = width / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = data[i] / 128.0;
      const y = (v * height) / 2;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.stroke();
  }

  function refreshVisual() {
    const playing = window.LofiSketch && window.LofiSketch.isPlaying();
    if (playing && !animId) drawPlaying();
    else if (!playing) { if (animId) cancelAnimationFrame(animId); animId = null; drawIdle(); }
  }

  refreshVisual();
  if (window.LofiSketch) window.LofiSketch.onStateChange(refreshVisual);
}

function initTileLofi() {
  loadLofiSketchAssets(startLofiTile);
}

// Lazy-init wiring

function setupHomeTiles() {
  const tileInits = {
    'tile-jumpy': initTileJumpy,
    'tile-heatmap': initTileHeatmap,
    'tile-lofi': initTileLofi,
  };
  const initialized = new Set();

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      observer.unobserve(entry.target);
      // unobserve() only blocks future callbacks -- the browser can still
      // batch more than one crossing record for the same target into one
      // callback, so a duplicate entry can already be sitting in this
      // entries array. This guard stops a tile's init from running twice
      // in the same tick.
      if (initialized.has(id)) return;
      initialized.add(id);
      tileInits[id]?.();
    });
  }, { threshold: 0.2 });

  Object.keys(tileInits).forEach((id) => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupHomeTiles);
} else {
  setupHomeTiles();
}
