/* =========================================================================
   app.js — behaviour for the four scroll-animated sections.

   index.html already loaded this file, but it did not exist (404), which is
   why the Story panels snapped, the serve cards never opened, and every
   .rv element sat still. Nothing here writes copy or image paths — all of
   that lives in the markup so the sections can be made dynamic later.

     1. reveal()      .rv  -> .is-in  on scroll
     2. story()       #section-fellowship panel swap
     3. comeStats()   "Come As You Are" rows <-> photo stack
     4. serveCards()  "Serving & Missions" cards

   Timings are declared in css/style.css (:root). Keep STORY_SWAP_MS below
   in step with --story-swap.
   ========================================================================= */

(function () {
  'use strict';

  var REDUCED = window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var STORY_SWAP_MS = 850;   /* mirrors --story-swap */
  var STORY_AUTO_MS = 7000;

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  /* forces the browser to apply a class before the next one is added, so a
     panel can be parked off-stage without animating its way there */
  function reflow(el) { return el.offsetWidth; }


  /* =======================================================================
     1. SCROLL REVEAL
     .rv elements start offset and transparent; .is-in puts them home.
     Unlike the older .reveal observer on the page this does NOT remove the
     class on exit — replaying the entrance every time you scroll back past
     an element is what made the page feel jumpy.
     ===================================================================== */
  function reveal() {
    var els = document.querySelectorAll('.rv');
    if (!els.length) return;

    if (REDUCED || !('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(els, function (el) { el.classList.add('is-in'); });
      return;
    }

    var pending = Array.prototype.slice.call(els);

    function show(el) {
      el.classList.add('is-in');
      io.unobserve(el);
      var at = pending.indexOf(el);
      if (at > -1) pending.splice(at, 1);
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) show(entry.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });

    pending.forEach(function (el) { io.observe(el); });

    /* Safety net. An IntersectionObserver only samples on rendering frames,
       so a region that scrolls past between two frames — a fast flick, an
       anchor jump, or the layout shifting as lazy images land — never
       reports as intersecting, and its content would stay at opacity 0 for
       good. Anything now ABOVE the viewport is shown immediately: it is
       off-screen, so there is no animation to lose. */
    var queued = false;
    function sweep() {
      queued = false;
      if (!pending.length) {
        window.removeEventListener('scroll', onScroll);
        return;
      }
      pending.slice().forEach(function (el) {
        if (el.getBoundingClientRect().bottom < 0) show(el);
      });
    }
    function onScroll() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(sweep);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('load', sweep);
  }


  /* =======================================================================
     2. STORY  (#section-fellowship)
     Panels are already in the DOM, stacked in a grid. A swap moves the
     outgoing panel out one side while the incoming panel comes in from the
     other, both on the same curve and in the same frame — one continuous
     movement rather than a fade-out followed by a fade-in.
     ===================================================================== */
  function story() {
    var section = document.querySelector('.story');
    if (!section) return;

    var copies = section.querySelectorAll('.story__copy-stage > .story__copy');
    var frames = section.querySelectorAll('.story__frames-stage > .story__frames');
    var total = Math.min(copies.length, frames.length);
    if (total < 2) return;

    var index = 0;
    var busy = false;
    var timer = null;
    var visible = false;
    var hovered = false;

    /* -- park every panel that is not on stage --------------------------- */
    function park(el, dir) {
      el.classList.add('is-instant');
      el.classList.remove('is-active', 'is-prev', 'is-next');
      el.classList.add(dir > 0 ? 'is-next' : 'is-prev');
      reflow(el);
      el.classList.remove('is-instant');
    }

    function stage(el) {
      el.classList.remove('is-prev', 'is-next');
      el.classList.add('is-active');
    }

    /* dir: 1 = travelling forward, -1 = backward */
    function go(to, dir) {
      if (busy || to === index) return;
      busy = true;

      var outPair = [copies[index], frames[index]];
      var inPair = [copies[to], frames[to]];

      outPair.forEach(function (el) {
        el.classList.remove('is-active');
        el.classList.add(dir > 0 ? 'is-prev' : 'is-next');   // exits behind
      });

      inPair.forEach(function (el) {
        park(el, dir > 0 ? 1 : -1);   // arrives from the opposite edge
        stage(el);
      });

      index = to;
      setTimeout(function () { busy = false; }, STORY_SWAP_MS);
    }

    function next() { go((index + 1) % total, 1); }
    function prev() { go((index - 1 + total) % total, -1); }

    /* -- arrows ---------------------------------------------------------- */
    var prevBtn = section.querySelector('[data-go="story:prev"]');
    var nextBtn = section.querySelector('[data-go="story:next"]');
    if (prevBtn) prevBtn.addEventListener('click', function () { prev(); restart(); });
    if (nextBtn) nextBtn.addEventListener('click', function () { next(); restart(); });

    /* -- autoplay --------------------------------------------------------
       Only runs while the section is actually on screen and the pointer is
       elsewhere, so it never burns frames (or advances unseen) in a long
       page like this one. */
    function tick() {
      if (visible && !hovered && !document.hidden) next();
    }
    function restart() {
      clearInterval(timer);
      if (REDUCED) return;
      timer = setInterval(tick, STORY_AUTO_MS);
    }

    section.addEventListener('mouseenter', function () { hovered = true; });
    section.addEventListener('mouseleave', function () { hovered = false; });
    section.addEventListener('focusin', function () { hovered = true; });
    section.addEventListener('focusout', function () { hovered = false; });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
      }, { threshold: 0.25 }).observe(section);
    } else {
      visible = true;
    }

    /* keyboard, when focus is anywhere inside the section */
    section.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { next(); restart(); }
      if (e.key === 'ArrowLeft') { prev(); restart(); }
    });

    /* -- initial state ---------------------------------------------------- */
    for (var j = 0; j < total; j++) {
      if (j === 0) {
        stage(copies[j]);
        stage(frames[j]);
      } else {
        park(copies[j], 1);
        park(frames[j], 1);
      }
    }
    restart();
  }


  /* =======================================================================
     3. COME AS YOU ARE
     Hovering a stat row brings up its photo. The outgoing photo keeps
     .is-leaving for one transition, so it carries on drifting underneath
     the incoming one instead of blinking out.
     ===================================================================== */
  function comeStats() {
    var rows = document.querySelectorAll('.come__row');
    var photos = document.querySelectorAll('.come__photo');
    if (!rows.length || !photos.length) return;

    var current = -1;

    function select(i) {
      if (i === current) return;

      Array.prototype.forEach.call(rows, function (row, n) {
        row.classList.toggle('is-active', n === i);
      });

      Array.prototype.forEach.call(photos, function (photo, n) {
        photo.classList.remove('is-leaving');
        if (n === i) {
          photo.classList.add('is-active');
        } else if (n === current) {
          photo.classList.remove('is-active');
          photo.classList.add('is-leaving');
        } else {
          photo.classList.remove('is-active');
        }
      });

      current = i;
    }

    Array.prototype.forEach.call(rows, function (row, i) {
      row.setAttribute('tabindex', '0');
      row.addEventListener('mouseenter', function () { select(i); });
      row.addEventListener('focus', function () { select(i); });
      /* touch: no hover, so a tap has to do the work */
      row.addEventListener('click', function () { select(i); });
    });

    var wrap = document.querySelector('.come__body');
    if (wrap) wrap.addEventListener('mouseleave', function () { select(0); });

    select(0);
  }


  /* =======================================================================
     4. SERVING & MISSIONS cards + happening/people hover cards
     Hover (or tap, or keyboard focus) opens one card at a time.
     ===================================================================== */
  function bindHoverCards(selector, touchRootSelector) {
    var cards = document.querySelectorAll(selector);
    if (!cards.length) return;

    var canHover = !window.matchMedia || window.matchMedia('(hover: hover)').matches;

    function open(card) {
      Array.prototype.forEach.call(cards, function (c) {
        c.classList.toggle('is-active', c === card);
      });
    }
    function closeAll() {
      Array.prototype.forEach.call(cards, function (c) { c.classList.remove('is-active'); });
    }

    Array.prototype.forEach.call(cards, function (card) {
      card.setAttribute('tabindex', '0');

      if (canHover) {
        card.addEventListener('mouseenter', function () { open(card); });
        card.addEventListener('mouseleave', closeAll);
      }

      card.addEventListener('focusin', function () { open(card); });

      /* tap toggles, so the text is reachable without a pointer */
      card.addEventListener('click', function (e) {
        if (e.target.closest('a')) return;          // let the CTA through
        if (card.classList.contains('is-active')) {
          if (!canHover) closeAll();
        } else {
          open(card);
        }
      });
    });

    /* on touch, open the first card once the row scrolls in so the section
       is not a wall of unexplained photos */
    if (!canHover && touchRootSelector && 'IntersectionObserver' in window) {
      var row = document.querySelector(touchRootSelector);
      if (row) {
        var io = new IntersectionObserver(function (entries) {
          if (!entries[0].isIntersecting) return;
          open(cards[0]);
          io.disconnect();
        }, { threshold: 0.4 });
        io.observe(row);
      }
    }
  }

  function serveCards() {
    bindHoverCards('.serve-card', '.outreach__cards');
  }

  function sliderHoverCards() {
    bindHoverCards('.happing-sefction .hover-card', '.happing-sefction');
    bindHoverCards('.pepoleslide .hover-card', '.pepoleslide');
  }


  ready(function () {
    reveal();
    story();
    comeStats();
    serveCards();
    sliderHoverCards();
  });

})();
