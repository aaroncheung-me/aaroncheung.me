// fuzzyScore/fuzzyHighlight are defined in js/fuzzy-search.js.

let commandPaletteOpen = false;
let commandPaletteResults = [];
let commandPaletteSelectedIndex = 0;

const TOP_SECTION_LABELS = {
  home: "home", experience: "experience & education", projects: "coding projects",
  "ui-elements": "ui elements", skills: "skills & tools", contact: "contact",
};

function buildCommandPaletteIndex() {
  if (typeof PAGE_REGISTRY === "undefined") {
    return [];
  }

  const entries = [];
  PAGE_REGISTRY.forEach(({ node, topSection }, id) => {
    entries.push({
      label: node.name ?? node.title,
      hint: TOP_SECTION_LABELS[topSection] ?? topSection,
      id,
    });
  });

  return entries;
}

function openCommandPalette() {
  if (commandPaletteOpen) {
    return;
  }
  commandPaletteOpen = true;

  const overlay = document.getElementById("command-palette-overlay");
  const input = document.getElementById("command-palette-input");
  if (!overlay || !input) {
    return;
  }

  overlay.classList.add("cp-visible");
  overlay.inert = false;
  input.value = "";
  commandPaletteSelectedIndex = 0;
  renderCommandPaletteResults(buildCommandPaletteIndex());
  input.focus();
}

function closeCommandPalette() {
  commandPaletteOpen = false;
  const overlay = document.getElementById("command-palette-overlay");
  overlay?.classList.remove("cp-visible");
  if (overlay) overlay.inert = true;
}

function renderCommandPaletteResults(results) {
  commandPaletteResults = results;
  commandPaletteSelectedIndex = Math.min(commandPaletteSelectedIndex, results.length - 1);
  if (commandPaletteSelectedIndex < 0) {
    commandPaletteSelectedIndex = 0;
  }

  const list = document.getElementById("command-palette-list");
  if (!list) {
    return;
  }

  if (results.length === 0) {
    list.innerHTML = `<div class="cp-empty">no results</div>`;
    return;
  }

  list.innerHTML = results
    .map(
      (entry, i) => `
      <div class="cp-result ${i === commandPaletteSelectedIndex ? "cp-selected" : ""}" data-index="${i}">
        <span class="cp-label">${entry.highlightedLabel ?? entry.label}</span>
        <span class="cp-hint">${entry.hint}</span>
      </div>
    `
    )
    .join("");

  const selectedEl = list.querySelector(".cp-selected");
  selectedEl?.scrollIntoView({ block: "nearest" });
}

function selectCommandPaletteResult() {
  const entry = commandPaletteResults[commandPaletteSelectedIndex];
  if (!entry) {
    return;
  }
  closeCommandPalette();
  goToPage(entry.id);
}

function initCommandPalette() {
  const overlay = document.createElement("div");
  overlay.id = "command-palette-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Command palette");
  overlay.inert = true;
  overlay.innerHTML = `
    <div id="command-palette-box">
      <input id="command-palette-input" type="text" placeholder="jump to..." autocomplete="off" spellcheck="false" />
      <div id="command-palette-list"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = document.getElementById("command-palette-input");
  const list = document.getElementById("command-palette-list");

  input.addEventListener("input", () => {
    const query = input.value.trim();
    const all = buildCommandPaletteIndex();
    if (!query) {
      commandPaletteSelectedIndex = 0;
      renderCommandPaletteResults(all);
      return;
    }
    const scored = all.map((e) => {
      const ls = fuzzyScore(query, e.label);
      const hs = fuzzyScore(query, e.hint);
      const score = Math.max(ls, hs);
      const highlightedLabel = ls >= hs ? fuzzyHighlight(query, e.label) : e.label;
      return { ...e, score, highlightedLabel };
    }).filter((e) => isFinite(e.score))
      .sort((a, b) => b.score - a.score);
    commandPaletteSelectedIndex = 0;
    renderCommandPaletteResults(scored);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      commandPaletteSelectedIndex = Math.min(
        commandPaletteSelectedIndex + 1,
        commandPaletteResults.length - 1
      );
      renderCommandPaletteResults(commandPaletteResults);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      commandPaletteSelectedIndex = Math.max(commandPaletteSelectedIndex - 1, 0);
      renderCommandPaletteResults(commandPaletteResults);
    } else if (event.key === "Enter") {
      event.preventDefault();
      selectCommandPaletteResult();
    }
  });

  list.addEventListener("click", (event) => {
    const resultEl = event.target.closest(".cp-result");
    if (resultEl) {
      commandPaletteSelectedIndex = parseInt(resultEl.dataset.index, 10);
      selectCommandPaletteResult();
    }
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeCommandPalette();
    }
  });
}

bindEscapeToClose(() => commandPaletteOpen, closeCommandPalette);
