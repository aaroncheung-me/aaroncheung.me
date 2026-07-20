// URL for the easter egg destination. Set this to the real URL when ready.
const EASTER_EGG_URL = null;

const KONAMI_CODE = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
  "b", "a",
];
let konamiIndex = 0;

function isInputFocused() {
  const tag = document.activeElement?.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

function checkKonami(key) {
  if (key === KONAMI_CODE[konamiIndex]) {
    konamiIndex++;
    if (konamiIndex === KONAMI_CODE.length) {
      konamiIndex = 0;
      triggerEasterEgg();
    }
  } else {
    konamiIndex = key === KONAMI_CODE[0] ? 1 : 0;
  }
}

function triggerEasterEgg() {
  const existing = document.getElementById("easter-egg-popup");
  if (existing) {
    existing.remove();
  }

  const popup = document.createElement("div");
  popup.id = "easter-egg-popup";
  popup.innerHTML = `
    <div id="easter-egg-inner">
      <div class="ee-line"><span class="text-purple">&gt;</span> ACCESS GRANTED</div>
      <div class="ee-line"><span class="text-purple">&gt;</span> Loading hidden directory...</div>
      <div class="ee-line"><span class="text-purple">&gt;</span> Art account:
        ${EASTER_EGG_URL
          ? `<a class="text-purple" href="${EASTER_EGG_URL}" target="_blank">${EASTER_EGG_URL}</a>`
          : `<span class="text-green">[coming soon]</span>`
        }
      </div>
      <div class="ee-close">press any key to dismiss</div>
    </div>
  `;

  document.body.appendChild(popup);

  const dismiss = () => {
    popup.classList.add("ee-fade-out");
    setTimeout(() => popup.remove(), 400);
    document.removeEventListener("keydown", dismiss);
    popup.removeEventListener("click", dismiss);
  };

  setTimeout(() => {
    document.addEventListener("keydown", dismiss, { once: true });
    popup.addEventListener("click", dismiss);
  }, 200);
}

function handleKeyboardNav(event) {
  checkKonami(event.key);

  if (isInputFocused()) {
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key === "k") {
    event.preventDefault();
    if (typeof openCommandPalette === "function") {
      openCommandPalette();
    }
    return;
  }

  const num = parseInt(event.key, 10);
  if (num >= 1 && num <= 6) {
    event.preventDefault();
    goToSection(num - 1);
    render(true);
    return;
  }

  if (typeof left_sections === "undefined") {
    return;
  }

  const sIdx = currentPosition.sectionIndex;
  const iIdx = currentPosition.sectionItemIndex;
  const count = left_sections.length;
  const itemCount = left_sections[sIdx]?.items.length ?? 0;

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    goToSection((sIdx - 1 + count) % count);
    render(true);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    goToSection((sIdx + 1) % count);
    render(true);
  }
  else if (event.key === "ArrowUp" && itemCount > 0) {
    event.preventDefault();
    goToSection(sIdx, (iIdx - 1 + itemCount) % itemCount);
    render(false);
  } else if (event.key === "ArrowDown" && itemCount > 0) {
    event.preventDefault();
    goToSection(sIdx, (iIdx + 1) % itemCount);
    render(false);
  }
}

function initKeyboardNav() {
  document.addEventListener("keydown", handleKeyboardNav);
}
