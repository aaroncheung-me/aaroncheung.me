// Builds the left nav tree for the studies site. Trimmed clone of the main
// portfolio's js/render-lists.js: same folder/page tree shape and the same
// PAGE_REGISTRY-by-id lookup pattern, but with far fewer top-level sections
// (Home, About, Contact, the case studies in data/case-studies/, Resume) and no
// skills/explorer-specific plumbing.

const PAGE_REGISTRY = new Map(); // id -> node
let NAV_TREE = [];

async function fetchJsonData(file) {
  const response = await fetch(`data/${file}.json`);
  return response.json();
}

async function buildContactNode() {
  const { data } = await fetchJsonData("contact");
  return { type: "page", id: "contact", name: "Contact", contentBlocks: data };
}

// data/nav.json is just the order; each case study's folder node lives in
// its own data/case-studies/<id>.json. Fetched in parallel.
async function fetchCaseStudies() {
  const { data: order } = await fetchJsonData("nav");
  return Promise.all(order.map((id) => fetchJsonData(`case-studies/${id}`)));
}

// Nav rows read as filenames (spaces -> underscores) -- same convention as
// the main site's [Bracketed]-folder / plain-file rows.
function toNavLabel(name) {
  return name.replace(/ \/ /g, "-").replace(/ /g, "_");
}

// Nav rows are divs (tui.css styles them that way on every site), so this
// gives them what a <button> would: a tab stop, a role, and Enter/Space.
// Rows inside a collapsed folder are display:none, so Tab skips them.
function makeRowKeyboardOperable(row, onActivate) {
  row.tabIndex = 0;
  row.setAttribute("role", "button");
  row.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onActivate(event);
  });
}

function renderNode(node) {
  const wrapper = document.createElement("div");
  wrapper.classList.add("nav-node");
  wrapper.dataset.nodeId = node.id;

  if (node.type === "folder") {
    wrapper.classList.add("nav-folder-node");

    const row = document.createElement("div");
    row.classList.add("nav-folder");
    row.dataset.nodeId = node.id;
    row.innerHTML = `<svg class="nav-caret" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4 L10 8 L6 12" /></svg><span class="nav-label">[${toNavLabel(node.name)}]</span>`;
    const toggleFolder = (event) => {
      event.stopPropagation();
      const expanded = !wrapper.classList.contains("expanded");
      if (typeof setFolderExpanded === "function") setFolderExpanded(wrapper, expanded);
    };
    row.addEventListener("click", toggleFolder);
    makeRowKeyboardOperable(row, toggleFolder);
    row.setAttribute("aria-expanded", "false");

    const childrenEl = document.createElement("div");
    childrenEl.classList.add("nav-children");
    node.children.forEach((child) => childrenEl.appendChild(renderNode(child)));

    wrapper.append(row, childrenEl);
  } else {
    wrapper.classList.add("nav-page-node");

    const row = document.createElement("div");
    row.classList.add("nav-page");
    row.dataset.pageId = node.id;
    row.innerHTML = `<span class="nav-label">${toNavLabel(node.name ?? node.title)}</span>`;

    const openPage = (event) => {
      event.stopPropagation();
      if (typeof goToPage === "function") goToPage(node.id);
    };
    row.addEventListener("click", openPage);
    makeRowKeyboardOperable(row, openPage);
    PAGE_REGISTRY.set(node.id, node);

    wrapper.appendChild(row);
  }

  return wrapper;
}

// Same viewer as the main site's resume.pdf page (js/render-lists.js's
// RESUME_NODE), rendered through the generic page renderer.
const RESUME_NODE = {
  type: "page", id: "resume", name: "Resume",
  title: "Resume",
  content: [
    "<div class='resume-viewer'><iframe src='/aaron_cheung_resume.pdf' class='resume-frame' title='Aaron Cheung resume PDF'></iframe></div>",
    "Prefer it in its own tab? <a href='/aaron_cheung_resume.pdf' target='_blank' rel='noopener' class='text-purple'>Open the PDF</a>.",
  ],
};

// Top-level pages that aren't case studies -- skipped by the case-study
// collectors in js/studies-cards.js and js/studies-widgets.js.
const NON_CASE_STUDY_IDS = ["home", "about", "contact", "resume"];

// Folders that should start already expanded, by id.
const DEFAULT_EXPANDED_FOLDERS = new Set();

async function renderStudiesTree() {
  PAGE_REGISTRY.clear();

  const homeNode = { type: "page", id: "home", name: "Home" };
  const aboutNode = { type: "page", id: "about", name: "About" };

  const [navData, contactNode] = await Promise.all([
    fetchCaseStudies(),
    buildContactNode(),
  ]);

  const topLevel = [homeNode, aboutNode, contactNode, ...navData, RESUME_NODE];
  NAV_TREE = topLevel;

  const root = document.getElementById("nav-scroll-area");
  root.innerHTML = "";
  topLevel.forEach((node) => {
    const el = renderNode(node);
    el.classList.add("nav-toplevel");
    root.appendChild(el);
  });
}
