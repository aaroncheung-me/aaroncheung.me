// Builds the entire left nav as one VS Code-style folder/page tree.
// Each JSON data file (experience/projects/ui-elements/skills) supplies one
// top-level folder's children -- "Me" and "Contact Info" are hardcoded here
// since they aren't backed by their own folder-shaped JSON file. Every page
// (leaf) node gets registered in PAGE_REGISTRY, keyed by its stable `id`, so
// js/tui.js's goToPage(id) can look up its data and DOM row without needing
// positional (section, item) indices.
//
// Click handlers are wired up here, at render time, even though js/tui.js
// (which defines goToPage/setFolderExpanded) hasn't loaded yet -- loader.js
// only injects tui.js after this function resolves. That's fine: the
// listeners below are closures that look up goToPage/setFolderExpanded at
// *click* time, not at attach time, and tui.js is long loaded before a user
// can click anything.

const PAGE_REGISTRY = new Map(); // id -> { node, topSection }

// The same merged tree renderAllLists() builds for the nav rows, kept around
// so js/tui.js's File Explorer page (a second view over the same data, see
// renderExplorerPage) doesn't need to re-fetch or re-merge anything.
let NAV_TREE = [];

async function fetchTreeData(jsonFile) {
  const response = await fetch(`data/${jsonFile}.json`);
  const { data } = await response.json();
  return data;
}

// Contact's JSON isn't tree-shaped (just an array of paragraph blocks, each
// rendered as its own wrapping div) -- keep that shape as-is under one page
// node instead of flattening it.
async function buildContactNode() {
  const response = await fetch("data/contact.json");
  const { data } = await response.json();
  return { type: "page", id: "contact", name: "Contact Info", contentBlocks: data };
}

// _parentFolderName is the immediate containing folder's name (not the
// top-level section) -- currently only used by js/tui.js's renderSkillPage
// to title a skill page after its category (e.g. "Languages"), since a
// skill node has no title of its own.
function tagTopSection(node, topSection, parentFolderName = null) {
  node._topSection = topSection;
  node._parentFolderName = parentFolderName;
  if (node.type === "folder") {
    node.children.forEach((child) => tagTopSection(child, topSection, node.name));
  }
}

// Nav rows read as filenames (spaces -> underscores), even though the
// underlying node.name/title stays normal English -- that data is also used
// as the page's own heading once you click in, which should keep reading
// naturally. " / " specifically becomes "-" rather than "_/_" (no folder
// name currently has one, but a future "Foo / Bar" would render
// "Foo-Bar"); a bare "/" with no spaces around it (e.g. "UI/UX") is left
// alone since it isn't the same separator.
const NAV_LABEL_OVERRIDES = {};

function toNavLabel(name) {
  if (NAV_LABEL_OVERRIDES[name]) return NAV_LABEL_OVERRIDES[name];
  return name.replace(/ \/ /g, "-").replace(/ /g, "_");
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
    // Brackets are the folder/page differentiator -- reuses the site's own
    // existing [Bracketed] convention (home page tiles, footer links) rather
    // than inventing a new one. The caret is a hand-placed SVG path (see
    // css/tui.css for why), symmetric within its own square viewBox by
    // construction -- collapsed/expanded rotation is driven entirely by the
    // .expanded class rotating this whole (already-centered) shape.
    row.innerHTML = `<svg class="nav-caret" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4 L10 8 L6 12" /></svg><span class="nav-label">[${toNavLabel(node.name)}]</span>`;
    row.addEventListener("click", (event) => {
      event.stopPropagation();
      const expanded = !wrapper.classList.contains("expanded");
      if (typeof setFolderExpanded === "function") setFolderExpanded(wrapper, expanded);
    });

    const childrenEl = document.createElement("div");
    childrenEl.classList.add("nav-children");
    node.children.forEach((child) => childrenEl.appendChild(renderNode(child)));

    wrapper.append(row, childrenEl);
  } else {
    wrapper.classList.add("nav-page-node");

    const row = document.createElement("div");
    row.classList.add("nav-page");
    row.dataset.pageId = node.id;
    // Plain, unbracketed text -- the contrast with a folder's [Brackets] is
    // the differentiator, not a second marker on pages too.
    row.innerHTML = `<span class="nav-label">${toNavLabel(node.name ?? node.title)}</span>`;

    if (node.href) {
      // A real external file (resume.pdf) rather than in-site content --
      // opens like double-clicking a file in a real explorer would, and
      // isn't part of PAGE_REGISTRY since there's no in-site page to jump to.
      row.addEventListener("click", (event) => {
        event.stopPropagation();
        window.open(node.href, "_blank");
      });
    } else {
      row.addEventListener("click", (event) => {
        event.stopPropagation();
        if (typeof goToPage === "function") goToPage(node.id);
      });
      PAGE_REGISTRY.set(node.id, { node, topSection: node._topSection });
    }

    wrapper.appendChild(row);
  }

  return wrapper;
}

// Folders that should start already expanded, by id -- empty means every
// folder starts collapsed on a fresh load, no exceptions.
const DEFAULT_EXPANDED_FOLDERS = new Set();

const README_NODE = {
  type: "page", id: "readme", name: "README.md",
  title: "README.md",
  content: [
    "A software engineering portfolio, laid out like a file tree instead of a scroll. This file is the map — for how the site itself is built, see <span class=\"text-blue\">Coding Projects/Websites/aaroncheung.me</span>.",
    "<h2>Navigation</h2>",
    "The left column is a real folder tree. <span class=\"text-purple\">[Bracketed]</span> rows are folders — click to expand, they never change the page. Plain rows are files — click to open them.",
    "The box above the tree is a breadcrumb. Click it to open the <span class=\"text-blue\">File Explorer</span>, a small typed-command shell over this same tree:",
    "<pre>$ ls\n$ cd &lt;folder&gt;\n$ cat &lt;file&gt;</pre>",
    "Typos and loose names get fuzzy-corrected, so close enough works. On a keyboard, <span class=\"text-green\">Ctrl+K</span> opens a <span class=\"text-blue\">fuzzy-search command palette</span> that jumps straight to any page.",
    "<h2>What's here</h2>",
    "<pre>Experience & Education    background, work history, schooling (TL;DR up top)\nCoding Projects           live, playable demos -- not screenshots\nUI Elements               the site's own interactive pieces, explained\nSkills & Tools            languages, frameworks, tools, one page each\nContact Info              how to reach me</pre>",
  ]
};

const RESUME_NODE = {
  type: "page", id: "resume-pdf", name: "resume.pdf",
  title: "resume.pdf",
  content: [
    "<div class='resume-viewer'><iframe src='/aaron_cheung_resume.pdf' class='resume-frame' title='Aaron Cheung resume PDF'></iframe></div>",
    "Prefer it in its own tab? <a href='/aaron_cheung_resume.pdf' target='_blank' class='text-purple'>Open resume.pdf</a>.",
  ]
};

async function renderAllLists() {
  PAGE_REGISTRY.clear();

  const homeNode = { type: "page", id: "home", name: "Home" };
  const aboutNode = { type: "page", id: "about", name: "About Me" };

  const [experienceData, projectsData, uiElementsData, skillsData, contactNode] = await Promise.all([
    fetchTreeData("experience"),
    fetchTreeData("projects"),
    fetchTreeData("ui-elements"),
    fetchTreeData("skills"),
    buildContactNode(),
  ]);

  // About lives one level in now, right under TL;DR -- Experience/Education
  // is the "about the person" folder, so About belongs alongside it rather
  // than sitting at root.
  experienceData.splice(1, 0, aboutNode);

  const topLevel = [
    homeNode,
    contactNode,
    README_NODE,
    { type: "folder", id: "experience", name: "Experience & Education", children: experienceData },
    { type: "folder", id: "projects", name: "Coding Projects", children: projectsData },
    { type: "folder", id: "ui-elements", name: "UI Elements", children: uiElementsData },
    { type: "folder", id: "skills", name: "Skills & Tools", children: skillsData },
    RESUME_NODE,
  ];

  topLevel.forEach((node) => tagTopSection(node, node.id));
  NAV_TREE = topLevel;

  const root = document.getElementById("nav-scroll-area");
  root.innerHTML = "";
  topLevel.forEach((node) => {
    const el = renderNode(node);
    el.classList.add("nav-toplevel");
    root.appendChild(el);
  });

  // Not a nav row (only reachable by clicking the breadcrumb box), but still
  // a real addressable page so goToPage('explorer') works the same as any
  // other id.
  PAGE_REGISTRY.set("explorer", { node: { type: "page", id: "explorer", name: "File Explorer" }, topSection: "explorer" });
}
