const CURSOR_HEATMAP_BLOB_RADIUS = 30;
const CURSOR_HEATMAP_MOVE_ALPHA = 14;
const CURSOR_HEATMAP_DWELL_ALPHA = 8;
const CURSOR_HEATMAP_CLICK_ALPHA = 90;
const CURSOR_HEATMAP_HEIGHT = 260;
const CURSOR_HEATMAP_TICK_MS = 100;

let cursorHeatmapAccumCtx = null;
let cursorHeatmapVisibleCtx = null;
let cursorHeatmapGradientLUT = null;
let cursorHeatmapWidth = 0;
let cursorHeatmapHeight = 0;
let cursorHeatmapPointer = null; // {x, y} relative to canvas, or null if not hovering
let cursorHeatmapTimer = null;
let cursorHeatmapClicks = []; // {x, y} points to mark with a dot

function cursorHeatmapBuildGradientLUT() {
  const lutCanvas = document.createElement("canvas");
  lutCanvas.width = 256;
  lutCanvas.height = 1;
  const ctx = lutCanvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 256, 0);
  gradient.addColorStop(0, "rgba(13,17,23,0)");
  gradient.addColorStop(0.25, "rgba(88,166,255,0.5)");
  gradient.addColorStop(0.55, "rgba(188,140,255,0.75)");
  gradient.addColorStop(0.8, "rgba(236,142,44,0.92)");
  gradient.addColorStop(1, "rgba(255,221,87,1)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 1);
  return ctx.getImageData(0, 0, 256, 1).data;
}

// Exposed for reuse by other pages' mini heatmap tiles (same blob-stamp/accumulator math, different canvases).
function cursorHeatmapDrawBlobOn(ctx, x, y, alpha, radius) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(0,0,0,${alpha / 255})`);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function cursorHeatmapRedrawOn(accumCtx, visibleCtx, width, height, lut) {
  const accumData = accumCtx.getImageData(0, 0, width, height);
  const outData = visibleCtx.createImageData(width, height);

  for (let i = 0; i < accumData.data.length; i += 4) {
    const alpha = Math.min(255, accumData.data[i + 3]);
    const lutIndex = alpha * 4;
    outData.data[i] = lut[lutIndex];
    outData.data[i + 1] = lut[lutIndex + 1];
    outData.data[i + 2] = lut[lutIndex + 2];
    outData.data[i + 3] = lut[lutIndex + 3];
  }

  visibleCtx.putImageData(outData, 0, 0);
}

function cursorHeatmapDrawBlob(x, y, alpha) {
  cursorHeatmapDrawBlobOn(cursorHeatmapAccumCtx, x, y, alpha, CURSOR_HEATMAP_BLOB_RADIUS);
}

function cursorHeatmapRedraw() {
  cursorHeatmapRedrawOn(cursorHeatmapAccumCtx, cursorHeatmapVisibleCtx, cursorHeatmapWidth, cursorHeatmapHeight, cursorHeatmapGradientLUT);
  cursorHeatmapDrawClickDots();
}

function cursorHeatmapDrawClickDots() {
  const ctx = cursorHeatmapVisibleCtx;
  cursorHeatmapClicks.forEach(({ x, y }) => {
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(13,17,23,0.8)";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.stroke();
  });
}

function cursorHeatmapTick() {
  // Without this check the interval would keep ticking after the DOM is
  // torn down (e.g. navigating away), redrawing a canvas nobody can see.
  if (!document.body.contains(cursorHeatmapVisibleCtx?.canvas)) {
    clearInterval(cursorHeatmapTimer);
    cursorHeatmapTimer = null;
    return;
  }
  if (cursorHeatmapPointer) {
    cursorHeatmapDrawBlob(cursorHeatmapPointer.x, cursorHeatmapPointer.y, CURSOR_HEATMAP_DWELL_ALPHA);
  }
  cursorHeatmapRedraw();
}

function cursorHeatmapHandleMove(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  cursorHeatmapPointer = { x, y };
  cursorHeatmapDrawBlob(x, y, CURSOR_HEATMAP_MOVE_ALPHA);
}

function cursorHeatmapHandleClick(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  cursorHeatmapDrawBlob(x, y, CURSOR_HEATMAP_CLICK_ALPHA);
  cursorHeatmapClicks.push({ x, y });
  cursorHeatmapRedraw();
}

function cursorHeatmapClear() {
  if (!cursorHeatmapAccumCtx) {
    return;
  }
  cursorHeatmapAccumCtx.clearRect(0, 0, cursorHeatmapWidth, cursorHeatmapHeight);
  cursorHeatmapClicks = [];
  cursorHeatmapRedraw();
}

function initCursorHeatmapDemo() {
  const root = document.getElementById("cursor-heatmap-demo");
  if (!root) {
    return;
  }

  if (cursorHeatmapTimer) {
    clearInterval(cursorHeatmapTimer);
    cursorHeatmapTimer = null;
  }

  const wrapper = root.querySelector("#cursor-heatmap-canvas-wrap");
  const mobileNote = root.querySelector("#cursor-heatmap-mobile-note");

  if (typeof isMobile === "function" && isMobile()) {
    wrapper.style.display = "none";
    if (mobileNote) {
      mobileNote.style.display = "block";
    }
    return;
  }

  wrapper.innerHTML = "";
  cursorHeatmapWidth = wrapper.clientWidth;
  cursorHeatmapHeight = CURSOR_HEATMAP_HEIGHT;

  const accumCanvas = document.createElement("canvas");
  accumCanvas.width = cursorHeatmapWidth;
  accumCanvas.height = cursorHeatmapHeight;
  // willReadFrequently -- cursorHeatmapRedrawOn() calls getImageData() on
  // this context every tick, not just once.
  cursorHeatmapAccumCtx = accumCanvas.getContext("2d", { willReadFrequently: true });

  const visibleCanvas = document.createElement("canvas");
  visibleCanvas.width = cursorHeatmapWidth;
  visibleCanvas.height = cursorHeatmapHeight;
  visibleCanvas.id = "cursor-heatmap-canvas";
  cursorHeatmapVisibleCtx = visibleCanvas.getContext("2d");

  wrapper.appendChild(visibleCanvas);

  cursorHeatmapGradientLUT = cursorHeatmapBuildGradientLUT();
  cursorHeatmapPointer = null;
  cursorHeatmapClicks = [];

  visibleCanvas.addEventListener("mousemove", (e) => cursorHeatmapHandleMove(e, visibleCanvas));
  visibleCanvas.addEventListener("mouseleave", () => {
    cursorHeatmapPointer = null;
  });
  visibleCanvas.addEventListener("click", (e) => cursorHeatmapHandleClick(e, visibleCanvas));

  cursorHeatmapRedraw();
  cursorHeatmapTimer = setInterval(cursorHeatmapTick, CURSOR_HEATMAP_TICK_MS);
}
