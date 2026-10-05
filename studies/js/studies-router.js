// Trimmed clone of the main portfolio's js/tui.js. Keeps the same
// mechanics -- id-keyed PAGE_REGISTRY lookup, breadcrumb built by walking
// live DOM ancestry, text-scramble reveal, mobile detail-view handoff -- but
// drops the File Explorer, Skills package-info renderer, and every embedded
// live-demo script injection branch generic pages used to support. Only
// three ids get bespoke rendering (home/about/contact); everything else is
// renderGenericPage.

const MAIN_CONTENT_SECTION = document
  .getElementById("main-content")
  ?.getElementsByClassName("container-content")[0];

// Captured in initStudiesRouter(), not here -- has to wait until
// renderWorkCards() (js/studies-cards.js) has filled in the "the work" grid,
// since that grid starts empty in index.html's static markup.
let HOME_CONTENT_HTML = "";

let currentPageId = null;
let activeScrambleInterval = null;

function isMobile() {
  return window.innerWidth <= 768;
}

function clearMainContent() {
  if (activeScrambleInterval !== null) {
    clearInterval(activeScrambleInterval);
    activeScrambleInterval = null;
  }
  MAIN_CONTENT_SECTION.innerHTML = "";
  MAIN_CONTENT_SECTION.scrollTo({ top: 0 });
}

function applyTextScramble() {
  if (document.documentElement.getAttribute("data-reduced-motion") === "true") return;

  const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$[]{}|;:,./?";
  const DURATION = 300;
  const FRAME_MS = 35;
  const frames = Math.ceil(DURATION / FRAME_MS);

  const entries = [];
  const walker = document.createTreeWalker(MAIN_CONTENT_SECTION, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      return n.parentElement?.closest("pre") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    },
  });
  let node;
  while ((node = walker.nextNode())) {
    const original = node.textContent;
    if (!original.trim()) continue;
    const unresolved = new Set();
    for (let i = 0; i < original.length; i++) {
      if (original[i].trim()) unresolved.add(i);
    }
    if (unresolved.size === 0) continue;
    entries.push({ node, original, unresolved });
    node.textContent = original.split("").map((ch) =>
      ch.trim() ? CHARS[Math.floor(Math.random() * CHARS.length)] : ch
    ).join("");
  }

  if (entries.length === 0) return;

  const allPositions = [];
  entries.forEach((entry) => {
    entry.unresolved.forEach((idx) => allPositions.push({ entry, idx }));
  });
  for (let i = allPositions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allPositions[i], allPositions[j]] = [allPositions[j], allPositions[i]];
  }

  const resolvePerFrame = Math.ceil(allPositions.length / frames);
  let resolvedCount = 0;

  activeScrambleInterval = setInterval(() => {
    const end = Math.min(resolvedCount + resolvePerFrame, allPositions.length);
    for (let i = resolvedCount; i < end; i++) {
      allPositions[i].entry.unresolved.delete(allPositions[i].idx);
    }
    resolvedCount = end;

    entries.forEach(({ node, original, unresolved }) => {
      node.textContent = original.split("").map((ch, i) => {
        if (!ch.trim()) return ch;
        if (!unresolved.has(i)) return ch;
        return CHARS[Math.floor(Math.random() * CHARS.length)];
      }).join("");
    });

    if (resolvedCount >= allPositions.length) {
      clearInterval(activeScrambleInterval);
      activeScrambleInterval = null;
      entries.forEach(({ node, original }) => { node.textContent = original; });
    }
  }, FRAME_MS);
}

function setFolderExpanded(folderWrapperEl, expanded) {
  folderWrapperEl.classList.toggle("expanded", expanded);
  folderWrapperEl.querySelector(":scope > .nav-folder")?.setAttribute("aria-expanded", String(expanded));
}

// Case-study names can hold entities ("Light &amp; Dark"); the breadcrumb is
// set with textContent, so decode them first.
function decodeEntities(html) {
  const el = document.createElement("span");
  el.innerHTML = html;
  return el.textContent;
}

function expandAncestors(rowEl) {
  let folderNode = rowEl.closest(".nav-folder-node");
  while (folderNode) {
    setFolderExpanded(folderNode, true);
    folderNode = folderNode.parentElement?.closest(".nav-folder-node") ?? null;
  }
}

function renderBreadcrumb(rowEl, pageLabel) {
  const content = document.getElementById("nav-location-content");
  if (!content) return;

  const segments = [];
  let folderNode = rowEl.closest(".nav-folder-node");
  while (folderNode) {
    const label = folderNode.querySelector(":scope > .nav-folder > .nav-label")?.textContent ?? "";
    segments.unshift(label.replace(/^\[|\]$/g, ""));
    folderNode = folderNode.parentElement?.closest(".nav-folder-node") ?? null;
  }
  segments.unshift("studies");
  segments.push(toNavLabel(decodeEntities(pageLabel)));

  content.textContent = segments.join(" / ");
}

async function goToPage(id, { skipRender = false } = {}) {
  const node = PAGE_REGISTRY.get(id);
  if (!node) return;

  if (currentPageId != null) {
    document.querySelector(`.nav-page[data-page-id="${currentPageId}"]`)?.classList.remove("selected-item");
  }
  currentPageId = id;

  const row = document.querySelector(`.nav-page[data-page-id="${id}"]`);
  row?.classList.add("selected-item");
  document.querySelector('.nav-page[aria-current="page"]')?.removeAttribute("aria-current");
  row?.setAttribute("aria-current", "page");
  if (row) {
    expandAncestors(row);
    renderBreadcrumb(row, node.name ?? node.title);
  }

  if (!skipRender) {
    await displayPage(node);
    applyTextScramble();
  }

  // Mirrors js/nav-widget-panel.js's own mobile gate: skip the widget
  // mount work (fetches, intervals) entirely when the panel is hidden.
  if (!isMobile() && typeof renderStudiesWidgets === "function") renderStudiesWidgets();

  if (isMobile()) {
    showMobileDetailView();
  }
}

async function displayPage(node) {
  clearMainContent();
  document.body.classList.toggle("at-home", node.id === "home");

  if (node.id === "home") {
    MAIN_CONTENT_SECTION.innerHTML = HOME_CONTENT_HTML;
    // innerHTML restores the cards' markup but not their click listeners,
    // so rebuild them -- otherwise the tiles go dead after the first visit.
    if (typeof renderWorkCards === "function") renderWorkCards();
    return;
  }

  if (node.id === "about") {
    const { data } = await fetchJsonData("about");
    renderAboutStylePage(data);
    return;
  }

  if (node.id === "contact") {
    renderContactPage(node);
    return;
  }

  renderGenericPage(node);
}

function renderAboutStylePage(data) {
  const outerEl = document.createElement("div");
  outerEl.classList.add("outer-paragraph-container");
  const innerEl = document.createElement("div");
  innerEl.classList.add("inner-paragraph-container", "mt-4");

  data.forEach((d) => {
    const el = document.createElement("div");
    if (d.title != null) {
      const titleElement = document.createElement("h1");
      titleElement.innerHTML = `<span class="text-blue">${d.title}</span>`;
      el.appendChild(titleElement);
    }
    if (d.subtitle != null) {
      const subtitleElement = document.createElement("p");
      subtitleElement.classList.add("about-subtitle");
      subtitleElement.innerHTML = d.subtitle;
      el.appendChild(subtitleElement);
    }
    if (d.summary != null) {
      const summaryElement = document.createElement("p");
      summaryElement.classList.add("entry-summary");
      summaryElement.innerHTML = d.summary;
      el.appendChild(summaryElement);
    }
    d.content.forEach((c) => {
      const ce = document.createElement(c.trim().startsWith("<") ? "div" : "p");
      ce.classList.add("about-paragraph");
      ce.innerHTML = c;
      el.appendChild(ce);
    });
    if (d.closingQuote != null) {
      const closingQuoteElement = document.createElement("p");
      closingQuoteElement.classList.add("entry-quote");
      closingQuoteElement.innerHTML = d.closingQuote;
      el.appendChild(closingQuoteElement);
    }
    innerEl.appendChild(el);
  });

  outerEl.appendChild(innerEl);
  MAIN_CONTENT_SECTION.appendChild(outerEl);
}

// No terminal-form contact widget here (js/contact_form.js was intentionally
// dropped) -- contentBlocks just render as plain paragraphs.
function renderContactPage(node) {
  const outerContainerElement = document.createElement("div");
  outerContainerElement.classList.add("outer-paragraph-container");
  const innerContainerElement = document.createElement("div");
  innerContainerElement.classList.add("inner-paragraph-container", "mt-4");

  const titleEl = document.createElement("h1");
  titleEl.innerHTML = `<span class="text-blue">Contact</span>`;
  innerContainerElement.appendChild(titleEl);

  node.contentBlocks.forEach((d) => {
    const element = document.createElement("div");
    d.content.forEach((contentItem) => {
      const paragraph = document.createElement("p");
      paragraph.innerHTML = contentItem;
      element.appendChild(paragraph);
    });
    innerContainerElement.appendChild(element);
  });

  outerContainerElement.appendChild(innerContainerElement);
  MAIN_CONTENT_SECTION.appendChild(outerContainerElement);
}

// Shared shape for every case-study (or other) leaf page: title-or-name,
// optional date/technologies/summary, a content array, optional images and
// closing quote. The summary renders as the js/studies-cards.js card (title
// + summary + closing quote, same one used in the home page's "the work"
// grid) for each project's primary case-study page, and as a plain
// .entry-summary paragraph for every other generic page (Process Notes,
// Research Index, diagram/figure sub-pages). One embedded-demo marker: a
// content block containing the lofi-sketch-demo panel gets the live Lofi
// Generator mounted onto it (see mountLofiDemo below). Add any future live
// JS widget as another marker branch the same way tui.js does.
function renderGenericPage(node) {
  const outerContainerElement = document.createElement("div");
  outerContainerElement.classList.add("outer-paragraph-container");
  const innerContainerElement = document.createElement("div");
  innerContainerElement.classList.add("inner-paragraph-container", "mt-4");

  const topElement = document.createElement("div");

  const titleText = node.title ?? node.name;
  const titleElement = document.createElement("h1");
  titleElement.innerHTML = titleText != null ? `<span class="text-blue">${titleText}</span>` : null;

  const dateElement = document.createElement("h2");
  dateElement.innerHTML = node.date != null ? `<span class="text-green">${node.date}</span>` : null;

  const technologiesContainerElement = document.createElement("div");
  technologiesContainerElement.classList.add("technologies-row");
  technologiesContainerElement.innerHTML = node.technologies?.join(" ") || null;

  if (titleText != null) topElement.appendChild(titleElement);
  if (node.date != null) topElement.appendChild(dateElement);
  if (node.technologies?.length) topElement.appendChild(technologiesContainerElement);

  const isPrimaryCaseStudy = typeof collectPrimaryCaseStudies === "function"
    && collectPrimaryCaseStudies().some((p) => p.id === node.id);

  if (node.summary != null && isPrimaryCaseStudy) {
    topElement.appendChild(buildCaseStudyCard(node, { linkable: false }));
  } else if (node.summary != null) {
    const summaryElement = document.createElement("p");
    summaryElement.classList.add("entry-summary");
    summaryElement.innerHTML = node.summary;
    topElement.appendChild(summaryElement);
  }

  const imageElements =
    node.images?.map((imagePath) => {
      const imageInnerContainerElement = document.createElement("div");
      imageInnerContainerElement.style.minHeight = "200px";
      imageInnerContainerElement.classList.add("image-inner-container");

      const imageElement = document.createElement("img");
      imageElement.loading = "lazy";
      imageElement.alt = "Case study image";
      imageElement.decoding = "async";
      imageElement.src = `data/images/${imagePath}`;
      imageElement.classList.add("project-image");

      imageInnerContainerElement.appendChild(imageElement);
      return imageInnerContainerElement;
    }) ?? [];

  (node.content ?? []).forEach((c, i) => {
    const element = document.createElement("div");
    element.innerHTML = c.replaceAll("\n", "<br>");
    innerContainerElement.appendChild(element);
    if (c.includes("lofi-sketch-demo")) mountLofiDemo(element.querySelector("#lofi-sketch-demo"));

    if (i < imageElements.length) {
      const imageContainerElement = document.createElement("div");
      imageContainerElement.classList.add("image-container");
      imageContainerElement.appendChild(imageElements[i]);
      innerContainerElement.appendChild(imageContainerElement);
    }
  });

  if (node.closingQuote != null) {
    const closingQuoteElement = document.createElement("p");
    closingQuoteElement.classList.add("entry-quote");
    closingQuoteElement.innerHTML = node.closingQuote;
    innerContainerElement.appendChild(closingQuoteElement);
  }

  innerContainerElement.prepend(topElement);
  outerContainerElement.appendChild(innerContainerElement);
  MAIN_CONTENT_SECTION.appendChild(outerContainerElement);
}

// Same mount the main site's Projects page does (js/tui.js), but through
// js/lofi-player.js's loadLofiSketchAssets() so the samples/engine scripts
// are shared with the footer toggle and sidebar widget, never loaded twice.
// Loading the engine doesn't start audio -- that still waits for a click.
// Subscribing here (not just in lofiEnsureStarted) is what keeps the footer
// toggle and sidebar widget in sync when the panel's own Play button is the
// one that starts playback.
function mountLofiDemo(container) {
  if (!container || typeof loadLofiSketchAssets !== "function") return;
  loadLofiSketchAssets(() => {
    if (!document.body.contains(container) || !window.LofiSketch) return;
    if (typeof subscribeLofiStateChanges === "function") subscribeLofiStateChanges();
    window.LofiSketch.mount(container);
    if (typeof initLofiPanelControls === "function") initLofiPanelControls(container);
  });
}

function applyDefaultExpandedFolders() {
  document.querySelectorAll("#nav-scroll-area .nav-folder-node").forEach((el) => {
    if (DEFAULT_EXPANDED_FOLDERS.has(el.dataset.nodeId)) setFolderExpanded(el, true);
  });
}

async function initStudiesRouter() {
  if (typeof renderWorkCards === "function") renderWorkCards();
  HOME_CONTENT_HTML = MAIN_CONTENT_SECTION?.innerHTML ?? "";

  applyDefaultExpandedFolders();
  initMobileNav();
  await goToPage("home", { skipRender: true });
}
