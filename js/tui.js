const ME_SECTION = document.getElementById("me");
const SKILLS_SECTION = document.getElementById("skills");
const EXPERIENCE_SECTION = document.getElementById("experience");
const PROJECTS_SECTION = document.getElementById("projects");
const CONTACT_SECTION = document.getElementById("contact");
const UI_ELEMENTS_SECTION = document.getElementById("ui-elements");
const MAIN_CONTENT_SECTION = document
  .getElementById("main-content")
  ?.getElementsByClassName("container-content")[0];

const HOME_CONTENT_HTML = MAIN_CONTENT_SECTION?.innerHTML ?? "";

const IS_EMBEDDED_PREVIEW = new URLSearchParams(window.location.search).get("embed") === "1";


const left_sections = [
  {
    name: "me",
    section: ME_SECTION,
    items: [...ME_SECTION.querySelector(".ui-list").children],
  },
  {
    name: "experience",
    section: EXPERIENCE_SECTION,
    items: [...EXPERIENCE_SECTION.querySelector(".ui-list").children].filter((el) =>
      el.classList.contains("experience-header")
    ),
  },
  {
    name: "projects",
    section: PROJECTS_SECTION,
    items: [...PROJECTS_SECTION.querySelector(".ui-list").children],
  },
  {
    name: "ui-elements",
    section: UI_ELEMENTS_SECTION,
    items: [...UI_ELEMENTS_SECTION.querySelector(".ui-list").children],
  },
  {
    name: "skills",
    section: SKILLS_SECTION,
    items: [...SKILLS_SECTION.querySelector(".ui-list").children].filter((el) =>
      el.classList.contains("skill-category-header")
    ),
  },
  { name: "contact", section: CONTACT_SECTION, items: [] },
];

const currentPosition = {
  sectionIndex: 0,
  sectionItemIndex: 0,
};

const previousPosition = {
  sectionIndex: 0,
  sectionItemIndex: 0,
};

// Tracks the last-clicked skill within the active category so
// displayContent() can show its detail. Reset by goToSection(); only the
// skill-item click handler sets it again.
let selectedSkillName = null;
let previousSelectedSkillName = null;
let activeScrambleInterval = null;

function clamp(min, value, max) {
  return Math.min(Math.max(min, value), max);
}

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

async function displayContent() {
  clearMainContent();

  const sectionName = left_sections[currentPosition.sectionIndex].name;

  const isHomePage = sectionName === 'me' && currentPosition.sectionItemIndex === 0;
  document.body.classList.toggle('at-home', isHomePage);

  if (sectionName === "me") {
    if (currentPosition.sectionItemIndex === 0) {
      MAIN_CONTENT_SECTION.innerHTML = HOME_CONTENT_HTML;
      if (typeof window.initAsciiLogo === 'function') window.initAsciiLogo();
      if (typeof window.setupHomeTiles === 'function') window.setupHomeTiles();
    } else {
      const response = await fetch('data/about.json');
      const { data } = await response.json();
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
    return;
  }

  const response = await fetch(`data/${sectionName}.json`);
  const { data } = await response.json();

  const outerContainerElement = document.createElement("div");
  outerContainerElement.classList.add("outer-paragraph-container");
  const innerContainerElement = document.createElement("div");
  innerContainerElement.classList.add("inner-paragraph-container");

  if (sectionName === "skills") {
    innerContainerElement.classList.add("mt-4");

    const categoryData = data[currentPosition.sectionItemIndex];

    const titleElement = document.createElement("h1");
    titleElement.innerHTML = `<span class="text-blue">${categoryData.category}</span>`;
    innerContainerElement.appendChild(titleElement);

    const descriptionElement = document.createElement("p");
    descriptionElement.classList.add("skill-category-description");
    descriptionElement.textContent = categoryData.description;
    innerContainerElement.appendChild(descriptionElement);

    const tagRowElement = document.createElement("div");
    tagRowElement.classList.add("skill-tag-row");
    categoryData.skills.forEach((skill) => {
      const tagElement = document.createElement("span");
      tagElement.classList.add("skill-tag");
      tagElement.textContent = `[${skill.name}]`;
      tagElement.addEventListener("click", async () => {
        selectedSkillName = skill.name;
        await displayContent();
        applyTextScramble();
      });
      tagRowElement.appendChild(tagElement);
    });
    innerContainerElement.appendChild(tagRowElement);

    const selectedSkill = categoryData.skills.find((skill) => skill.name === selectedSkillName);
    if (selectedSkill != null) {
      const skillDetailElement = document.createElement("div");
      skillDetailElement.classList.add("skill-detail");

      const skillPkgHeader = document.createElement("p");
      skillPkgHeader.classList.add("skill-pkg-header");
      skillPkgHeader.innerHTML = `<span class="skill-pkg-prompt">&gt; pkg info</span> <span class="text-green">${selectedSkill.name.toLowerCase()}</span>`;
      skillDetailElement.appendChild(skillPkgHeader);

      const pkgBody = document.createElement("div");
      pkgBody.classList.add("skill-pkg-body");

      const statusRow = document.createElement("div");
      statusRow.classList.add("skill-pkg-row");
      statusRow.innerHTML = `<span class="skill-pkg-key">status:</span><span class="skill-pkg-val">${selectedSkill.status}</span>`;
      pkgBody.appendChild(statusRow);

      if (selectedSkill.origin) {
        const originRow = document.createElement("div");
        originRow.classList.add("skill-pkg-row");
        originRow.innerHTML = `<span class="skill-pkg-key">origin:</span><span class="skill-pkg-val">${selectedSkill.origin}</span>`;
        pkgBody.appendChild(originRow);
      }

      if (selectedSkill.used_in && selectedSkill.used_in.length > 0) {
        const usedInRow = document.createElement("div");
        usedInRow.classList.add("skill-pkg-row");
        const links = selectedSkill.used_in.map(item =>
          `<button class="skill-pkg-link" onclick="setActiveTab(${item.section});goToSection(${item.section},${item.item});render(true)">[${item.label}]</button>`
        ).join('');
        usedInRow.innerHTML = `<span class="skill-pkg-key">used-in:</span><span class="skill-pkg-val skill-pkg-links">${links}</span>`;
        pkgBody.appendChild(usedInRow);
      }

      if (selectedSkill.notes) {
        const notesRow = document.createElement("div");
        notesRow.classList.add("skill-pkg-row");
        notesRow.innerHTML = `<span class="skill-pkg-key">notes:</span><span class="skill-pkg-val">${selectedSkill.notes}</span>`;
        pkgBody.appendChild(notesRow);
      }

      skillDetailElement.appendChild(pkgBody);

      innerContainerElement.appendChild(skillDetailElement);
    }

    outerContainerElement.appendChild(innerContainerElement);

    clearMainContent();
    MAIN_CONTENT_SECTION.appendChild(outerContainerElement);
  } else if (sectionName !== "contact") {
    innerContainerElement.classList.add("mt-4");

    const sectionData = data[currentPosition.sectionItemIndex];
    const topElement = document.createElement("div");

    const titleText = sectionData.title ?? sectionData.name;
    const titleElement = document.createElement("h1");
    titleElement.innerHTML =
      titleText != null
        ? `<span class="text-blue">${titleText}</span>`
        : null;

    const dateElement = document.createElement("h2");
    dateElement.innerHTML =
      sectionData.date != null
        ? `<span class="text-green">${sectionData.date}</span>`
        : null;

    const yearElement = document.createElement("h2");
    yearElement.innerHTML =
      sectionData.year != null
        ? `[Built in <span class="text-green">${sectionData.year}</span>]`
        : null;

    const technologiesContainerElement = document.createElement("div");
    technologiesContainerElement.classList.add("technologies-row");
    technologiesContainerElement.innerHTML =
      sectionData.technologies?.join(" ") || null;

    if (titleText != null) {
      topElement.appendChild(titleElement);
    }

    if (sectionData.date != null) {
      topElement.appendChild(dateElement);
    }

    if (sectionData.year != null) {
      topElement.appendChild(yearElement);
    }

    if (sectionData.technologies?.length) {
      topElement.appendChild(technologiesContainerElement);
    }

    if (sectionData.summary != null) {
      const summaryElement = document.createElement("p");
      summaryElement.classList.add("entry-summary");
      summaryElement.innerHTML = sectionData.summary;
      topElement.appendChild(summaryElement);
    }

    const imageElements =
      sectionData.images?.map((imagePath) => {
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

    sectionData.content.forEach((c, i) => {
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
          if (demoContainer && window.LofiSketch) window.LofiSketch.mount(demoContainer);
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

    if (sectionData.closingQuote != null) {
      const closingQuoteElement = document.createElement("p");
      closingQuoteElement.classList.add("entry-quote");
      closingQuoteElement.innerHTML = sectionData.closingQuote;
      innerContainerElement.appendChild(closingQuoteElement);
    }

    innerContainerElement.prepend(topElement);
    outerContainerElement.appendChild(innerContainerElement);

    clearMainContent();
    MAIN_CONTENT_SECTION.appendChild(outerContainerElement);

  } else if(sectionName == "contact"){
    const logoFileName = `data/images/logo_home.png`;
    const logoContainer = document.createElement("div");
    logoContainer.id = "logo-container";

    const logoElement = document.createElement("img");
    logoElement.loading = "eager";
    logoElement.src = logoFileName;
    logoElement.id = "logo";
    logoElement.alt = "Aaron C.";

    logoContainer.appendChild(logoElement);

    clearMainContent();
    MAIN_CONTENT_SECTION.appendChild(logoContainer);
    
    data.forEach((d) => {
      const element = document.createElement("div");

      d.content.forEach((contentItem) => {
        if (contentItem.trim().startsWith('<') && contentItem.includes('terminal-container')) {
          const terminalFormContainer = document.createElement('div');
          terminalFormContainer.classList.add('terminal-form-wrapper');
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
    
    if (document.getElementById('terminal-container')) {
      setTimeout(() => {
        if (typeof initTerminalForm === 'function') {
          initTerminalForm();
        }
      }, 100);
    }
  } else{
    const logoFileName = `data/images/logo.png`;
    const logoContainer = document.createElement("div");
    logoContainer.id = "logo-container";

    const logoElement = document.createElement("img");
    logoElement.loading = "eager";
    logoElement.src = logoFileName;
    logoElement.id = "logo";
    logoElement.alt = "Aaron C.";

    logoContainer.appendChild(logoElement);

    clearMainContent();
    MAIN_CONTENT_SECTION.appendChild(logoContainer);

    data.forEach((d) => {
      const element = document.createElement("div");

      d.content.forEach((c) => {
        const contentElement = document.createElement(c.trim().startsWith("<") ? "div" : "p");
        contentElement.innerHTML = c;
        element.appendChild(contentElement);
      });

      innerContainerElement.appendChild(element);
    });

    outerContainerElement.appendChild(innerContainerElement);
    MAIN_CONTENT_SECTION.appendChild(outerContainerElement);
  }
}

function clearSelectionStyling(scrollToTop) {
  if (isMobile()) {
    const selectedElement = document.getElementsByClassName("selected-item")[0];
    const selectedFrameElement =
      document.getElementsByClassName("selected-frame")[0];

    if (selectedElement != null) {
      selectedElement.classList.remove("selected-item");
    }

    if (selectedFrameElement != null) {
      selectedFrameElement.classList.remove("selected-frame");
    }
  }

  const previousSection = left_sections[previousPosition.sectionIndex];

  const previousSectionItemElement =
    previousSection.items[previousPosition.sectionItemIndex];

  const scrollableContainerElement =
    previousSection.section.getElementsByClassName("ui-list")[0];

  previousSection.section.classList.remove("selected-frame");
  previousSectionItemElement?.classList.remove("selected-item");
  document.querySelectorAll("#skills .category-active").forEach(el => el.classList.remove("category-active"));
  document.querySelectorAll("#experience .entry-active").forEach(el => el.classList.remove("entry-active"));
  document.querySelectorAll(".child-active").forEach(el => el.classList.remove("child-active"));
  document.querySelectorAll(".path-to-active").forEach(el => el.classList.remove("path-to-active"));

  if (scrollableContainerElement != null && scrollToTop) {
    scrollableContainerElement.scrollTo({ top: 0 });
  }
}

async function render(scrollToTop = false, isInitialRender = false) {
  if (
    !isMobile() &&
    !isInitialRender &&
    currentPosition.sectionIndex === previousPosition.sectionIndex &&
    currentPosition.sectionItemIndex === previousPosition.sectionItemIndex &&
    selectedSkillName === previousSelectedSkillName
  ) {
    return;
  }

  const currentSection = left_sections[currentPosition.sectionIndex];

  const currentSectionItemElement =
    currentSection.items?.[currentPosition.sectionItemIndex];

  const scrollableContainerElement =
    currentSection.section.getElementsByClassName("ui-list")[0];

  clearSelectionStyling(scrollToTop);

  currentSection.section.classList.add("selected-frame");
  currentSectionItemElement?.classList.add("selected-item");

  if (currentSection.name === "skills") {
    updateSkillItemHighlighting(currentPosition.sectionItemIndex);
  }

  if (currentSection.name === "experience") {
    updateExperienceLocationHighlighting(currentPosition.sectionItemIndex);
  }

  if (currentSection.name === "ui-elements" || currentSection.name === "projects") {
    updateTreeHighlighting(currentSection.name, currentPosition.sectionItemIndex);
  }

  if (!isInitialRender) {
    await displayContent();
    applyTextScramble();
  }

  if (isMobile()) {
    showMobileDetailView();
    if (isInitialRender) {
      setMobileBackButtonVisible(false);
    }
  }
}

function savePreviousPosition() {
  previousPosition.sectionIndex = currentPosition.sectionIndex;
  previousPosition.sectionItemIndex = currentPosition.sectionItemIndex;
  previousSelectedSkillName = selectedSkillName;
}

function goToSection(sectionNumber, itemNumber = 0) {
  savePreviousPosition();
  selectedSkillName = null;

  currentPosition.sectionIndex = clamp(
    0,
    sectionNumber,
    left_sections.length - 1,
  );
  currentPosition.sectionItemIndex = clamp(
    0,
    itemNumber,
    left_sections[currentPosition.sectionIndex].items.length - 1,
  );
}

function initMouseListeners() {
  left_sections.forEach((section, sectionIndex) => {
    section.items.forEach((item, itemIndex) => {
      item.addEventListener("click", async (event) => {
        event.stopPropagation();

        goToSection(sectionIndex, itemIndex);
        await render(sectionIndex !== previousPosition.sectionIndex);
      });
    });

    section.section.addEventListener("click", async () => {
      if (isMobile()) {
        return;
      }

      goToSection(sectionIndex);
      await render(sectionIndex !== previousPosition.sectionIndex);
    });
  });
}

function updateSkillItemHighlighting(activeCategoryIndex) {
  document.querySelectorAll("#skills .skill-item").forEach((el) => {
    const idx = Number(el.dataset.categoryIndex);
    el.classList.toggle("category-active", idx === activeCategoryIndex);
    el.classList.toggle("path-to-active", idx < activeCategoryIndex);
  });
}

function updateExperienceLocationHighlighting(activeEntryIndex) {
  document.querySelectorAll("#experience .experience-location").forEach((el) => {
    const idx = Number(el.dataset.entryIndex);
    el.classList.toggle("entry-active", idx === activeEntryIndex);
    el.classList.toggle("path-to-active", idx < activeEntryIndex);
  });
}

// For sections mixing .ui-element-header (depth:0) and .ui-element-child
// (depth:1) items (see js/render-lists.js's renderTreeSection()).
//
// path-to-active marks every child row in a group entirely before a
// boundary: the header's own index when a header is selected (every earlier
// group lights up), or that child's parent header's index when a child is
// selected (earlier groups light up, but siblings in its own group don't --
// one specific leaf is picked, not a point along a sequence).
function updateTreeHighlighting(sectionName, itemIndex) {
  const section = left_sections.find(s => s.name === sectionName);
  if (!section) return;
  const items = section.items;

  const selectedEl = items[itemIndex];
  const isChild = selectedEl?.classList.contains("ui-element-child");
  const isHeader = selectedEl?.classList.contains("ui-element-header");
  if (!isChild && !isHeader) return;

  let parentIndex = -1;
  for (let i = itemIndex - 1; i >= 0; i--) {
    if (items[i].classList.contains("ui-element-header")) {
      parentIndex = i;
      break;
    }
  }

  const boundary = isChild ? parentIndex : itemIndex;
  if (isChild && parentIndex >= 0) items[parentIndex].classList.add("child-active");

  for (let i = 0; i < boundary; i++) {
    if (items[i].classList.contains("ui-element-child")) {
      items[i].classList.add("path-to-active");
    }
  }
}

function initSkillsTreeListeners() {
  const skillsSectionIndex = left_sections.findIndex((s) => s.name === "skills");
  if (skillsSectionIndex === -1) {
    return;
  }

  document.querySelectorAll("#skills .skill-item").forEach((skillEl) => {
    skillEl.addEventListener("click", async (event) => {
      event.stopPropagation();

      const categoryIndex = Number(skillEl.dataset.categoryIndex);
      const sectionChanged = skillsSectionIndex !== previousPosition.sectionIndex;
      goToSection(skillsSectionIndex, categoryIndex);
      selectedSkillName = skillEl.dataset.skillName;
      await render(sectionChanged);
    });
  });
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

function initExperienceLocationListeners() {
  const expSectionIndex = left_sections.findIndex((s) => s.name === "experience");
  if (expSectionIndex === -1) return;

  document.querySelectorAll("#experience .experience-location").forEach((locationEl) => {
    locationEl.addEventListener("click", async (event) => {
      event.stopPropagation();
      const entryIndex = Number(locationEl.dataset.entryIndex);
      const sectionChanged = expSectionIndex !== previousPosition.sectionIndex;
      goToSection(expSectionIndex, entryIndex);
      await render(sectionChanged);
    });
  });
}


async function init() {
  initMouseListeners();
  initMobileNav();
  initSkillsTreeListeners();
  initExperienceLocationListeners();
  initKeyboardNav();
  initCommandPalette();

  await render(true, true);
}
