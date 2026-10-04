// Inbox Aggregator's home page tile: made-up emails drop out of three
// color-coded accounts into one merged list, newest on top. js/home-tiles.js
// loads this once the tile scrolls into view (and provides isReducedMotion()).
// The app itself lives in its own repo and runs at demo.inbox.aaroncheung.me;
// nothing here touches it.

const HOME_INBOX_TICK_MS = 1800;
const HOME_INBOX_ROWS = 3;
const HOME_INBOX_ACCOUNTS = [
  { label: 'work', color: 'var(--clr-blue)' },
  { label: 'school', color: 'var(--clr-green)' },
  { label: 'personal', color: 'var(--clr-purple)' },
];
const HOME_INBOX_EMAILS = [
  [0, 'Interview Thu 2pm'],
  [1, 'HW 4 graded'],
  [2, 'Your order shipped'],
  [0, 'Q3 roadmap review'],
  [2, 'Flight check-in open'],
  [1, 'Office hours moved'],
  [0, 'Standup notes'],
  [2, 'Rent reminder'],
  [1, 'Lab report due Fri'],
];

function startInboxTile(frame) {
  if (!frame) return;
  // Rebuilt from scratch every time, same reason as startHeatmapTile().
  frame.innerHTML = '';

  const chips = document.createElement('div');
  chips.className = 'tile-inbox-chips';
  const chipEls = HOME_INBOX_ACCOUNTS.map(({ label, color }) => {
    const chip = document.createElement('span');
    chip.className = 'tile-inbox-chip';
    chip.style.setProperty('--acct', color);
    chip.textContent = label;
    chips.appendChild(chip);
    return chip;
  });

  const list = document.createElement('div');
  list.className = 'tile-inbox-list';
  frame.append(chips, list);

  function makeRow([acct, subject]) {
    const row = document.createElement('div');
    row.className = 'tile-inbox-row';
    row.style.setProperty('--acct', HOME_INBOX_ACCOUNTS[acct].color);
    row.textContent = subject;
    return row;
  }

  // Start already full, so the tile never sits empty.
  let next = 0;
  for (; next < HOME_INBOX_ROWS; next++) list.prepend(makeRow(HOME_INBOX_EMAILS[next]));

  const timer = setInterval(() => {
    if (!document.body.contains(frame)) { clearInterval(timer); return; }
    if (isReducedMotion() || document.hidden) return;
    const email = HOME_INBOX_EMAILS[next % HOME_INBOX_EMAILS.length];
    next++;

    const chip = chipEls[email[0]];
    chip.classList.remove('tile-inbox-chip-ping');
    void chip.offsetWidth; // restart the ping animation
    chip.classList.add('tile-inbox-chip-ping');

    const row = makeRow(email);
    row.classList.add('tile-inbox-row-new');
    list.prepend(row);
    while (list.children.length > HOME_INBOX_ROWS) list.lastElementChild.remove();
  }, HOME_INBOX_TICK_MS);
}
