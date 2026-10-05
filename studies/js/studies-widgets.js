// Sidebar widget bar for the studies site -- replaces the main portfolio's
// js/nav-widget-panel.js (Lofi/Theme/Site-Status rotator) with two widgets:
// a case-study reading-progress navigator, and the same live Lofi Generator
// widget the main site's panel has. Same rotator shell (prev/next arrows
// over a swappable frame) as the original, reused verbatim; only the widget
// list and each mount() differ.

// Case studies and their direct supporting docs (e.g. Process Notes,
// Research Index) -- one level deep only, so nested sub-folders like
// Diagrams/Visual Reference are deliberately skipped. Not keyed to a
// particular folder id, so this keeps working whether a case study
// lives inside a folder or as a bare top-level page.
function collectCaseStudyPages() {
  const pages = [];
  (typeof NAV_TREE !== "undefined" ? NAV_TREE : []).forEach((node) => {
    if (NON_CASE_STUDY_IDS.includes(node.id)) return;
    if (node.type === "folder") {
      node.children.forEach((child) => {
        if (child.type === "page") pages.push(child);
      });
    } else {
      pages.push(node);
    }
  });
  return pages;
}

const STUDIES_WIDGETS = [
  {
    id: "case-nav",
    label: "Case Study Nav",
    caption: "jump between case studies",
    frameClass: "studies-widget-casenav-frame",
    mount(frame) {
      const pages = collectCaseStudyPages();
      if (pages.length === 0) {
        frame.innerHTML = `<p class="studies-widget-empty">No case studies yet.</p>`;
        return;
      }

      const rawIdx = pages.findIndex((p) => p.id === (typeof currentPageId !== "undefined" ? currentPageId : null));
      const onCaseStudy = rawIdx !== -1;
      const count = onCaseStudy ? rawIdx + 1 : 0;
      const pct = onCaseStudy ? (count / pages.length) * 100 : 0;
      const currentTitle = onCaseStudy
        ? (pages[rawIdx].title ?? pages[rawIdx].name)
        : `<span class="studies-casenav-hint">&rsaquo; to start reading</span>`;

      frame.innerHTML = `
        <div class="studies-casenav-progress">
          <div class="studies-casenav-track"><div class="studies-casenav-fill" style="width:${pct}%"></div></div>
          <span class="studies-casenav-count">${count} / ${pages.length}</span>
        </div>
        <div class="studies-casenav-current">
          <button type="button" class="studies-casenav-arrow" id="studies-casenav-prev" aria-label="Previous case study">&lsaquo;</button>
          <span class="studies-casenav-title">${currentTitle}</span>
          <button type="button" class="studies-casenav-arrow" id="studies-casenav-next" aria-label="Next case study">&rsaquo;</button>
        </div>
      `;

      // Off a case study entirely (0 / N): next jumps to the first one and
      // prev wraps to the last one, rather than treating "nowhere" as if it
      // were already page 0 (that's what caused next to skip straight to
      // page 2).
      frame.querySelector("#studies-casenav-prev")?.addEventListener("click", () => {
        const prevIdx = onCaseStudy ? (rawIdx - 1 + pages.length) % pages.length : pages.length - 1;
        goToPage(pages[prevIdx].id);
      });
      frame.querySelector("#studies-casenav-next")?.addEventListener("click", () => {
        const nextIdx = onCaseStudy ? (rawIdx + 1) % pages.length : 0;
        goToPage(pages[nextIdx].id);
      });
    },
  },
  {
    id: "lofi-demo",
    label: "Lofi Generator",
    caption: "reacts while it's playing",
    frameClass: "tile-lofi-frame",
    mount(frame) {
      // Same as js/nav-widget-panel.js's lofi widget: the shared
      // nav-widget-lofi-play-btn id is what js/lofi-player.js's
      // syncLofiButton() keeps in sync (play/pause glyph), and
      // initTileLofi() (js/home-tiles.js) draws the live scope.
      const playBtn = document.createElement("button");
      playBtn.id = "nav-widget-lofi-play-btn";
      playBtn.type = "button";
      playBtn.className = "footer-tray-btn tile-lofi-play-btn";
      playBtn.setAttribute("aria-label", "Play Lofi Generator, plays across the whole site");
      playBtn.textContent = "▶";
      playBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        setLofiPlaying(!getLofiPlaying());
      });
      frame.appendChild(playBtn);
      initTileLofi(frame);
      syncLofiButton();
    },
  },
];

let studiesWidgetIndex = 0;

function renderStudiesWidgets() {
  const content = document.getElementById("nav-widget-content");
  if (!content) return;
  const widget = STUDIES_WIDGETS[studiesWidgetIndex];

  content.innerHTML = `
    <div class="nav-widget-header">
      <button type="button" class="nav-widget-arrow" id="nav-widget-prev" aria-label="Previous widget">&lsaquo;</button>
      <span class="nav-widget-title">[${widget.label.replace(/ /g, "_")}]</span>
      <button type="button" class="nav-widget-arrow" id="nav-widget-next" aria-label="Next widget">&rsaquo;</button>
    </div>
    <div class="live-tile-frame ${widget.frameClass}" id="nav-widget-frame"></div>
    <p class="nav-widget-caption live-tile-caption">${widget.caption}</p>
  `;

  document.getElementById("nav-widget-prev").addEventListener("click", () => {
    studiesWidgetIndex = (studiesWidgetIndex - 1 + STUDIES_WIDGETS.length) % STUDIES_WIDGETS.length;
    renderStudiesWidgets();
  });
  document.getElementById("nav-widget-next").addEventListener("click", () => {
    studiesWidgetIndex = (studiesWidgetIndex + 1) % STUDIES_WIDGETS.length;
    renderStudiesWidgets();
  });

  widget.mount(document.getElementById("nav-widget-frame"));
}

// goToPage() skips the widget on mobile (the panel is hidden there), so a
// page loaded narrow and then widened -- a rotated tablet, a resized
// window -- would otherwise show an empty panel until the next click.
// 768px matches isMobile() in js/studies-router.js.
window.matchMedia("(min-width: 769px)").addEventListener("change", (event) => {
  if (event.matches) renderStudiesWidgets();
});
