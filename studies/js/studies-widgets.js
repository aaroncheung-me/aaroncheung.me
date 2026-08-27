// Sidebar widget bar for the studies site -- replaces the main portfolio's
// js/nav-widget-panel.js (Lofi/Theme/Site-Status rotator) with three
// academic-framing widgets: a case-study reading-progress navigator, a
// rotating research-citations panel, and a one-line "currently exploring"
// note. Same rotator shell (prev/next arrows over a swappable frame) as the
// original, reused verbatim; only the widget list and each mount() differ.

// Every page node except home/about/contact, in nav-tree document order --
// deliberately not keyed to a "case-studies" folder id, so this keeps working
// whether a case study lives inside a folder or as a bare top-level page (see
// studies/data/nav.json's comment on both patterns).
function collectCaseStudyPages() {
  const pages = [];
  function walk(node) {
    if (node.type === "folder") {
      node.children.forEach(walk);
    } else if (!["home", "about", "contact"].includes(node.id)) {
      pages.push(node);
    }
  }
  (typeof NAV_TREE !== "undefined" ? NAV_TREE : []).forEach(walk);
  return pages;
}

let _citationsCache = null;
async function getCitations() {
  if (_citationsCache) return _citationsCache;
  const res = await fetch("data/citations.json");
  const { citations } = await res.json();
  _citationsCache = citations ?? [];
  return _citationsCache;
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

      const idx = Math.max(0, pages.findIndex((p) => p.id === (typeof currentPageId !== "undefined" ? currentPageId : null)));
      const current = pages[idx] ?? pages[0];
      const pct = ((idx + 1) / pages.length) * 100;

      frame.innerHTML = `
        <div class="studies-casenav-progress">
          <div class="studies-casenav-track"><div class="studies-casenav-fill" style="width:${pct}%"></div></div>
          <span class="studies-casenav-count">${idx + 1} / ${pages.length}</span>
        </div>
        <div class="studies-casenav-current">
          <button type="button" class="studies-casenav-arrow" id="studies-casenav-prev" aria-label="Previous case study">&lsaquo;</button>
          <span class="studies-casenav-title">${current.title ?? current.name}</span>
          <button type="button" class="studies-casenav-arrow" id="studies-casenav-next" aria-label="Next case study">&rsaquo;</button>
        </div>
      `;

      frame.querySelector("#studies-casenav-prev")?.addEventListener("click", () => {
        const prev = pages[(idx - 1 + pages.length) % pages.length];
        goToPage(prev.id);
      });
      frame.querySelector("#studies-casenav-next")?.addEventListener("click", () => {
        const next = pages[(idx + 1) % pages.length];
        goToPage(next.id);
      });
    },
  },
  {
    id: "citations",
    label: "Citations",
    caption: "sources referenced across case studies",
    frameClass: "studies-widget-citations-frame",
    async mount(frame) {
      const citations = await getCitations();
      if (!document.body.contains(frame)) return; // panel switched away mid-fetch
      if (citations.length === 0) {
        frame.innerHTML = `<p class="studies-widget-empty">No citations yet.</p>`;
        return;
      }

      let i = 0;
      const render = () => {
        const c = citations[i];
        frame.innerHTML = `
          <p class="studies-citation-text">${c.text}</p>
          <p class="studies-citation-note">${c.note ?? ""}</p>
        `;
      };
      render();

      const interval = setInterval(() => {
        if (!document.body.contains(frame)) { clearInterval(interval); return; }
        i = (i + 1) % citations.length;
        render();
      }, 6000);
    },
  },
  {
    id: "exploring",
    label: "Currently Exploring",
    caption: "what I'm reading/researching right now",
    frameClass: "studies-widget-exploring-frame",
    async mount(frame) {
      const res = await fetch("data/currently-exploring.json");
      const { text } = await res.json();
      if (!document.body.contains(frame)) return;
      frame.innerHTML = `<p class="studies-exploring-text">${text}</p>`;
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
