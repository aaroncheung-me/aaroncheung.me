// Builds the left nav tree for the studies site. Trimmed clone of the main
// portfolio's js/render-lists.js: same folder/page tree shape and the same
// PAGE_REGISTRY-by-id lookup pattern, but with far fewer top-level sections
// (Home, About, whatever studies/data/nav.json defines, Contact) and no
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

// Nav rows read as filenames (spaces -> underscores) -- same convention as
// the main site's [Bracketed]-folder / plain-file rows.
function toNavLabel(name) {
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
    row.innerHTML = `<span class="nav-label">${toNavLabel(node.name ?? node.title)}</span>`;

    row.addEventListener("click", (event) => {
      event.stopPropagation();
      if (typeof goToPage === "function") goToPage(node.id);
    });
    PAGE_REGISTRY.set(node.id, node);

    wrapper.appendChild(row);
  }

  return wrapper;
}

// Folders that should start already expanded, by id.
const DEFAULT_EXPANDED_FOLDERS = new Set(["case-studies"]);

async function renderStudiesTree() {
  PAGE_REGISTRY.clear();

  const homeNode = { type: "page", id: "home", name: "Home" };
  const aboutNode = { type: "page", id: "about", name: "About" };

  const [navData, contactNode] = await Promise.all([
    fetchJsonData("nav").then((j) => j.data),
    buildContactNode(),
  ]);

  const topLevel = [homeNode, aboutNode, ...navData, contactNode];
  NAV_TREE = topLevel;

  const root = document.getElementById("nav-scroll-area");
  root.innerHTML = "";
  topLevel.forEach((node) => {
    const el = renderNode(node);
    el.classList.add("nav-toplevel");
    root.appendChild(el);
  });
}
