// Case-study summary cards -- title, summary, and closing quote, reusing
// fields each case-study node already has in data/case-studies/*.json rather than
// introducing new content to maintain. Two call sites share this: the "the
// work" grid on the home page (js/studies-router.js's HOME_CONTENT_HTML
// capture, see initStudiesRouter) and the top of each case study's own page
// (renderGenericPage, in place of the plain .entry-summary paragraph other
// generic pages still use).

// The primary "Case Study" page for each top-level project -- one level
// deep only, same shape as collectCaseStudyPages() in js/studies-widgets.js,
// but picking just the first page child (the case study itself) rather than
// every direct child (which would also include Process Notes/Research
// Index). Falls back to the folder's first page child if none matches the
// naming convention, and passes bare top-level pages through unchanged.
function collectPrimaryCaseStudies() {
  return (typeof NAV_TREE !== "undefined" ? NAV_TREE : [])
    .filter((node) => !NON_CASE_STUDY_IDS.includes(node.id))
    .map((node) => {
      if (node.type !== "folder") return node;
      return node.children.find((c) => c.type === "page" && c.id.endsWith("-case-study"))
        ?? node.children.find((c) => c.type === "page");
    })
    .filter(Boolean);
}

// linkable: true renders a clickable <button> for the home-page grid (keeps
// native keyboard/focus behavior for free); false renders a plain <div> for
// the case study's own page, where linking to itself would be pointless --
// and where the page's own <h1> already shows the title, so the card skips it.
function buildCaseStudyCard(node, { linkable = true } = {}) {
  const card = document.createElement(linkable ? "button" : "div");
  card.classList.add("case-study-card");
  if (linkable) {
    card.type = "button";
    card.classList.add("case-study-card-link");
    card.addEventListener("click", () => goToPage(node.id));
  }

  card.innerHTML = `
    ${linkable ? `<h3 class="case-study-card-title">${node.title ?? node.name}</h3>` : ""}
    <p class="case-study-card-summary">${node.summary ?? ""}</p>
    <p class="case-study-card-quote">${node.closingQuote ?? ""}</p>
  `;
  return card;
}

// Populates the empty grid already sitting in index.html's static home
// markup. Must run before js/studies-router.js snapshots that markup into
// HOME_CONTENT_HTML, so initStudiesRouter() calls this first.
function renderWorkCards() {
  const grid = document.getElementById("work-cards-grid");
  if (!grid) return;
  grid.innerHTML = "";
  const caseStudies = collectPrimaryCaseStudies();
  caseStudies.forEach((node) => {
    grid.appendChild(buildCaseStudyCard(node, { linkable: true }));
  });
  const countEl = document.getElementById("case-study-count");
  if (countEl) countEl.textContent = `${caseStudies.length} case ${caseStudies.length === 1 ? "study" : "studies"}`;
}
