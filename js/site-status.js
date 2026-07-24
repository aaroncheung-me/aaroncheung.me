// Lazygit-style "status" readout -- one of the nav widget switcher's options
// (js/nav-widget-panel.js). Shows the real latest commit on this site's own
// repo, fetched live from the GitHub API (public repos get CORS-open
// responses, no proxy needed). Cached in localStorage for 30 minutes so
// flipping back to this widget repeatedly doesn't re-fetch every time, and
// rate limiting (60/hr, per visitor's own IP) stays a non-issue at this
// site's traffic.

const SITE_STATUS_REPO = "aaroncheung-me/aaroncheung.me";
const SITE_STATUS_CACHE_KEY = "site-status-cache";
const SITE_STATUS_CACHE_TTL = 30 * 60 * 1000;

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatRelativeTime(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function renderSiteStatus(frame, commit) {
  frame.innerHTML = `
    <div class="status-branch"><span class="status-dot">●</span> main</div>
    <div class="status-commit">${formatRelativeTime(commit.date)} &mdash;
      <a href="${commit.url}" target="_blank" class="text-purple">"${escapeHtml(commit.message)}"</a>
    </div>
  `;
}

function renderSiteStatusFallback(frame) {
  frame.innerHTML = `<div class="status-branch"><span class="status-dot">●</span> main</div>`;
}

async function loadSiteStatus(frame) {
  if (!frame) return;

  try {
    const cached = JSON.parse(localStorage.getItem(SITE_STATUS_CACHE_KEY) || "null");
    if (cached && Date.now() - cached.fetchedAt < SITE_STATUS_CACHE_TTL) {
      renderSiteStatus(frame, cached.commit);
      return;
    }
  } catch (e) { /* corrupt cache, fall through to a fresh fetch */ }

  try {
    const response = await fetch(`https://api.github.com/repos/${SITE_STATUS_REPO}/commits?per_page=1`);
    if (!response.ok) throw new Error(`GitHub API responded ${response.status}`);
    const [latest] = await response.json();
    const commit = {
      message: latest.commit.message.split("\n")[0],
      date: latest.commit.author.date,
      url: latest.html_url,
    };
    localStorage.setItem(SITE_STATUS_CACHE_KEY, JSON.stringify({ commit, fetchedAt: Date.now() }));
    renderSiteStatus(frame, commit);
  } catch (e) {
    renderSiteStatusFallback(frame);
  }
}
