const SITE_MIRROR_SIZES = {
  desktop: { width: 1440, height: 1000 },
  mobile: { width: 390, height: 844 },
};
const SITE_MIRROR_MOBILE_MAX_WIDTH = 360;
const SITE_MIRROR_MOBILE_MAX_HEIGHT = 700;
const SITE_MIRROR_DEFAULT_SRC = "index.html";

// Read once per initSiteMirror() call from the wrapper's data-mirror-src,
// since more than one entry can embed this demo and each needs its own target page.
let siteMirrorSrc = SITE_MIRROR_DEFAULT_SRC;
let siteMirrorMode = "desktop";
let siteMirrorResizeHandler = null;

function siteMirrorApplyScale() {
  const wrap = document.getElementById("site-mirror-frame-wrap");
  const chrome = document.getElementById("site-mirror-chrome");
  const iframe = document.getElementById("site-mirror-iframe");
  if (!wrap || !iframe) {
    return;
  }

  // Reset previous mode's inline sizing before measuring available width.
  wrap.style.width = "";
  wrap.style.margin = "";
  if (chrome) {
    chrome.style.width = "";
    chrome.style.margin = "";
  }

  const size = SITE_MIRROR_SIZES[siteMirrorMode];
  let scale = wrap.clientWidth / size.width;

  if (siteMirrorMode === "mobile") {
    scale = Math.min(
      scale,
      SITE_MIRROR_MOBILE_MAX_WIDTH / size.width,
      SITE_MIRROR_MOBILE_MAX_HEIGHT / size.height
    );
    const boxWidth = `${size.width * scale}px`;
    wrap.style.width = boxWidth;
    wrap.style.margin = "0 auto";
    if (chrome) {
      chrome.style.width = boxWidth;
      chrome.style.margin = "0 auto";
    }
  }

  iframe.style.transform = `scale(${scale})`;
  wrap.style.height = `${size.height * scale}px`;
}

// The embedded page only detects mobile vs desktop once, at its own load --
// resizing the iframe afterward wouldn't update its JS-driven state (active
// tabs, etc.), so every mode switch forces a fresh reload at the new size.
function siteMirrorLoadIframe(mode) {
  const iframe = document.getElementById("site-mirror-iframe");
  if (!iframe) {
    return;
  }

  const size = SITE_MIRROR_SIZES[mode];
  iframe.style.width = `${size.width}px`;
  iframe.style.height = `${size.height}px`;
  iframe.src = `${siteMirrorSrc}?embed=1&v=${Date.now()}`;
}

function siteMirrorSetMode(mode) {
  siteMirrorMode = mode;
  siteMirrorLoadIframe(mode);
  siteMirrorApplyScale();

  document.querySelectorAll(".site-mirror-mode-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });
}

function initSiteMirror() {
  const wrapper = document.getElementById("site-mirror");
  if (!wrapper || !document.getElementById("site-mirror-frame-wrap")) {
    return;
  }

  siteMirrorSrc = wrapper.dataset.mirrorSrc || SITE_MIRROR_DEFAULT_SRC;
  siteMirrorMode = "desktop";
  siteMirrorLoadIframe("desktop");
  siteMirrorApplyScale();

  if (siteMirrorResizeHandler) {
    window.removeEventListener("resize", siteMirrorResizeHandler);
  }
  // Self-detaches once the wrapper leaves the DOM -- navigating away wipes
  // this demo's DOM but wouldn't otherwise remove this listener.
  siteMirrorResizeHandler = () => {
    if (!document.body.contains(wrapper)) {
      window.removeEventListener("resize", siteMirrorResizeHandler);
      siteMirrorResizeHandler = null;
      return;
    }
    siteMirrorApplyScale();
  };
  window.addEventListener("resize", siteMirrorResizeHandler);
}
