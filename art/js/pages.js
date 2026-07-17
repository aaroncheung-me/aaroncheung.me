// Pages — home/gallery/about/commissions all share one hero; switching
// pages just repoints its images/labels. Nav is always 4 boxes: current
// page as info box, the rest as virus-alert links.

const PAGES = [
  {
    id: 'home', fname: 'home.exe', code: '0xA001', art: 'images/juniper.png',
    header: {
      subtitle: 'a running collection of my digital work.',
      bio: '⚠ threat detected - new pieces being downloaded', bioAlert: true,
    },
    popups: [
      {
        fname: 'whoami.exe', code: '0xC001',
        fields: [
          { label: 'name', value: 'aaron cheung' },
          { label: 'role', value: 'digital artist', hideOnMobile: true  },
          { label: 'medium', value: 'illustration + digital painting — krita', hideOnMobile: true },
          { label: 'commissions', value: 'closed', status: 'closed' },
        ],
      },
    ],
  },
  {
    id: 'gallery', fname: 'gallery.exe', code: '0xA002',
    header: {
      subtitle: 'pieces I cared enough about to finish.',
      bio: '⚠ scan complete - [24] infected files found. do not open.', bioAlert: true,
    },
  },
  {
    id: 'about', fname: 'about.exe', code: '0xA003', art: 'images/moofie.png',
    header: {
      subtitle: 'the person behind the files.',
      bio: '⚠ suspicious origin detected - identity unverified', bioAlert: true,
    },
    // No ambient copy, no zoom layer — the only way to see this page's art
    // at all is by dragging a window over it, and it's bigger since it's
    // carrying the whole reveal on its own.
    layout: { ambientVisible: false, hasZoom: false, visibleScale: 1.05, visibleShiftX: 0.10, visibleShiftY: -0.05 },
    // Sits directly in the hero as plain text rather than its own window;
    // last paragraphs are dropped on mobile via hideOnMobile.
    backgroundText: [
      { text: 'i’m aaron. self-taught artist, started with pencil and paper, learned paints and colors, then moved to digital and never really looked back. everything recent is made in Krita.' },
      { text: 'for a while i was making art for an audience. posting on a schedule, drawing what performed well, watching numbers instead of making things. it worked about as well as you’d expect, and at some point i stopped enjoying it. so i quit doing that and started drawing whatever i actually wanted to make. this site is what came out the other side.' },
      { text: 'right now that means one style, explored over and over: one or two colors plus black and white, flat color only, one background shape running each piece. the constraints are the point. same rules every time, different result every time.', hideOnMobile: true },
      { text: 'when i’m not drawing i make music and build things out of wood. apparently i just like making stuff.', hideOnMobile: true },
    ],
    popups: [
      {
        fname: 'about.txt', code: '0xC011', draggable: true,
        fields: [
          { label: 'email', value: 'contact@aaroncheung.me' },
          { label: 'tools/setup', value: '⚠ system scan: ERROR' },
          { label: 'commissions', value: 'closed', status: 'closed' },
        ],
      },
    ],
  },
  {
    id: 'commissions', fname: 'commissions.exe', code: '0xA004', art: 'images/gawr gura.png',
    header: {
      subtitle: 'custom pieces, made in the style you see in the gallery.',
      bio: ['⚠ FATAL ERROR - service unavailable', 'ERROR 403: commissions are closed.'], bioAlert: true,
    },
    popups: [
      {
        fname: 'pricing.dat', code: '0xC020',
        fields: [
          { label: 'pricing data', value: 'NULL' },
          { label: 'turnaround', value: 'NULL' },
          { label: 'slots', value: '0 of 0' },
        ],
        note: 'no reopen date scheduled',
      },
    ],
  },
];

let currentPage = 'home';

// Fake filename variant per hero window (matches the pattern already in
// index.html: base name, then ~, (2), and .bak) so the labels stay honest
// about which file is actually loaded instead of always saying "chrchie.png".
const WINDOW_VARIANTS = [
  name => name,
  name => name + '~',
  name => name.replace(/(\.[^.]+)$/, '(2)$1'),
  name => name + '.bak',
];

function updateHeroLabels(art) {
  const base = art.split('/').pop();
  document.querySelectorAll('.glitch-hero .error-window').forEach((win, i) => {
    const variant = WINDOW_VARIANTS[i % WINDOW_VARIANTS.length](base);
    win.querySelector('.error-window-fname').textContent = variant;
  });
}

function showPage(id) {
  const page = PAGES.find(p => p.id === id);
  if (!page) return;
  currentPage = id;

  // Gallery has no art of its own (no hero, see .gallery-active in
  // art.css) -- leave the hero images/labels as whatever the last real
  // page left them rather than pointing them at something invisible.
  if (page.art) {
    document
      .querySelectorAll('#glitch-hero-bg img, .error-window-img-normal, .error-window-img-zoom')
      .forEach(img => { img.src = page.art; });
    updateHeroLabels(page.art);
  }

  // Gallery replaces the hero's own peephole windows with a flood of
  // popups (js/gallery.js) instead of layering on top of them — the two
  // don't mix, so the peephole side hides via .gallery-active in art.css
  // whenever this is the active page. This has to happen *before*
  // setHeroLayout() below (which triggers a relayout) — glitch-hero.js
  // skips repositioning windows that are currently hidden, so relayout
  // needs to see their true, already-settled visibility for this page,
  // not whatever it was for the page being left.
  const hero = document.getElementById('glitch-hero');
  if (hero) hero.classList.toggle('gallery-active', id === 'gallery');
  if (id === 'gallery') {
    if (typeof window.showGalleryPopups === 'function') window.showGalleryPopups();
  } else if (typeof window.hideGalleryPopups === 'function') {
    window.hideGalleryPopups();
  }

  if (typeof window.setHeroLayout === 'function') {
    window.setHeroLayout(page.layout || {});
  }

  // Gallery has its own flood/spawn-in (js/gallery.js) instead — the hero's
  // 4 peephole windows are hidden there anyway (.gallery-active above).
  if (id !== 'gallery' && typeof window.spawnHeroWindows === 'function') {
    window.spawnHeroWindows();
  }

  renderHeroBackgroundText(page);
  renderPagePopups(page);
  renderNav();
}

// Plain text sitting directly in the hero scene (currently just About's
// bio) rather than in its own window — hidden entirely on any page that
// doesn't set backgroundText.
function renderHeroBackgroundText(page) {
  const el = document.getElementById('hero-bg-text');
  if (!el) return;
  const paragraphs = page.backgroundText;
  if (!paragraphs) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  el.innerHTML = paragraphs.map(p => `<p${p.hideOnMobile ? ' class="hero-bg-text-desktop-only"' : ''}>${p.text}</p>`).join('');
  el.hidden = false;
}

// Two popup shapes: `fields` (label/value rows, `status` fields render in
// error-red, `hideOnMobile` fields render but are CSS-hidden on mobile) or
// `paragraphs` (plain prose). A `fields` popup can add a trailing `note`.
function pagePopupHTML(popup) {
  const inner = popup.paragraphs
    ? `
      <div class="page-popup-prose">
        ${popup.title ? `<p class="gallery-popup-text-title">${popup.title}</p>` : ''}
        ${popup.paragraphs.map(p => `<p class="gallery-popup-text-body">${p}</p>`).join('')}
      </div>
    `
    : `
      <dl class="field-list">${popup.fields.map(f => `
        <div class="field-row${f.hideOnMobile ? ' field-row--desktop-only' : ''}">
          <dt>${f.label}</dt>
          <dd${f.status ? ' class="field-status"' : ''}>${f.value}</dd>
        </div>
      `).join('')}</dl>
      ${popup.note ? `<p class="page-popup-note">${popup.note}</p>` : ''}
    `;

  return `
    <div class="page-popup error-window${popup.draggable ? ' page-popup--draggable' : ''}">
      <div class="error-window-bar">
        <span class="error-window-fname">${popup.fname}</span>
        <span class="error-window-code">${popup.code}</span>
        <span class="error-window-x">✕</span>
      </div>
      ${inner}
    </div>
  `;
}

// Same pop-in as the hero's own windows; no restart-guard needed since
// these elements are freshly created each call.
function spawnPagePopup(popup, index) {
  popup.style.animationDelay = (index * 90) + 'ms';
  popup.classList.add('spawning');
  popup.addEventListener('animationend', function onEnd(e) {
    if (e.animationName !== 'gallery-pop-in') return;
    popup.classList.remove('spawning');
    popup.style.opacity = '1';
    popup.removeEventListener('animationend', onEnd);
  });
}

function renderPagePopups(page) {
  const container = document.getElementById('page-popups');
  if (!container) return;
  container.innerHTML = (page.popups || []).map(pagePopupHTML).join('');

  container.querySelectorAll('.page-popup').forEach(spawnPagePopup);

  // Only .page-popup--draggable opts out of the static flex-column layout
  // (see attachDraggablePopup()) — everything else (e.g. home's whoami)
  // stays exactly as it was.
  container.querySelectorAll('.page-popup--draggable').forEach(attachDraggablePopup);
}

// Bar-drag only, no click-guard needed — page-popup fields aren't clickable the way gallery artwork is.
function attachDraggablePopup(popup) {
  const bar = popup.querySelector('.error-window-bar');
  if (!bar) return;
  popup.style.left = '0px';
  popup.style.top = '0px';

  let dragging = false;
  let startX = 0, startY = 0, originLeft = 0, originTop = 0;
  let minLeft = 0, maxLeft = 0, minTop = 0, maxTop = 0;

  bar.addEventListener('pointerdown', e => {
    // Reorder before setPointerCapture, not after — see js/glitch-hero.js
    // for why reordering post-capture silently releases it.
    popup.parentNode.appendChild(popup);
    dragging = true;
    popup.classList.add('dragging');
    startX = e.clientX;
    startY = e.clientY;
    originLeft = popup.offsetLeft;
    originTop = popup.offsetTop;

    // Clamp bounds must be computed against the hero's true edges, not
    // #page-popups' own offset — otherwise the popup can't be dragged past
    // wherever that container happens to sit.
    const hero = document.getElementById('glitch-hero');
    const heroRect = hero.getBoundingClientRect();
    const containerRect = popup.offsetParent.getBoundingClientRect();
    const offsetX = containerRect.left - heroRect.left;
    const offsetY = containerRect.top - heroRect.top;
    minLeft = -offsetX;
    maxLeft = Math.max(minLeft, heroRect.width - popup.offsetWidth - offsetX);
    minTop = -offsetY;
    maxTop = Math.max(minTop, heroRect.height - popup.offsetHeight - offsetY);

    bar.setPointerCapture(e.pointerId);
  });

  bar.addEventListener('pointermove', e => {
    if (!dragging) return;
    const left = Math.min(maxLeft, Math.max(minLeft, originLeft + (e.clientX - startX)));
    const top = Math.min(maxTop, Math.max(minTop, originTop + (e.clientY - startY)));
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    popup.classList.remove('dragging');
    if (bar.releasePointerCapture && e.pointerId != null) {
      try { bar.releasePointerCapture(e.pointerId); } catch (_) {}
    }
  }

  bar.addEventListener('pointerup', endDrag);
  bar.addEventListener('pointercancel', endDrag);
}

// Same derived name feeds both the active title and the alert "wants to run" line, so both states read as one process.
function pageDisplayName(p) {
  return p.id.toUpperCase() + '.exe';
}

// bio is usually one sentence (a plain <p>), but commission's needed two
// distinct alert-style lines side by side — an array renders as its own
// wrapper with one <p> per line instead, sharing #art-bio's styling either
// way (see art.css).
function bioHTML(h) {
  const cls = h.bioAlert ? ' class="art-bio--alert"' : '';
  if (Array.isArray(h.bio)) {
    return `<div id="art-bio"${cls}>${h.bio.map(line => `<p>${line}</p>`).join('')}</div>`;
  }
  return `<p id="art-bio"${cls}>${h.bio}</p>`;
}

function activeBoxHTML(p) {
  const h = p.header;
  const title = pageDisplayName(p);
  return `
    <div class="nav-box nav-box--active error-window" data-page="${p.id}">
      <div class="error-window-bar">
        <span class="error-window-fname">${p.fname}</span>
        <span class="error-window-code">${p.code}</span>
        <span class="error-window-x">✕</span>
      </div>
      <div class="art-header-body">
        <h1 id="art-title" class="glitch-text" data-text="${title}" tabindex="0">${title}</h1>
        <p id="art-subtitle">${h.subtitle}</p>
        ${bioHTML(h)}
      </div>
    </div>
  `;
}

function alertBoxHTML(p) {
  return `
    <div class="nav-box nav-box--alert virus-alert error-window" role="button" tabindex="0" data-page="${p.id}">
      <div class="error-window-bar">
        <span class="error-window-fname">${p.fname}</span>
        <span class="error-window-code">${p.code}</span>
        <span class="error-window-x">✕</span>
      </div>
      <div class="virus-alert-body">
        <span class="virus-alert-warn">⚠ threat detected</span>
        <span class="virus-alert-msg">${pageDisplayName(p)} wants to run</span>
      </div>
    </div>
  `;
}

function renderNav() {
  const list = document.getElementById('nav-list');
  if (!list) return;

  list.innerHTML = PAGES
    .map(p => (p.id === currentPage ? activeBoxHTML(p) : alertBoxHTML(p)))
    .join('');

  // Stack-in stagger, top to bottom — see the CSS for why this is safe to
  // replay on every call instead of just the first.
  list.querySelectorAll('.nav-box').forEach((box, i) => {
    box.style.animationDelay = (i * 90) + 'ms';
    box.classList.add('nav-box-stack-in');
  });

  list.querySelectorAll('.nav-box--alert').forEach(el => {
    el.addEventListener('click', () => {
      showPage(el.dataset.page);
      closeNavPopup(); // mobile only — no-op if #nav-toggle isn't present/open
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showPage(el.dataset.page);
        closeNavPopup();
      }
    });
  });
}

// Mobile nav popup — #nav-toggle (hamburger) shows/hides #nav-list
// On desktop #nav-toggle is display:none via CSS, so these calls are inert.

function closeNavPopup() {
  const list = document.getElementById('nav-list');
  const toggle = document.getElementById('nav-toggle');
  if (!list || !toggle) return;
  list.classList.remove('open');
  toggle.setAttribute('aria-expanded', 'false');
}

document.addEventListener('DOMContentLoaded', () => {
  showPage('home');

  const toggle = document.getElementById('nav-toggle');
  const list = document.getElementById('nav-list');
  if (toggle && list) {
    toggle.addEventListener('click', () => {
      const open = list.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }
});
