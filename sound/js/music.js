// Eases wheel-driven horizontal scroll toward a target via rAF (raw deltaY
// application feels stiff/jumpy). The nav links below reuse this same
// target/tick loop via window.recordScrollToX instead of calling their own
// scrollTo() — two systems both animating scrollLeft fight each other.
document.addEventListener('DOMContentLoaded', function () {
  var scroller = document.querySelector('.record .scroller');
  if (!scroller) return;
  // Mobile is a plain vertical page (see music.css) -- this rig doesn't apply there.
  if (window.matchMedia('(max-width: 760px)').matches) return;

  var EASE = 0.15; // fraction of the remaining distance covered per frame
  var target = scroller.scrollLeft;
  var raf = null;
  var lastWritten = null; // scrollLeft value tick() itself most recently set

  function tick() {
    var current = scroller.scrollLeft;
    var diff = target - current;
    var next = Math.abs(diff) < 0.5 ? target : current + diff * EASE;
    lastWritten = Math.round(next);
    scroller.scrollLeft = next;
    if (Math.abs(diff) < 0.5) {
      raf = null;
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  function scrollToX(x) {
    var maxScroll = scroller.scrollWidth - scroller.clientWidth;
    target = Math.max(0, Math.min(maxScroll, x));
    if (raf === null) raf = requestAnimationFrame(tick);
  }

  scroller.addEventListener('scroll', function () {
    var current = scroller.scrollLeft;
    if (lastWritten !== null && Math.abs(current - lastWritten) <= 1) return;
    if (raf !== null) {
      cancelAnimationFrame(raf);
      raf = null;
    }
    target = current;
  }, { passive: true });

  scroller.addEventListener('wheel', function (e) {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      scrollToX(target + e.deltaY);
      e.preventDefault();
    }
  }, { passive: false });

  // Exposed so the quick-nav block below drives the same animation
  // system instead of starting a second, competing one.
  window.recordScrollToX = scrollToX;
});

// svh can get stuck at the largest value seen during a resize (esp.
// DevTools device toolbar) and never shrink back -- drive height from
// innerHeight instead. min-height must be reset too, since CSS
// min-height: 100svh would otherwise keep forcing the box back up to the stale value.
document.addEventListener('DOMContentLoaded', function () {
  var record = document.querySelector('.record');
  if (!record) return;
  // Mobile lets .record grow with content and the page scroll naturally.
  if (window.matchMedia('(max-width: 760px)').matches) return;

  function syncHeight() {
    record.style.minHeight = window.innerHeight + 'px';
    record.style.height = window.innerHeight + 'px';
  }

  syncHeight();
  window.addEventListener('resize', syncHeight);
});

// Rail nav -- each .chapter-rail repeats the full chapter list with its own
// entries expanded (see music.css); links are a flat id-based jump map.
document.addEventListener('DOMContentLoaded', function () {
  var scroller = document.querySelector('.record .scroller');
  if (!scroller) return;
  // Mobile uses plain anchor scrolling (see scroll-margin-top in music.css) instead of this offset math.
  if (window.matchMedia('(max-width: 760px)').matches) return;

  var jumpLinks = Array.prototype.slice.call(document.querySelectorAll('.record [data-jump]'));
  if (!jumpLinks.length) return;

  jumpLinks.forEach(function (link) {
    link.addEventListener('click', function (e) {
      var target = document.getElementById(link.dataset.jump);
      if (!target) return;
      e.preventDefault();
      // offsetLeft alone would land the target under the sticky rail;
      // subtract the chapter's rail width (+16px gap) so it lands just clear of it.
      var chapter = target.closest('.chapter');
      var rail = chapter ? chapter.querySelector('.chapter-rail') : null;
      var x = target.offsetLeft - (rail ? rail.offsetWidth + 16 : 0);
      if (window.recordScrollToX) {
        window.recordScrollToX(x);
      } else {
        scroller.scrollTo({ left: x, behavior: 'smooth' });
      }
    });
  });

  // Nearest-panel match (not exact offsetLeft) so an eased scroll landing a
  // pixel or two short still resolves correctly.
  var panels = Array.prototype.slice.call(scroller.querySelectorAll('.panel'));
  var subLinks = Array.prototype.slice.call(document.querySelectorAll('.record .rail-subindex a'));

  function syncActiveEntry() {
    var pos = scroller.scrollLeft;
    var closestId = null;
    var closestDist = Infinity;
    panels.forEach(function (panel) {
      if (!panel.id) return;
      var dist = Math.abs(panel.offsetLeft - pos);
      if (dist < closestDist) {
        closestDist = dist;
        closestId = panel.id;
      }
    });
    subLinks.forEach(function (link) {
      link.parentElement.classList.toggle('is-active', link.dataset.jump === closestId);
    });
  }

  scroller.addEventListener('scroll', syncActiveEntry, { passive: true });
  syncActiveEntry();
});

// Inverts each chapter rail's tone to match whichever entry is currently
// alongside it (nearest panel by offsetLeft, same reasoning as syncActiveEntry above).
document.addEventListener('DOMContentLoaded', function () {
  var scroller = document.querySelector('.record .scroller');
  if (!scroller) return;
  // No sticky rail on mobile (see music.css), so there's nothing to keep in sync.
  if (window.matchMedia('(max-width: 760px)').matches) return;

  var chapters = Array.prototype.slice.call(scroller.querySelectorAll('.chapter'));
  if (!chapters.length) return;

  var entries = chapters.map(function (chapter) {
    return {
      rail: chapter.querySelector('.chapter-rail'),
      panels: Array.prototype.slice.call(chapter.querySelectorAll('.panel'))
    };
  });

  function syncRailTones() {
    var pos = scroller.scrollLeft;
    entries.forEach(function (entry) {
      if (!entry.rail || !entry.panels.length) return;
      var closest = entry.panels[0];
      var closestDist = Infinity;
      entry.panels.forEach(function (panel) {
        var dist = Math.abs(panel.offsetLeft - pos);
        if (dist < closestDist) {
          closestDist = dist;
          closest = panel;
        }
      });
      entry.rail.classList.toggle('is-dark', closest.classList.contains('panel--dark'));
    });
  }

  scroller.addEventListener('scroll', syncRailTones, { passive: true });
  syncRailTones();
});

// align-items: baseline pins the running number to whichever line the
// title's baseline lands on -- only the first line for a wrapped title,
// leaving the second line unbalanced. Shifting the h2 up by one line-height
// swaps which line hits that baseline. Must use transform, not margin-top:
// under baseline alignment, margin is part of what's measured to find the
// baseline, so a negative margin just cancels itself out.
document.addEventListener('DOMContentLoaded', function () {
  var heads = Array.prototype.slice.call(document.querySelectorAll('.record .entry-copy h2'));
  if (!heads.length) return;

  function syncTitleShift() {
    heads.forEach(function (h2) {
      var entryHead = h2.closest('.entry-head');
      if (!entryHead) return;
      // Reset both before measuring -- an already-adjusted margin-bottom
      // would throw off the "base" value read below on a second pass
      // (e.g. after a resize un-wraps a title that was wrapped before).
      h2.style.transform = '';
      entryHead.style.marginBottom = '';
      var lineHeight = parseFloat(getComputedStyle(h2).lineHeight);
      var wrapped = h2.getBoundingClientRect().height > lineHeight * 1.4;
      if (!wrapped) return;
      h2.style.transform = 'translateY(-' + lineHeight + 'px)';
      // transform only moves painted pixels, not the layout box, so it
      // leaves a gap below; pulling in entry-head's margin-bottom by the
      // same amount is a real layout change that closes it.
      var baseMargin = parseFloat(getComputedStyle(entryHead).marginBottom) || 0;
      entryHead.style.marginBottom = (baseMargin - lineHeight) + 'px';
    });
  }

  syncTitleShift();
  window.addEventListener('resize', syncTitleShift);
  // Re-run once Fraunces actually loads -- a title that wraps under the
  // fallback serif may not wrap under Fraunces, or vice versa.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(syncTitleShift);
  }
});
