// Interactive mesh grid: points bulge from the cursor and ease back. Render
// loop stops once settled; reduced-motion draws once and never reacts.

(function () {
  const hero = document.getElementById('glitch-hero');
  if (!hero) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'glitch-hero-mesh';
  hero.insertBefore(canvas, hero.firstChild); // first child + z-index:0 (art.css) keeps it behind everything
  const ctx = canvas.getContext('2d');

  const SPACING = 40;  // px, approximate — actual spacing is stretched slightly so the grid divides evenly between its insets, see buildGrid()
  const RADIUS = 200;  // px, cursor influence range
  const STRENGTH = 20; // px, max displacement right at the cursor
  const EASE = 0.15;
  const INSET = 100;   // px gap kept between the grid and the hero's edges (left/right/top, and the baseline before the bottom's extra chrome clearance below)

  let rows = [];   // rows[r][c] = { x, y, dx, dy } — x/y are resting position, dx/dy current displacement
  let mouseX = -9999;
  let mouseY = -9999;
  let running = false;

  function reducedMotion() {
    return document.documentElement.getAttribute('data-reduced-motion') === 'true';
  }

  function isMobileViewport() {
    return window.innerWidth <= 768; // matches js/glitch-hero.js's isMobile()
  }

  // How far a fixed chrome element (footer or mobile nav) reaches up into
  // the hero, measured live so it stays correct if that element's size changes.
  function chromeReach(el, heroBottom) {
    if (!el || getComputedStyle(el).display === 'none') return 0;
    const r = el.getBoundingClientRect();
    return Math.max(0, heroBottom - r.top);
  }

  function computeBottomInset() {
    const heroBottom = hero.getBoundingClientRect().bottom;
    let reach = 0;
    if (isMobileViewport()) {
      reach = Math.max(
        chromeReach(document.getElementById('nav-list'), heroBottom),
        chromeReach(document.getElementById('nav-toggle'), heroBottom)
      );
    } else {
      reach = chromeReach(document.getElementById('footer'), heroBottom);
    }
    return Math.max(INSET, reach + 24); // +24px breathing room beyond the chrome itself
  }

  function buildGrid() {
    const w = hero.clientWidth;
    const h = hero.clientHeight;
    canvas.width = w;
    canvas.height = h;
    rows = [];

    const left = INSET;
    const right = w - INSET;
    const top = INSET;
    const bottom = h - computeBottomInset();
    const innerW = Math.max(0, right - left);
    const innerH = Math.max(0, bottom - top);

    // Distribute points evenly across the exact span rather than stepping
    // by SPACING, so the last point lands exactly on the far edge.
    const cols = Math.max(1, Math.round(innerW / SPACING)) + 1;
    const rowCount = Math.max(1, Math.round(innerH / SPACING)) + 1;

    for (let r = 0; r < rowCount; r++) {
      const row = [];
      const ry = rowCount === 1 ? top : top + (r / (rowCount - 1)) * innerH;
      for (let c = 0; c < cols; c++) {
        const cx = cols === 1 ? left : left + (c / (cols - 1)) * innerW;
        row.push({ x: cx, y: ry, dx: 0, dy: 0 });
      }
      rows.push(row);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 2;

    rows.forEach(row => {
      ctx.beginPath();
      row.forEach((p, i) => {
        const x = p.x + p.dx;
        const y = p.y + p.dy;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    const cols = rows[0] ? rows[0].length : 0;
    for (let c = 0; c < cols; c++) {
      ctx.beginPath();
      rows.forEach((row, i) => {
        const p = row[c];
        const x = p.x + p.dx;
        const y = p.y + p.dy;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }

  function step() {
    let settled = true;
    rows.forEach(row => {
      row.forEach(p => {
        const ddx = p.x - mouseX;
        const ddy = p.y - mouseY;
        const dist = Math.sqrt(ddx * ddx + ddy * ddy);
        let tx = 0, ty = 0;
        if (dist < RADIUS) {
          const force = (1 - dist / RADIUS) * STRENGTH;
          const angle = Math.atan2(ddy, ddx);
          tx = Math.cos(angle) * force;
          ty = Math.sin(angle) * force;
        }
        p.dx += (tx - p.dx) * EASE;
        p.dy += (ty - p.dy) * EASE;
        if (Math.abs(tx - p.dx) > 0.05 || Math.abs(ty - p.dy) > 0.05) settled = false;
      });
    });

    draw();

    if (settled) {
      running = false;
    } else {
      requestAnimationFrame(step);
    }
  }

  function ensureRunning() {
    if (running || reducedMotion()) return;
    running = true;
    requestAnimationFrame(step);
  }

  buildGrid();
  draw();

  // Rebuilds once more on 'load' in case #nav-list was still empty
  // (js/pages.js populates it on DOMContentLoaded) at this script's first measurement.
  window.addEventListener('load', () => {
    buildGrid();
    draw();
  });

  hero.addEventListener('pointermove', e => {
    if (reducedMotion()) return;
    const rect = hero.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    ensureRunning();
  });

  hero.addEventListener('pointerleave', () => {
    mouseX = -9999;
    mouseY = -9999;
    ensureRunning();
  });

  window.addEventListener('resize', () => {
    buildGrid();
    draw();
  });
})();
