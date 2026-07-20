async function fetchSectionData(jsonFile) {
  const response = await fetch(`data/${jsonFile}.json`);
  const { data } = await response.json();
  return data;
}

async function renderListSection(sectionId, buildItemHtml) {
  const sectionEl = document.getElementById(sectionId);
  if (!sectionEl) {
    return;
  }

  const data = await fetchSectionData(sectionId);
  const listEl = sectionEl.getElementsByClassName("ui-list")[0];
  listEl.innerHTML = data.map(buildItemHtml).join("");
}

// Renders skills as a tree: category headers are real "items" (sharing the
// standard click/selection machinery); skill rows are extra rows wired up
// separately in tui.js.
async function renderSkillsTree() {
  const sectionEl = document.getElementById("skills");
  if (!sectionEl) {
    return;
  }

  const data = await fetchSectionData("skills");
  const listEl = sectionEl.getElementsByClassName("ui-list")[0];

  listEl.innerHTML = data
    .map((category, categoryIndex) => {
      const isLastCategory = categoryIndex === data.length - 1;
      const categoryPrefix = isLastCategory ? "└──" : "├──";
      const header = `<div class="skill-category-header" data-category-index="${categoryIndex}"><span class="tree-prefix">${categoryPrefix}</span>${category.category}</div>`;

      const indent = isLastCategory ? "    " : "│   ";
      const skills = category.skills
        .map((skill, skillIndex) => {
          const isLastSkill = skillIndex === category.skills.length - 1;
          const skillBranch = isLastSkill ? "└──" : "├──";
          return `<div class="skill-item" data-category-index="${categoryIndex}" data-skill-name="${skill.name}"><span class="tree-indent">${indent}</span><span class="tree-prefix">${skillBranch}</span>${skill.name}</div>`;
        })
        .join("");
      return header + skills;
    })
    .join("");
}

// Shared by sections whose data mixes depth:0 header entries with depth:1
// child entries (see data/ui-elements.json, data/projects.json). Both are
// full, independently-viewable items -- depth only affects tree indentation/highlighting.
async function renderTreeSection(sectionId, buildHeaderHtml, buildChildHtml) {
  const sectionEl = document.getElementById(sectionId);
  if (!sectionEl) return;

  const data = await fetchSectionData(sectionId);
  const listEl = sectionEl.getElementsByClassName("ui-list")[0];

  const topLevelIndices = data.reduce((acc, e, i) => {
    if ((e.depth ?? 0) === 0) acc.push(i);
    return acc;
  }, []);

  listEl.innerHTML = data.map((entry, i) => {
    const depth = entry.depth ?? 0;
    if (depth === 0) {
      const topPos = topLevelIndices.indexOf(i);
      const prefix = topPos === topLevelIndices.length - 1 ? "└──" : "├──";
      return buildHeaderHtml(entry, prefix);
    } else {
      let parentIsLast = false;
      for (let j = i - 1; j >= 0; j--) {
        if ((data[j].depth ?? 0) === 0) {
          parentIsLast = topLevelIndices.indexOf(j) === topLevelIndices.length - 1;
          break;
        }
      }
      const indent = parentIsLast ? "    " : "│   ";
      const isLastChild = i === data.length - 1 || (data[i + 1]?.depth ?? 0) === 0;
      const prefix = isLastChild ? "└──" : "├──";
      return buildChildHtml(entry, prefix, indent);
    }
  }).join("");
}

function renderUiElementsTree() {
  return renderTreeSection(
    "ui-elements",
    (entry, prefix) => `<div class="ui-element-header"><span class="tree-prefix">${prefix}</span>${entry.title}</div>`,
    (entry, prefix, indent) => `<div class="ui-element-child"><span class="tree-indent">${indent}</span><span class="tree-prefix">${prefix}</span>${entry.title}</div>`
  );
}

function renderProjectsTree() {
  return renderTreeSection(
    "projects",
    (entry, prefix) => `<div class="ui-element-header"><span class="tree-prefix">${prefix}</span>${entry.name}</div>`,
    (entry, prefix, indent) => `<div class="ui-element-child"><span class="tree-indent">${indent}</span><span class="tree-prefix">${prefix}</span>${entry.name}</div>`
  );
}

function renderAllLists() {
  return Promise.all([
    renderListSection(
      "experience",
      (entry, i, arr) => {
        const isLast = i === arr.length - 1;
        const parentPrefix = isLast ? "└──" : "├──";
        const childIndent  = isLast ? "    " : "│   ";
        const company = entry.abbr
          ? `<span class="company-abbr">${entry.abbr}</span><span class="company-full">${entry.company}</span>`
          : entry.company;
        const header   = `<div class="experience-header"><span class="tree-prefix">${parentPrefix}</span>${entry.name}</div>`;
        const location = `<div class="experience-location" data-entry-index="${i}"><span class="tree-indent">${childIndent}</span><span class="tree-prefix">└──</span><span class="text-blue">${company}</span></div>`;
        return header + location;
      }
    ),
    renderProjectsTree(),
    renderSkillsTree(),
    renderUiElementsTree(),
  ]);
}
