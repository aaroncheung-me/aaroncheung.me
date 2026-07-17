// Gallery — draggable, non-closable "error" popups, one per piece in
// data/gallery.json. New pieces: drop the file in images/gallery/ and add an
// entry there.

(function () {

let GALLERY = [];
const galleryReady = loadGallery();

// Text popup, not artwork — placed first so it's index 0 (first swipe on
// mobile), flagged type:'text' to skip image handling.
const ABOUT_ENTRY = {
  type: 'text',
  fname: 'about.txt',
  code: '0xG000', // artwork pieces get an auto-numbered 0xG### below — this one's called out as not one of them
  title: 'about this collection',
  // Array, not one string — each entry renders as its own <p>.
  body: [
    'one style, explored repeatedly. limited color palettes with the dark grey background and white highlights. hard edges, no gradients, and a single shape of background color that sets the flow and composition of the piece.',
    'drag a window to explore the page, click the art to zoom in.',
  ],
};

async function loadGallery() {
  try {
    const res = await fetch('data/gallery.json');
    const data = await res.json();
    GALLERY = [ABOUT_ENTRY, ...(data.pieces || [])];
  } catch (e) {
    console.error('gallery load failed', e);
  }
}

// Real aspect ratio per piece, needed so buildPopups() doesn't guess a
// height and visibly relocate the popup once the image loads. Preloading
// means this is normally already filled by the time the gallery opens.
const dimensionCache = {};

function recordDimensions(file, img) {
  if (img.naturalWidth && img.naturalHeight) {
    dimensionCache[file] = { w: img.naturalWidth, h: img.naturalHeight };
  }
}

function preloadImages() {
  galleryReady.then(() => {
    GALLERY.forEach(piece => {
      if (piece.type === 'text') return; // no file to preload
      const img = new Image();
      img.decoding = 'async';
      img.addEventListener('load', () => recordDimensions(piece.file, img));
      img.src = piece.file;
    });
  });
}

window.addEventListener('load', preloadImages);

function reducedMotion() {
  return document.documentElement.getAttribute('data-reduced-motion') === 'true';
}

function isMobile() {
  return window.innerWidth <= 768; // matches js/glitch-hero.js's isMobile()
}

function isTablet() {
  return window.innerWidth > 768 && window.innerWidth <= 1350;
}

function popupWidthRange() {
  if (isMobile()) return [130, 190];
  if (isTablet()) return [170, 240];
  return [200, 320];
}

// Same top/bottom clearance glitch-hero.js uses for this hero.
function verticalClearance() {
  return isMobile() ? { top: 72, bottom: 16 } : { top: 16, bottom: 90 };
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// Keeping clear of the nav
// Nav sits above popups (z-index) and would otherwise eat clicks meant for
// a popup underneath it — measured live so it's correct on any nav layout.
function navExclusionRects(hero) {
  const heroRect = hero.getBoundingClientRect();
  const rects = [];
  ['nav-list', 'nav-toggle'].forEach(id => {
    const el = document.getElementById(id);
    if (!el || getComputedStyle(el).display === 'none') return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const pad = 16;
    rects.push({
      left: r.left - heroRect.left - pad,
      right: r.right - heroRect.left + pad,
      top: r.top - heroRect.top - pad,
      bottom: r.bottom - heroRect.top + pad,
    });
  });
  return rects;
}

function overlapsAny(left, top, w, h, rects) {
  const right = left + w, bottom = top + h;
  return rects.some(r => left < r.right && right > r.left && top < r.bottom && bottom > r.top);
}

// Rejection-sampled position with two exclusion tiers: the nav is hard
// (never overlapped), other popups' bars are soft (best-effort) — keeps a
// crowded gallery from ever landing on the nav.
function randomPosition(w, h, heroW, heroH, marginTop, marginBottom, hardExclusions, softExclusions) {
  const maxLeft = Math.max(0, heroW - w);
  const maxTop = Math.max(marginTop, heroH - marginBottom - h);
  const soft = softExclusions || [];

  let fallback = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    const left = Math.random() * maxLeft;
    const top = marginTop + Math.random() * Math.max(0, maxTop - marginTop);
    if (overlapsAny(left, top, w, h, hardExclusions)) continue;
    if (!overlapsAny(left, top, w, h, soft)) {
      return { left: clamp(left, 0, maxLeft), top: clamp(top, marginTop, maxTop) };
    }
    if (!fallback) fallback = { left, top }; // clears the nav at least — kept in case nothing clears both
  }
  if (fallback) return { left: clamp(fallback.left, 0, maxLeft), top: clamp(fallback.top, marginTop, maxTop) };

  // Longer nav-only search as a last resort — the nav constraint matters, bar overlap doesn't.
  for (let attempt = 0; attempt < 100; attempt++) {
    const left = Math.random() * maxLeft;
    const top = marginTop + Math.random() * Math.max(0, maxTop - marginTop);
    if (!overlapsAny(left, top, w, h, hardExclusions)) {
      return { left: clamp(left, 0, maxLeft), top: clamp(top, marginTop, maxTop) };
    }
  }
  return { left: clamp(Math.random() * maxLeft, 0, maxLeft), top: clamp(marginTop, marginTop, maxTop) };
}

// Build / rebuild the popup flood

function buildPopups() {
  const hero = document.getElementById('glitch-hero');
  const container = document.getElementById('gallery-popups');
  if (!hero || !container) return;

  container.innerHTML = '';
  if (!GALLERY.length) return;

  // Mobile gets a completely different layout — see buildMobileStack()'s
  // own comment for why a scattered flood (desktop/tablet) doesn't work at
  // phone size.
  if (isMobile()) {
    buildMobileStack(container);
    return;
  }

  const heroW = hero.clientWidth;
  const heroH = hero.clientHeight;
  const { top: marginTop, bottom: marginBottom } = verticalClearance();
  const [minW, maxW] = popupWidthRange();
  const exclusions = navExclusionRects(hero);
  const skipAnim = reducedMotion();
  // Only a popup's bar has to stay tappable — later popups steer clear of
  // earlier bars so drags/clicks never land on the wrong window.
  const BAR_H = 26; // px, matches .error-window-bar's 1.6rem height
  const placedBars = [];
  // Scales down as the collection grows so the flood finishes spawning in under a second either way.
  const spawnStep = Math.min(90, 700 / GALLERY.length);
  let spawnIndex = 0;

  // Text pieces spawn last regardless of GALLERY order, so they animate in
  // last and paint on top at rest.
  const textPieces = [];

  GALLERY.forEach((piece, i) => {
    if (piece.type === 'text') {
      textPieces.push({ piece, i });
      return;
    }
    const dim = dimensionCache[piece.file];
    if (dim) {
      placePiece(piece, i, dim, spawnIndex++);
      return;
    }
    // Rare case: not preloaded yet — wait for the real load rather than guessing a height and correcting it visibly.
    const probe = new Image();
    probe.decoding = 'async';
    probe.addEventListener('load', () => {
      recordDimensions(piece.file, probe);
      placePiece(piece, i, dimensionCache[piece.file], spawnIndex++);
    });
    probe.src = piece.file;
  });

  textPieces.forEach(({ piece, i }) => placeTextPiece(piece, i, spawnIndex++));

  // Fixed guessed size, no real image to measure — one wrong guess matters
  // far less than for the whole gallery.
  function placeTextPiece(piece, i, spawnI) {
    const w = maxW; // as wide as this tier's biggest image popup gets
    const guessH = 260;

    // Centered rather than scattered so it isn't easy to miss among the
    // flood; falls back to the exclusion-aware search only if centered lands on the nav.
    const maxLeft = Math.max(0, heroW - w);
    const maxTop = Math.max(marginTop, heroH - marginBottom - guessH);
    let left = clamp((heroW - w) / 2, 0, maxLeft);
    let top = clamp((heroH - guessH) / 2, marginTop, maxTop);
    if (overlapsAny(left, top, w, guessH, exclusions)) {
      const pos = randomPosition(w, guessH, heroW, heroH, marginTop, marginBottom, exclusions, placedBars);
      left = pos.left;
      top = pos.top;
    }
    placedBars.push({ left: left - 8, right: left + w + 8, top: top - 8, bottom: top + BAR_H + 8 });

    const popup = document.createElement('div');
    popup.className = 'gallery-popup gallery-popup--text error-window';
    popup.dataset.index = String(i);
    popup.style.width = w + 'px';
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
    popup.innerHTML = `
      <div class="error-window-bar">
        <span class="error-window-fname">${piece.fname}</span>
        <span class="error-window-code">${piece.code}</span>
        <span class="error-window-x">✕</span>
      </div>
      <div class="gallery-popup-body gallery-popup-body--text">
        <p class="gallery-popup-text-title">${piece.title}</p>
        ${piece.body.map(p => `<p class="gallery-popup-text-body">${p}</p>`).join('')}
      </div>
    `;

    container.appendChild(popup);
    wirePopup(popup, hero, marginTop, marginBottom);
    spawnIn(popup, spawnI, skipAnim, spawnStep);
  }

  function placePiece(piece, i, dim, spawnI) {
    const popup = document.createElement('div');
    popup.className = 'gallery-popup error-window';
    popup.dataset.index = String(i);

    const w = minW + Math.random() * (maxW - minW);
    const h = w * (dim.h / dim.w);
    const pos = randomPosition(w, h, heroW, heroH, marginTop, marginBottom, exclusions, placedBars);
    placedBars.push({ left: pos.left - 8, right: pos.left + w + 8, top: pos.top - 8, bottom: pos.top + BAR_H + 8 });

    popup.style.width = w + 'px';
    popup.style.left = pos.left + 'px';
    popup.style.top = pos.top + 'px';

    const fname = piece.file.split('/').pop();
    popup.innerHTML = `
      <div class="error-window-bar">
        <span class="error-window-fname">${fname}</span>
        <span class="error-window-code">0xG${String(i + 1).padStart(3, '0')}</span>
        <span class="error-window-x">✕</span>
      </div>
      <div class="gallery-popup-body">
        <img class="gallery-popup-img" src="${piece.file}" alt="${piece.title}" draggable="false" loading="lazy" decoding="async">
      </div>
    `;

    container.appendChild(popup);
    wirePopup(popup, hero, marginTop, marginBottom);
    spawnIn(popup, spawnI, skipAnim, spawnStep);

    const img = popup.querySelector('.gallery-popup-img');
    img.addEventListener('click', () => {
      // Set by attachDrag() once a press on the image crosses the drag
      // threshold — a click firing right after a real drag would otherwise
      // pop the lightbox open the instant you let go of a piece you just
      // dragged into place.
      if (popup._suppressClick) { popup._suppressClick = false; return; }
      openLightbox(i);
    });
  }
}

// Mobile: one error-window at a time, swiped left/right, instead of the
// scattered flood. stackIndex persists across resizes, reset only on
// hideGalleryPopups().
let stackIndex = 0;

function buildMobileStack(container) {
  const skipAnim = reducedMotion();
  let index = Math.min(stackIndex, GALLERY.length - 1);

  const stack = document.createElement('div');
  stack.className = 'gallery-stack';
  container.appendChild(stack);

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'gallery-stack-nav gallery-stack-prev';
  prevBtn.setAttribute('aria-label', 'previous piece');
  prevBtn.textContent = '‹';

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'gallery-stack-nav gallery-stack-next';
  nextBtn.setAttribute('aria-label', 'next piece');
  nextBtn.textContent = '›';

  if (GALLERY.length <= 1) {
    prevBtn.hidden = true;
    nextBtn.hidden = true;
  }
  container.appendChild(prevBtn);
  container.appendChild(nextBtn);

  // Tracked explicitly, not via querySelector(), to avoid grabbing a still-exiting stale card mid-transition.
  let currentCard = null;

  function renderCard(dir) {
    const piece = GALLERY[index];
    const old = currentCard;
    const isText = piece.type === 'text';
    const fname = isText ? piece.fname : piece.file.split('/').pop();
    const body = isText
      ? `<div class="gallery-popup-body gallery-popup-body--text">
           <p class="gallery-popup-text-title">${piece.title}</p>
           ${piece.body.map(p => `<p class="gallery-popup-text-body">${p}</p>`).join('')}
         </div>`
      : `<div class="gallery-popup-body">
           <img class="gallery-popup-img" src="${piece.file}" alt="${piece.title}" draggable="false" loading="lazy" decoding="async">
         </div>`;

    const card = document.createElement('div');
    card.className = 'gallery-popup error-window gallery-stack-card' + (isText ? ' gallery-popup--text' : '');
    // .gallery-popup defaults to opacity:0 at rest — that's meant for the
    // desktop/tablet flood's spawnIn() animation, which this stack never
    // runs, so without this override every card would stay invisible.
    card.style.opacity = '1';
    card.innerHTML = `
      <div class="error-window-bar">
        <span class="error-window-fname">${fname}</span>
        <span class="error-window-code">${index + 1}/${GALLERY.length}</span>
        <span class="error-window-x">✕</span>
      </div>
      ${body}
    `;
    wireStackCard(card, index, go);
    currentCard = card;

    if (old && dir && !skipAnim) {
      // Old card exits the way it was swiped, new one enters from the opposite side.
      const outX = dir === 'next' ? '-110%' : '110%';
      const inX = dir === 'next' ? '110%' : '-110%';
      card.style.transform = `translateX(${inX})`;
      stack.appendChild(card);
      old.style.transition = 'transform 220ms ease, opacity 220ms ease';
      old.style.transform = `translateX(${outX})`;
      old.style.opacity = '0';
      old.addEventListener('transitionend', () => old.remove(), { once: true });
      // Forces the 'from' transform to register before the transition applies, so entry actually animates.
      void card.offsetWidth;
      card.style.transition = 'transform 220ms ease';
      card.style.transform = 'translateX(0)';
    } else {
      if (old) old.remove();
      stack.appendChild(card);
    }
  }

  function go(dir) {
    if (GALLERY.length <= 1) return;
    index = dir === 'next' ? (index + 1) % GALLERY.length : (index - 1 + GALLERY.length) % GALLERY.length;
    stackIndex = index;
    renderCard(dir);
  }

  prevBtn.addEventListener('click', () => go('prev'));
  nextBtn.addEventListener('click', () => go('next'));

  renderCard(null);
}

// Card follows the finger, commits to a page change past a distance
// threshold, snaps back otherwise; a mostly-vertical drag is released, a
// small movement is treated as a tap.
function wireStackCard(card, index, go) {
  const img = card.querySelector('.gallery-popup-img');
  let tracking = false;
  let dragging = false;
  let startX = 0, startY = 0, dx = 0;

  card.addEventListener('pointerdown', e => {
    if (e.target.closest('.error-window-x')) {
      denyShake(card);
      return;
    }
    tracking = true;
    dragging = false;
    dx = 0;
    startX = e.clientX;
    startY = e.clientY;
  });

  card.addEventListener('pointermove', e => {
    if (!tracking) return;
    const dxNow = e.clientX - startX;
    const dyNow = e.clientY - startY;
    if (!dragging) {
      if (Math.abs(dxNow) < 10 && Math.abs(dyNow) < 10) return;
      if (Math.abs(dyNow) > Math.abs(dxNow)) { tracking = false; return; }
      dragging = true;
      card._suppressClick = true;
      card.style.transition = 'none';
      card.setPointerCapture(e.pointerId);
    }
    dx = dxNow;
    card.style.transform = `translateX(${dx}px) rotate(${dx / 30}deg)`;
    card.style.opacity = String(Math.max(0.4, 1 - Math.abs(dx) / 300));
  });

  function endDrag(e) {
    if (!tracking) return;
    tracking = false;
    if (!dragging) return;
    dragging = false;
    if (card.releasePointerCapture && e.pointerId != null) {
      try { card.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    const THRESHOLD = 70;
    if (dx <= -THRESHOLD) {
      go('next');
    } else if (dx >= THRESHOLD) {
      go('prev');
    } else {
      card.style.transition = 'transform 180ms ease, opacity 180ms ease';
      card.style.transform = 'translateX(0)';
      card.style.opacity = '1';
    }
  }

  card.addEventListener('pointerup', endDrag);
  card.addEventListener('pointercancel', endDrag);

  if (!img) return; // text card — nothing to zoom into

  img.addEventListener('click', () => {
    if (card._suppressClick) { card._suppressClick = false; return; }
    openLightbox(index);
  });
}

// Runs once via a temp class, not a permanent animation — bringToFront()
// re-parents the popup on every click, which would otherwise restart the
// animation on every interaction.
function spawnIn(popup, index, skipAnim, spawnStep) {
  if (skipAnim) {
    popup.style.opacity = '1';
    return;
  }
  popup.style.animationDelay = (index * spawnStep) + 'ms';
  popup.classList.add('spawning');
  popup.addEventListener('animationend', function onEnd(e) {
    if (e.animationName !== 'gallery-pop-in') return;
    popup.classList.remove('spawning');
    popup.style.opacity = '1';
    popup.style.transform = '';
    popup.removeEventListener('animationend', onEnd);
  });
}

function bringToFront(popup) {
  popup.parentNode.appendChild(popup);
}

function denyShake(popup) {
  popup.classList.remove('deny-shake');
  void popup.offsetWidth; // force reflow so re-adding the class restarts the animation
  popup.classList.add('deny-shake');
}

// Bar drags immediately; the image waits for a movement threshold so it can still be tapped to zoom.
function attachDrag(handle, popup, hero, marginTop, marginBottom, opts) {
  const threshold = opts.threshold || 0;
  let tracking = false; // pointer is down on this handle, drag not yet confirmed
  let dragging = false;
  let startX = 0, startY = 0, originLeft = 0, originTop = 0;

  function applyMove(clientX, clientY) {
    const heroW = hero.clientWidth;
    const heroH = hero.clientHeight;
    const w = popup.offsetWidth;
    const h = popup.offsetHeight;
    const left = clamp(originLeft + (clientX - startX), 0, Math.max(0, heroW - w));
    const top = clamp(originTop + (clientY - startY), marginTop, Math.max(marginTop, heroH - marginBottom - h));
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
  }

  function startDrag(e) {
    dragging = true;
    // bringToFront() must run before setPointerCapture — see js/glitch-hero.js for why reordering after capture silently releases it.
    bringToFront(popup);
    popup.classList.add('dragging');
    if (opts.suppressesClick) popup._suppressClick = true;
    handle.setPointerCapture(e.pointerId);
  }

  handle.addEventListener('pointerdown', e => {
    if (opts.checkDeny && e.target.closest('.error-window-x')) {
      denyShake(popup);
      return;
    }
    if (opts.suppressesClick) popup._suppressClick = false;
    tracking = true;
    dragging = false;
    startX = e.clientX;
    startY = e.clientY;
    originLeft = popup.offsetLeft;
    originTop = popup.offsetTop;
    if (threshold === 0) startDrag(e);
  });

  handle.addEventListener('pointermove', e => {
    if (!tracking) return;
    if (!dragging) {
      if (Math.abs(e.clientX - startX) < threshold && Math.abs(e.clientY - startY) < threshold) return;
      startDrag(e);
    }
    applyMove(e.clientX, e.clientY);
  });

  function endDrag(e) {
    if (!tracking) return;
    tracking = false;
    if (!dragging) return;
    dragging = false;
    popup.classList.remove('dragging');
    if (handle.releasePointerCapture && e.pointerId != null) {
      try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
    }
  }

  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
}

function wirePopup(popup, hero, marginTop, marginBottom) {
  const bar = popup.querySelector('.error-window-bar');
  const body = popup.querySelector('.gallery-popup-body');

  attachDrag(bar, popup, hero, marginTop, marginBottom, { threshold: 0, checkDeny: true });
  attachDrag(body, popup, hero, marginTop, marginBottom, { threshold: 8, checkDeny: false, suppressesClick: true });
}

// Show/hide — called by js/pages.js on every page switch
// Popups are torn down on the way out and rebuilt from scratch on the way
// back in, so the spawn-in stagger replays each time the gallery is opened.

window.showGalleryPopups = function () {
  galleryReady.then(buildPopups);
};

window.hideGalleryPopups = function () {
  const container = document.getElementById('gallery-popups');
  if (container) container.innerHTML = '';
  stackIndex = 0; // next visit to the gallery starts from the first piece again
};

window.addEventListener('resize', () => {
  const hero = document.getElementById('glitch-hero');
  if (hero && hero.classList.contains('gallery-active')) buildPopups();
});

// Lightbox — click any popup's artwork to view it larger

let lbIndex = -1;

function openLightbox(index) {
  lbIndex = index;
  const piece = GALLERY[index];
  if (!piece) return;

  const lb = document.getElementById('art-lightbox');
  const img = document.getElementById('art-lb-img');
  const title = document.getElementById('art-lb-title');
  const meta = document.getElementById('art-lb-meta');
  const desc = document.getElementById('art-lb-desc');
  if (!lb) return;

  img.src = piece.file;
  img.alt = piece.title;
  title.textContent = piece.title;
  meta.textContent = `${piece.medium} · ${piece.year}`;
  desc.textContent = piece.description || '';
  desc.hidden = !piece.description;

  const single = GALLERY.length <= 1;
  document.getElementById('art-lb-prev').hidden = single;
  document.getElementById('art-lb-next').hidden = single;

  lb.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';
}

function lightboxStep(dir) {
  if (!GALLERY.length) return;
  openLightbox((lbIndex + dir + GALLERY.length) % GALLERY.length);
}

function closeLightbox() {
  document.getElementById('art-lightbox').setAttribute('hidden', '');
  document.body.style.overflow = '';
}

document.addEventListener('DOMContentLoaded', () => {
  const lb = document.getElementById('art-lightbox');
  if (!lb) return;

  document.getElementById('art-lb-close').addEventListener('click', closeLightbox);
  document.getElementById('art-lb-prev').addEventListener('click', () => lightboxStep(-1));
  document.getElementById('art-lb-next').addEventListener('click', () => lightboxStep(1));
  lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });

  bindEscapeToClose(() => !lb.hidden, closeLightbox);

  document.addEventListener('keydown', e => {
    if (lb.hidden) return;
    if (e.key === 'ArrowLeft') lightboxStep(-1);
    if (e.key === 'ArrowRight') lightboxStep(1);
  });
});

})();
