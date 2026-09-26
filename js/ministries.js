/* =========================================================================
   Missional Church One — Ministries page interactions
   -------------------------------------------------------------------------
   initMarquee()    03 · continuous category card carousel
   initDirectory()  04 · ministry directory panel/photo switcher
   initFlips()      07 · tap-to-flip, desktop only (see the note there)
   initRail()       08 · life-stage rail slider with arrow buttons
   initAccordion()  11 · .bgactive highlight on the open FAQ item

   This file holds NO page copy and NO image paths — every string the visitor
   reads lives in ministries.html. Here we only read the DOM, clone nodes and
   toggle state classes (.is-active / .is-flipped / .bgactive); the CSS
   decides what those look like. It never writes a hover style.

   Section reveals are not handled here: the markup uses the site's own .rv
   class, which js/app.js observes and flips to .is-in.
   ========================================================================= */

(function () {
  "use strict";

  /* Every tunable value for this page lives here. */
  var CONFIG = {
    /* 03 categories: seconds for one full pass of the card strip. */
    marqueeSeconds: 52,
    /* 08 life stage: extra breathing room kept at the rail edge, in px. */
    railEdge: 40,
    /* Below this width the flip cards do not flip — both faces are shown
       stacked instead, because a touch device has no hover. MIRRORED in
       ministries-responsive.css (the 992 breakpoint); change both. */
    flipDisabledBelow: 992
  };

  var REDUCED = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function each(list, fn) { Array.prototype.forEach.call(list, fn); }

  /* =======================================================================
     03 · CATEGORY CARD CAROUSEL
     The cards are written once in the markup; we clone the strip so the
     loop is seamless, then translate the track. Hovering pauses it.
     ===================================================================== */
  function initMarquee() {
    var root = document.querySelector("[data-mn-marquee]");
    if (!root) { return; }

    var track = root.querySelector("[data-mn-marquee-track]");
    if (!track || !track.children.length) { return; }

    /* Duplicate the strip once. The clones are decoration, so they are
       hidden from assistive tech and taken out of the tab order. */
    var originals = Array.prototype.slice.call(track.children);
    each(originals, function (card) {
      var clone = card.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      clone.setAttribute("tabindex", "-1");
      track.appendChild(clone);
    });

    if (REDUCED) { return; }

    var offset = 0;
    var last = null;
    var paused = false;
    var half = 0;

    function measure() {
      half = track.scrollWidth / 2;
    }

    function step(now) {
      if (!half) { measure(); }
      if (last === null) { last = now; }
      var delta = (now - last) / 1000;
      last = now;

      if (!paused && half) {
        offset += (half / CONFIG.marqueeSeconds) * delta;
        if (offset >= half) { offset -= half; }
        track.style.transform = "translate3d(" + (-offset) + "px, 0, 0)";
      }
      window.requestAnimationFrame(step);
    }

    root.addEventListener("mouseenter", function () { paused = true; });
    root.addEventListener("mouseleave", function () { paused = false; });
    root.addEventListener("focusin", function () { paused = true; });
    root.addEventListener("focusout", function () { paused = false; });
    window.addEventListener("resize", measure);

    measure();
    window.requestAnimationFrame(step);
  }

  /* =======================================================================
     04 · MINISTRY DIRECTORY
     One row, one panel and one photo share a data-mn-index; hovering,
     clicking or focusing a row brings its trio forward.
     ===================================================================== */
  function initDirectory() {
    var stage = document.querySelector("[data-mn-directory]");
    if (!stage) { return; }

    var rows = stage.querySelectorAll("[data-mn-row]");
    var panels = stage.querySelectorAll("[data-mn-panel]");
    var photos = stage.querySelectorAll("[data-mn-photo]");

    function setActive(index) {
      [rows, panels, photos].forEach(function (set) {
        each(set, function (el) {
          var on = el.getAttribute("data-mn-index") === index;
          el.classList.toggle("is-active", on);
          if (el.hasAttribute("data-mn-row")) {
            el.setAttribute("aria-selected", on ? "true" : "false");
          }
        });
      });
    }

    each(rows, function (row) {
      var index = row.getAttribute("data-mn-index");
      ["mouseenter", "click", "focus"].forEach(function (evt) {
        row.addEventListener(evt, function () { setActive(index); });
      });
    });
  }

  /* =======================================================================
     07 · INCLUSIVE FLIP CARDS
     Desktop flips on hover/focus in CSS; this adds click and Enter/Space
     for the keyboard and for a hybrid touch-screen laptop.

     Below CONFIG.flipDisabledBelow the cards do not flip at all — the CSS
     stacks both faces so the copy is permanently visible, since a touch
     device has no hover and hidden copy would simply be lost. The guard
     below keeps the class off at those widths so nothing can desync.
     ===================================================================== */
  function initFlips() {
    var wide = window.matchMedia("(min-width: " + (CONFIG.flipDisabledBelow + 1) + "px)");
    var cards = document.querySelectorAll("[data-mn-flip]");

    /* Where the card does not flip, it is not a control: drop the button
       role and the tab stop so the keyboard is not sent to a dead widget.
       Re-applied if the window is resized back over the breakpoint. */
    function syncRoles() {
      each(cards, function (card) {
        if (wide.matches) {
          card.setAttribute("role", "button");
          card.setAttribute("tabindex", "0");
        } else {
          card.removeAttribute("role");
          card.removeAttribute("tabindex");
          card.classList.remove("is-flipped");
        }
      });
    }
    syncRoles();
    if (wide.addEventListener) { wide.addEventListener("change", syncRoles); }

    each(cards, function (card) {
      function toggle() {
        if (!wide.matches) { return; }
        card.classList.toggle("is-flipped");
      }

      card.addEventListener("click", toggle);
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          toggle();
        }
      });
    });
  }

  /* =======================================================================
     08 · LIFE-STAGE RAIL SLIDER
     Scrolls by whole cards, a screenful at a time, and greys out an arrow
     once that end is reached.
     ===================================================================== */
  function initRail() {
    var rail = document.querySelector("[data-mn-rail]");
    if (!rail) { return; }

    var prev = document.querySelector("[data-mn-rail-prev]");
    var next = document.querySelector("[data-mn-rail-next]");

    function pitch() {
      var card = rail.firstElementChild;
      if (!card) { return 300; }
      var styles = window.getComputedStyle(rail);
      var gap = parseFloat(styles.columnGap || styles.gap) || 16;
      return card.getBoundingClientRect().width + gap;
    }

    function page(direction) {
      var unit = pitch();
      var perView = Math.max(1, Math.floor((rail.clientWidth - CONFIG.railEdge) / unit));
      var max = rail.scrollWidth - rail.clientWidth;
      var target = rail.scrollLeft + direction * perView * unit;
      rail.scrollTo({
        left: Math.min(max, Math.max(0, target)),
        behavior: REDUCED ? "auto" : "smooth"
      });
    }

    function syncArrows() {
      var max = rail.scrollWidth - rail.clientWidth - 2;
      if (prev) { prev.disabled = rail.scrollLeft <= 0; }
      if (next) { next.disabled = rail.scrollLeft >= max; }
    }

    if (prev) { prev.addEventListener("click", function () { page(-1); }); }
    if (next) { next.addEventListener("click", function () { page(1); }); }
    rail.addEventListener("scroll", syncArrows);
    window.addEventListener("resize", syncArrows);
    syncArrows();
  }

  /* =======================================================================
     11 · FAQ ACCORDION
     Bootstrap drives the collapse itself; all this adds is the .bgactive
     highlight on the open item, exactly as About Us does. That page keeps
     the same code in an inline <script>; here it lives in the page's own
     JS file, which is where the spec puts it.
     ===================================================================== */
  function initAccordion() {
    each(document.querySelectorAll(".accordion"), function (accordion) {
      each(accordion.querySelectorAll(".accordion-collapse"), function (panel) {
        panel.addEventListener("show.bs.collapse", function () {
          each(accordion.querySelectorAll(".accordion-item"), function (item) {
            item.classList.remove("bgactive");
          });
          this.closest(".accordion-item").classList.add("bgactive");
        });
        panel.addEventListener("hide.bs.collapse", function () {
          this.closest(".accordion-item").classList.remove("bgactive");
        });
      });
    });
  }

  function start() {
    initMarquee();
    initDirectory();
    initFlips();
    initRail();
    initAccordion();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
