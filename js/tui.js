const MAIN_CONTENT_SECTION = document
  .getElementById("main-content")
  ?.getElementsByClassName("container-content")[0];

const HOME_CONTENT_HTML = MAIN_CONTENT_SECTION?.innerHTML ?? "";

const IS_EMBEDDED_PREVIEW = new URLSearchParams(window.location.search).get("embed") === "1";

// PAGE_REGISTRY (id -> { node, topSection }) is built by js/render-lists.js's
// renderAllLists(), which runs (and completes) before this file is even
// loaded -- see js/loader/loader.js.

let currentPageId = null;
let activeScrambleInterval = null;

// File Explorer's own drill-down path, independent of the nav tree's
// expand/collapse state -- an array of folder nodes from NAV_TREE (see
// js/render-lists.js), root first. Reset to [] every time the page is
// (re)opened via goToPage('explorer'), e.g. re-clicking the breadcrumb box.
let explorerPath = [];

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
  // Skips <pre> content (ASCII renders like the logo/ascii-converter output)
  // -- they run their own reveal animation, and can be thousands of
  // characters, adding real per-frame cost on top of scripts already
  // starting up on the home page.
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

// Folder expand/collapse -- toggling never touches currentPageId or renders
// anything into #main-content. The caret's rotation is pure CSS, driven off
// this .expanded class (css/tui.css), so there's no glyph to swap here.
function setFolderExpanded(folderWrapperEl, expanded) {
  folderWrapperEl.classList.toggle("expanded", expanded);
}

// Walks up from a page's nav row, expanding every ancestor folder so a
// programmatic jump (click, command palette, a skill's used-in link, a home
// tile) always leaves its target visible in the nav, regardless of what was
// collapsed before.
function expandAncestors(rowEl) {
  let folderNode = rowEl.closest(".nav-folder-node");
  while (folderNode) {
    setFolderExpanded(folderNode, true);
    folderNode = folderNode.parentElement?.closest(".nav-folder-node") ?? null;
  }
}

// Walks the same ancestor chain as expandAncestors(), but to collect folder
// *names* (stripping the "[brackets]" js/render-lists.js wraps them in)
// instead of expanding them, building "portfolio / UI Elements / Theme
// Switcher / Font" for whatever page is currently open.
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
  segments.unshift("portfolio");
  segments.push(toNavLabel(pageLabel));

  content.textContent = segments.join(" / ");
}

// Fallback for pages with no nav row to walk ancestors from -- currently
// just File Explorer, which is only reachable via the breadcrumb box itself.
function renderRootBreadcrumb(pageLabel) {
  const content = document.getElementById("nav-location-content");
  if (!content) return;
  content.textContent = `portfolio / ${toNavLabel(pageLabel)}`;
}

async function goToPage(id, { skipRender = false } = {}) {
  const entry = PAGE_REGISTRY.get(id);
  if (!entry) return;

  if (currentPageId != null) {
    document.querySelector(`.nav-page[data-page-id="${currentPageId}"]`)?.classList.remove("selected-item");
  }
  currentPageId = id;

  const row = document.querySelector(`.nav-page[data-page-id="${id}"]`);
  row?.classList.add("selected-item");
  if (row) {
    expandAncestors(row);
    renderBreadcrumb(row, entry.node.name ?? entry.node.title);
  } else {
    renderRootBreadcrumb(entry.node.name ?? entry.node.title);
  }

  if (!skipRender) {
    await displayPage(entry.node, entry.topSection);
    applyTextScramble();
  }

  if (isMobile()) {
    showMobileDetailView();
  }
}

async function displayPage(node, topSection) {
  clearMainContent();
  document.body.classList.toggle("at-home", node.id === "home");

  if (node.id === "home") {
    MAIN_CONTENT_SECTION.innerHTML = HOME_CONTENT_HTML;
    if (typeof window.initAsciiLogo === "function") window.initAsciiLogo();
    if (typeof window.setupHomeTiles === "function") window.setupHomeTiles();
    return;
  }

  if (node.id === "about") {
    const response = await fetch("data/about.json");
    const { data } = await response.json();
    renderAboutStylePage(data);
    return;
  }

  if (node.id === "explorer") {
    explorerPath = [];
    renderExplorerPage();
    return;
  }

  if (topSection === "contact") {
    renderContactPage(node);
    return;
  }

  if (topSection === "skills") {
    renderSkillPage(node);
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

function renderContactPage(node) {
  const logoContainer = document.createElement("div");
  logoContainer.id = "logo-container";
  const logoElement = document.createElement("img");
  logoElement.loading = "eager";
  logoElement.src = "data/images/logo_home.png";
  logoElement.id = "logo";
  logoElement.alt = "Aaron C.";
  logoContainer.appendChild(logoElement);
  MAIN_CONTENT_SECTION.appendChild(logoContainer);

  const outerContainerElement = document.createElement("div");
  outerContainerElement.classList.add("outer-paragraph-container");
  const innerContainerElement = document.createElement("div");
  innerContainerElement.classList.add("inner-paragraph-container");

  node.contentBlocks.forEach((d) => {
    const element = document.createElement("div");
    d.content.forEach((contentItem) => {
      if (contentItem.trim().startsWith("<") && contentItem.includes("terminal-container")) {
        const terminalFormContainer = document.createElement("div");
        terminalFormContainer.classList.add("terminal-form-wrapper");
        terminalFormContainer.innerHTML = contentItem;
        element.appendChild(terminalFormContainer);
      } else {
        const paragraph = document.createElement("p");
        paragraph.innerHTML = contentItem;
        element.appendChild(paragraph);
      }
    });
    innerContainerElement.appendChild(element);
  });

  outerContainerElement.appendChild(innerContainerElement);
  MAIN_CONTENT_SECTION.appendChild(outerContainerElement);

  if (document.getElementById("terminal-container")) {
    setTimeout(() => {
      if (typeof initTerminalForm === "function") initTerminalForm();
    }, 100);
  }
}

// A typed-command shell over the exact same tree the nav renders (NAV_TREE,
// built once by js/render-lists.js's renderAllLists()) -- a second view of
// the same data, not a copy of it. `cd`/`ls` just move a pointer through
// NAV_TREE; `cat`/`open` on a real in-site page hands off to the same
// goToPage(id) every nav row and command-palette result already uses, and on
// a real external file (resume.pdf) opens it in a new tab exactly like
// clicking it in the nav would.
const EXPLORER_HELP_LINES = [
  "ls [path]      list directory contents",
  "cd [path]      change directory ( .. up, ~ or / root )",
  "cat <file>     open a file (alias: open)",
  "pwd            print working directory",
  "clear          clear the screen",
  "help           show this message",
];

function explorerLabel(node) {
  return toNavLabel(node.name ?? node.title);
}

function explorerPromptPath() {
  return explorerPath.length === 0 ? "~" : "~/" + explorerPath.map(explorerLabel).join("/");
}

// Same fuzzyScore js/command-palette.js uses for Ctrl+K, just normalized
// against separators first -- "experience educatio" wouldn't otherwise be a
// subsequence of "Experience-Education" (the space never matches the dash),
// but with underscores/dashes/spaces/brackets stripped from both sides
// first it's a same-order (near-)prefix match, which scores easily.
function explorerNormalizeForMatch(str) {
  return str.toLowerCase().replace(/[\[\]_\-\s]/g, "");
}

// Classic edit-distance DP. fuzzyScore (subsequence-based) can't handle a
// transposition like "educaiton" vs "education" -- the 't'/'i' swap breaks
// the strict left-to-right order it requires, even though a human reads
// that as one obvious typo. This is the fallback for exactly that case.
function levenshteinDistance(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// Exact (case-insensitive, bracket-tolerant) match first; then the same
// subsequence fuzzyScore Ctrl+K uses (handles abbreviations/missing
// letters, e.g. "experience educatio"); then an edit-distance fallback for
// typos that break subsequence order, like a transposition ("educaiton").
// `corrected` tells the caller this wasn't a literal match, so it can echo
// back what it assumed instead of silently guessing.
function explorerFindChild(children, segRaw) {
  const clean = segRaw.replace(/^\[|\]$/g, "");
  const exact = children.find((n) => explorerLabel(n).toLowerCase() === clean.toLowerCase());
  if (exact) return { match: exact, corrected: false };

  const query = explorerNormalizeForMatch(clean);
  if (!query) return { match: null, corrected: false };

  let best = null;
  let bestScore = -Infinity;
  children.forEach((n) => {
    const score = fuzzyScore(query, explorerNormalizeForMatch(explorerLabel(n)));
    if (isFinite(score) && score > bestScore) {
      bestScore = score;
      best = n;
    }
  });
  if (best) return { match: best, corrected: true };

  let bestNode = null;
  let bestDist = Infinity;
  let bestTargetLen = 0;
  children.forEach((n) => {
    const target = explorerNormalizeForMatch(explorerLabel(n));
    const dist = levenshteinDistance(query, target);
    if (dist < bestDist) {
      bestDist = dist;
      bestNode = n;
      bestTargetLen = target.length;
    }
  });
  const threshold = Math.max(2, Math.ceil(Math.max(query.length, bestTargetLen) * 0.3));
  if (bestNode && bestDist <= threshold) return { match: bestNode, corrected: true };

  return { match: null, corrected: false };
}

function explorerCorrectionNote(corrections) {
  if (!corrections || corrections.length === 0) return null;
  const el = document.createElement("div");
  el.classList.add("explorer-line", "explorer-output-text", "explorer-correction");
  el.textContent = corrections.map((c) => `(assuming '${c.typed}' means '${c.resolved}')`).join("\n");
  return el;
}

// Walks `argRaw` (a `/`-separated relative or absolute path, possibly with
// `.`/`..`/`~` segments) from the current explorerPath -- shared by cd
// (which commits the result) and ls (which only peeks at it). Collects
// every non-exact segment match along the way so the caller can report
// what it assumed.
function explorerResolvePath(argRaw) {
  const arg = (argRaw ?? "").trim();
  if (arg === "" || arg === "~") return { path: explorerPath, corrections: [] };
  if (arg === "/") return { path: [], corrections: [] };

  let path = arg.startsWith("/") ? [] : [...explorerPath];
  const corrections = [];
  const segments = arg.split("/").filter((s) => s.length > 0 && s !== "~");
  for (const segRaw of segments) {
    if (segRaw === ".") continue;
    if (segRaw === "..") { path = path.slice(0, -1); continue; }
    const children = path.length === 0 ? NAV_TREE : path[path.length - 1].children;
    const { match, corrected } = explorerFindChild(children, segRaw);
    if (!match) return { error: `${segRaw}: No such file or directory` };
    if (match.type !== "folder") return { error: `${segRaw}: Not a directory` };
    if (corrected) corrections.push({ typed: segRaw, resolved: explorerLabel(match) });
    path.push(match);
  }
  return { path, corrections };
}

function explorerRunLs(argRaw) {
  let targetPath = explorerPath;
  let corrections = [];
  if (argRaw && argRaw.trim()) {
    const result = explorerResolvePath(argRaw);
    if (result.error) return `ls: cannot access '${argRaw.trim()}': ${result.error}`;
    targetPath = result.path;
    corrections = result.corrections;
  }
  const children = targetPath.length === 0 ? NAV_TREE : targetPath[targetPath.length - 1].children;
  const noteEl = explorerCorrectionNote(corrections);
  if (children.length === 0) return noteEl;

  const listingEl = document.createElement("div");
  listingEl.classList.add("explorer-line", "explorer-listing");
  children.forEach((node) => {
    const entryEl = document.createElement("span");
    entryEl.classList.add("explorer-entry");
    if (node.type === "folder") {
      entryEl.classList.add("explorer-entry-folder");
      entryEl.textContent = `[${explorerLabel(node)}]`;
    } else {
      entryEl.textContent = explorerLabel(node);
    }
    listingEl.appendChild(entryEl);
  });
  return noteEl ? [noteEl, listingEl] : listingEl;
}

function explorerRunCd(argRaw) {
  const result = explorerResolvePath(argRaw);
  if (result.error) return `bash: cd: ${result.error}`;
  explorerPath = result.path;
  return explorerCorrectionNote(result.corrections);
}

function explorerRunOpen(argRaw, cmdName) {
  const arg = (argRaw ?? "").trim();
  if (!arg) return `usage: ${cmdName} <file>`;
  const children = explorerPath.length === 0 ? NAV_TREE : explorerPath[explorerPath.length - 1].children;
  const { match, corrected } = explorerFindChild(children, arg);
  if (!match) return `bash: ${cmdName}: ${arg}: No such file or directory`;
  if (match.type === "folder") return `${cmdName}: ${arg}: Is a directory`;
  const noteEl = corrected ? explorerCorrectionNote([{ typed: arg, resolved: explorerLabel(match) }]) : null;
  if (match.href) {
    window.open(match.href, "_blank");
    const msg = `opening ${explorerLabel(match)}...`;
    return noteEl ? [noteEl, msg] : msg;
  }
  goToPage(match.id);
  return noteEl;
}

function explorerRunHelp() {
  const helpEl = document.createElement("div");
  helpEl.classList.add("explorer-line", "explorer-output-text");
  helpEl.textContent = EXPLORER_HELP_LINES.join("\n");
  return helpEl;
}

// Returns a line/element (or an array of them, e.g. a fuzzy-match note
// followed by the actual result) to append to the transcript, `null` for
// "no output" (a bare `cd`), or the sentinel "CLEAR" to wipe the transcript
// instead of appending anything.
function explorerRunCommand(trimmed) {
  const spaceIdx = trimmed.indexOf(" ");
  const cmd = (spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx)).toLowerCase();
  const arg = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1);

  switch (cmd) {
    case "ls": return explorerRunLs(arg);
    case "cd": return explorerRunCd(arg);
    case "cat":
    case "open": return explorerRunOpen(arg, cmd);
    case "pwd": return "/" + explorerPath.map(explorerLabel).join("/");
    case "help": return explorerRunHelp();
    case "clear": return "CLEAR";
    default: return `bash: ${cmd}: command not found`;
  }
}

function explorerAppendLine(content) {
  const output = document.getElementById("explorer-output");
  if (!output || content == null) return;
  const items = Array.isArray(content) ? content : [content];
  items.forEach((item) => {
    if (item == null) return;
    if (item instanceof Node) {
      output.appendChild(item);
    } else {
      const lineEl = document.createElement("div");
      lineEl.classList.add("explorer-line", "explorer-output-text");
      lineEl.textContent = item;
      output.appendChild(lineEl);
    }
  });
  MAIN_CONTENT_SECTION.scrollTo({ top: MAIN_CONTENT_SECTION.scrollHeight });
}

function explorerUpdatePromptLabel() {
  const promptEl = document.getElementById("explorer-prompt");
  if (promptEl) promptEl.textContent = `>aaron@portfolio:${explorerPromptPath()}$`;
}

function explorerSubmitCommand(inputEl) {
  const raw = inputEl.value;
  const trimmed = raw.trim();

  const echoLine = document.createElement("div");
  echoLine.classList.add("explorer-line", "explorer-command-line");
  const promptSpan = document.createElement("span");
  promptSpan.classList.add("prompt");
  promptSpan.textContent = document.getElementById("explorer-prompt")?.textContent ?? "$";
  const commandSpan = document.createElement("span");
  commandSpan.classList.add("command");
  commandSpan.textContent = raw;
  echoLine.append(promptSpan, commandSpan);
  document.getElementById("explorer-output")?.appendChild(echoLine);

  inputEl.value = "";

  if (trimmed) {
    const result = explorerRunCommand(trimmed);
    if (result === "CLEAR") {
      const output = document.getElementById("explorer-output");
      if (output) output.innerHTML = "";
    } else {
      explorerAppendLine(result);
    }
  }

  explorerUpdatePromptLabel();
  MAIN_CONTENT_SECTION.scrollTo({ top: MAIN_CONTENT_SECTION.scrollHeight });
}

function renderExplorerPage() {
  MAIN_CONTENT_SECTION.innerHTML = "";
  MAIN_CONTENT_SECTION.scrollTo({ top: 0 });

  const outerEl = document.createElement("div");
  outerEl.classList.add("outer-paragraph-container");
  const innerEl = document.createElement("div");
  innerEl.classList.add("inner-paragraph-container", "mt-4");

  const titleEl = document.createElement("h1");
  titleEl.innerHTML = `<span class="text-blue">File Explorer</span>`;
  innerEl.appendChild(titleEl);

  const terminalEl = document.createElement("div");
  terminalEl.classList.add("explorer-terminal");
  terminalEl.id = "explorer-terminal";

  const outputEl = document.createElement("div");
  outputEl.classList.add("explorer-output");
  outputEl.id = "explorer-output";
  terminalEl.appendChild(outputEl);

  const inputLineEl = document.createElement("div");
  inputLineEl.classList.add("explorer-input-line");
  const promptEl = document.createElement("span");
  promptEl.classList.add("prompt");
  promptEl.id = "explorer-prompt";
  promptEl.textContent = `>aaron@portfolio:${explorerPromptPath()}$`;
  const inputEl = document.createElement("input");
  inputEl.type = "text";
  inputEl.classList.add("explorer-input");
  inputEl.id = "explorer-input";
  inputEl.autocomplete = "off";
  inputEl.spellcheck = false;
  inputLineEl.append(promptEl, inputEl);
  terminalEl.appendChild(inputLineEl);

  innerEl.appendChild(terminalEl);
  outerEl.appendChild(innerEl);
  MAIN_CONTENT_SECTION.appendChild(outerEl);

  outputEl.appendChild(explorerRunHelp());

  inputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      explorerSubmitCommand(inputEl);
    }
  });
  terminalEl.addEventListener("click", () => inputEl.focus());

  inputEl.focus();
}

function renderPlainPage(node) {
  const outerEl = document.createElement("div");
  outerEl.classList.add("outer-paragraph-container");
  const innerEl = document.createElement("div");
  innerEl.classList.add("inner-paragraph-container", "mt-4");

  const titleEl = document.createElement("h1");
  titleEl.innerHTML = `<span class="text-blue">${node.title ?? node.name}</span>`;
  innerEl.appendChild(titleEl);

  (node.content ?? []).forEach((c) => {
    const ce = document.createElement(c.trim().startsWith("<") ? "div" : "p");
    ce.innerHTML = c;
    innerEl.appendChild(ce);
  });

  outerEl.appendChild(innerEl);
  MAIN_CONTENT_SECTION.appendChild(outerEl);
}

// Skills used to be a category page + clickable tag row + inline "pkg info"
// reveal. Now each skill is its own page, so this just renders that pkg-info
// block directly. Overview pages (one per category, no `status` field) fall
// back to a plain title+content page.
function renderSkillPage(node) {
  if (node.status == null) {
    renderPlainPage(node);
    return;
  }

  const outerEl = document.createElement("div");
  outerEl.classList.add("outer-paragraph-container");
  const innerEl = document.createElement("div");
  innerEl.classList.add("inner-paragraph-container", "mt-4");

  if (node._parentFolderName) {
    const titleElement = document.createElement("h1");
    titleElement.innerHTML = `<span class="text-blue">${node._parentFolderName}</span>`;
    innerEl.appendChild(titleElement);
  }

  const skillDetailElement = document.createElement("div");
  skillDetailElement.classList.add("skill-detail");

  const skillPkgHeader = document.createElement("p");
  skillPkgHeader.classList.add("skill-pkg-header");
  skillPkgHeader.innerHTML = `<span class="skill-pkg-prompt">&gt; pkg info</span> <span class="text-green">${node.name.toLowerCase()}</span>`;
  skillDetailElement.appendChild(skillPkgHeader);

  const pkgBody = document.createElement("div");
  pkgBody.classList.add("skill-pkg-body");

  const statusRow = document.createElement("div");
  statusRow.classList.add("skill-pkg-row");
  statusRow.innerHTML = `<span class="skill-pkg-key">status:</span><span class="skill-pkg-val">${node.status}</span>`;
  pkgBody.appendChild(statusRow);

  if (node.origin) {
    const originRow = document.createElement("div");
    originRow.classList.add("skill-pkg-row");
    originRow.innerHTML = `<span class="skill-pkg-key">origin:</span><span class="skill-pkg-val">${node.origin}</span>`;
    pkgBody.appendChild(originRow);
  }

  if (node.used_in && node.used_in.length > 0) {
    const usedInRow = document.createElement("div");
    usedInRow.classList.add("skill-pkg-row");
    const links = node.used_in.map(item =>
      `<button class="skill-pkg-link" onclick="goToPage('${item.id}')">[${item.label}]</button>`
    ).join('');
    usedInRow.innerHTML = `<span class="skill-pkg-key">used-in:</span><span class="skill-pkg-val skill-pkg-links">${links}</span>`;
    pkgBody.appendChild(usedInRow);
  }

  if (node.notes) {
    const notesRow = document.createElement("div");
    notesRow.classList.add("skill-pkg-row");
    notesRow.innerHTML = `<span class="skill-pkg-key">notes:</span><span class="skill-pkg-val">${node.notes}</span>`;
    pkgBody.appendChild(notesRow);
  }

  skillDetailElement.appendChild(pkgBody);

  const backLink = document.createElement("div");
  backLink.classList.add("skill-pkg-back");
  backLink.innerHTML = `<button class="skill-pkg-link" onclick="goToPage('skill-overview-root')">[&larr; index.md]</button>`;
  skillDetailElement.appendChild(backLink);

  innerEl.appendChild(skillDetailElement);
  outerEl.appendChild(innerEl);
  MAIN_CONTENT_SECTION.appendChild(outerEl);
}

// Shared shape for experience/projects/ui-elements pages (including their
// TL;DR/Overview pages): title-or-name, optional date/year/technologies/
// summary, a content array (with a few special embedded-demo markers), and
// an optional closing quote.
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

  const yearElement = document.createElement("h2");
  yearElement.innerHTML = node.year != null ? `[Built in <span class="text-green">${node.year}</span>]` : null;

  const technologiesContainerElement = document.createElement("div");
  technologiesContainerElement.classList.add("technologies-row");
  technologiesContainerElement.innerHTML = node.technologies?.join(" ") || null;

  if (titleText != null) topElement.appendChild(titleElement);
  if (node.date != null) topElement.appendChild(dateElement);
  if (node.year != null) topElement.appendChild(yearElement);
  if (node.technologies?.length) topElement.appendChild(technologiesContainerElement);

  if (node.summary != null) {
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
      imageElement.alt = "Project image";
      imageElement.decoding = "async";
      imageElement.src = `../images/${imagePath}`;
      imageElement.classList.add("project-image");

      imageInnerContainerElement.appendChild(imageElement);
      return imageInnerContainerElement;
    }) ?? [];

  (node.content ?? []).forEach((c, i) => {
    const element = document.createElement("div");

    if (c.includes('database-demo')) {
      element.innerHTML = c;
      innerContainerElement.appendChild(element);

      ['projects/database/database.js', 'projects/database/insert_form.js', 'projects/database/delete_form.js'].forEach((src) => {
        if (!document.querySelector(`script[src="${src}"]`)) {
          const script = document.createElement('script');
          script.src = src;
          document.body.appendChild(script);
        }
      });
    } else if (c.includes('jumpy-demo')) {
      element.innerHTML = c;
      innerContainerElement.appendChild(element);

      const loadJumpyDemoScript = function () {
        const demoScript = document.createElement('script');
        demoScript.src = 'projects/jumpy/jumpy-demo.js';
        demoScript.onload = function () {
          initJumpyDemo();
        };
        document.body.appendChild(demoScript);
      };

      const existingEngineScript = document.querySelector('script[src="projects/jumpy/jumpy-engine.js"]');
      if (!existingEngineScript) {
        const engineScript = document.createElement('script');
        engineScript.src = 'projects/jumpy/jumpy-engine.js';
        engineScript.onload = loadJumpyDemoScript;
        document.body.appendChild(engineScript);
      } else if (typeof initJumpyDemo === 'function') {
        // Both engine and demo already loaded (e.g. revisiting this page).
        setTimeout(initJumpyDemo, 0);
      } else if (typeof jumpyInitialBoard === 'function') {
        // Engine already loaded elsewhere but the demo script wasn't.
        loadJumpyDemoScript();
      } else {
        // Engine script tag exists but is still loading -- wait for its
        // load event before loading the demo, since the demo needs the
        // engine's globals defined first.
        existingEngineScript.addEventListener('load', loadJumpyDemoScript);
      }
    } else if (c.includes('cursor-heatmap-demo')) {
      element.innerHTML = c;
      innerContainerElement.appendChild(element);

      if (!document.querySelector('script[src="projects/heatmap/cursor-heatmap-demo.js"]')) {
        const script = document.createElement('script');
        script.src = 'projects/heatmap/cursor-heatmap-demo.js';
        script.onload = function () {
          initCursorHeatmapDemo();
        };
        document.body.appendChild(script);
      } else if (typeof initCursorHeatmapDemo === 'function') {
        setTimeout(initCursorHeatmapDemo, 0);
      }
    } else if (c.includes('ascii-art-demo')) {
      element.innerHTML = c;
      innerContainerElement.appendChild(element);

      if (!document.querySelector('script[src="projects/ascii-art/ascii-art-demo.js"]')) {
        const script = document.createElement('script');
        script.src = 'projects/ascii-art/ascii-art-demo.js';
        script.onload = function () {
          initAsciiArtDemo();
        };
        document.body.appendChild(script);
      } else if (typeof initAsciiArtDemo === 'function') {
        setTimeout(initAsciiArtDemo, 0);
      }
    } else if (c.includes('lofi-sketch-demo')) {
      element.innerHTML = c;
      innerContainerElement.appendChild(element);

      // Samples file first (the embedded piano/drum recordings, large --
      // this is why it's split from the engine and only ever loaded once),
      // then the engine, which defines window.LofiSketch and is the only
      // thing that actually needs to run after this markup exists.
      const mountLofiSketch = function () {
        const demoContainer = element.querySelector('#lofi-sketch-demo');
        if (demoContainer && window.LofiSketch) {
          window.LofiSketch.mount(demoContainer);
          if (typeof initLofiPanelControls === 'function') initLofiPanelControls(demoContainer);
        }
      };

      const loadLofiEngineScript = function () {
        if (window.LofiSketch) { mountLofiSketch(); return; }
        const engineScript = document.createElement('script');
        engineScript.src = '/projects/lofi-sketch/lofi-engine.js';
        engineScript.onload = mountLofiSketch;
        document.body.appendChild(engineScript);
      };

      const existingSamplesScript = document.querySelector('script[src="/projects/lofi-sketch/lofi-samples.js"]');
      if (!existingSamplesScript) {
        const samplesScript = document.createElement('script');
        samplesScript.src = '/projects/lofi-sketch/lofi-samples.js';
        samplesScript.onload = loadLofiEngineScript;
        document.body.appendChild(samplesScript);
      } else if (window.LofiSketch) {
        // Samples + engine already loaded (revisiting this page, or the
        // footer toggle/home tile already loaded them) -- just mount the
        // panel onto the freshly rendered markup, no re-fetch needed.
        mountLofiSketch();
      } else if (typeof window.PIANO_SAMPLES_B64 !== 'undefined') {
        // Samples loaded elsewhere but the engine script wasn't yet.
        loadLofiEngineScript();
      } else {
        // Samples script tag exists but is still loading -- wait for it.
        existingSamplesScript.addEventListener('load', loadLofiEngineScript);
      }
    } else if (c.includes('site-mirror')) {
      if (IS_EMBEDDED_PREVIEW) {
        element.innerHTML =
          "<div id='site-mirror-note'>You're already inside the live preview — this is as deep as it goes.</div>";
        innerContainerElement.appendChild(element);
      } else {
        element.innerHTML = c;
        innerContainerElement.appendChild(element);

        if (!document.querySelector('script[src="js/site-mirror.js"]')) {
          const script = document.createElement('script');
          script.src = 'js/site-mirror.js';
          script.onload = function () {
            initSiteMirror();
          };
          document.body.appendChild(script);
        } else if (typeof initSiteMirror === 'function') {
          setTimeout(initSiteMirror, 0);
        }
      }
    } else {
      element.innerHTML = c.replaceAll("\n", "<br>");
      innerContainerElement.appendChild(element);
    }


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

function toggleProjectExplain(toggleEl) {
  const body = toggleEl.closest(".project-explain")?.querySelector(".project-explain-body");
  const arrowEl = toggleEl.querySelector(".project-explain-arrow");
  if (!body) return;

  const expanded = toggleEl.getAttribute("aria-expanded") === "true";
  toggleEl.setAttribute("aria-expanded", String(!expanded));
  body.classList.toggle("expanded", !expanded);
  if (arrowEl) {
    arrowEl.textContent = expanded ? ">" : "v";
  }
}

// DEFAULT_EXPANDED_FOLDERS is defined in js/render-lists.js. Applied here
// (rather than at render time) because setFolderExpanded doesn't exist yet
// when renderAllLists() runs -- loader.js only injects this file afterward.
function applyDefaultExpandedFolders() {
  document.querySelectorAll("#nav-scroll-area .nav-folder-node").forEach((el) => {
    if (DEFAULT_EXPANDED_FOLDERS.has(el.dataset.nodeId)) setFolderExpanded(el, true);
  });
}

async function init() {
  applyDefaultExpandedFolders();
  initKeyboardNav();
  initCommandPalette();
  initMobileNav();

  await goToPage("home", { skipRender: true });
}
