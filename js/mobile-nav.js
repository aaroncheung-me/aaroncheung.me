function setActiveTab(sectionIndex) {
  document.querySelectorAll("#mobile-tabbar .tab").forEach((tab) => {
    tab.classList.toggle("active", Number(tab.dataset.sectionIndex) === sectionIndex);
  });
}

function setMobileBackButtonVisible(visible) {
  document.getElementById("mobile-back-button")?.classList.toggle("visible", visible);
}

function showMobileList(sectionIndex) {
  document.querySelectorAll("#left-section .container").forEach((box) => {
    box.classList.remove("mobile-active");
  });
  left_sections[sectionIndex].section.classList.add("mobile-active");
  document.getElementById("section-container")?.classList.add("mobile-list-mode");
  setMobileBackButtonVisible(false);
}

function showMobileDetailView() {
  document.getElementById("section-container")?.classList.remove("mobile-list-mode");
  setMobileBackButtonVisible(left_sections[currentPosition.sectionIndex].items.length > 0);
}

async function selectMobileTab(sectionIndex) {
  setActiveTab(sectionIndex);

  if (left_sections[sectionIndex].items.length === 0) {
    goToSection(sectionIndex);
    await render(sectionIndex !== previousPosition.sectionIndex);
    return;
  }

  currentPosition.sectionIndex = sectionIndex;
  showMobileList(sectionIndex);
}

function initMobileNav() {
  const tabbar = document.getElementById("mobile-tabbar");
  if (!tabbar) {
    return;
  }

  tabbar.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      selectMobileTab(Number(tab.dataset.sectionIndex));
    });
  });

  document.getElementById("mobile-back-button")?.addEventListener("click", () => {
    showMobileList(currentPosition.sectionIndex);
  });

  setActiveTab(currentPosition.sectionIndex);
}
