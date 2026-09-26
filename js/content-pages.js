/* =========================================================================
   content-pages.js — Give / Events / Watch
   ------------------------------------------------------------------------
   Vanilla JS, no dependencies. One init function per feature, all booted
   from a single DOMContentLoaded. Every block guards on its own elements,
   so a page that omits a component simply skips it.

       initImpact()   vertical impact carousel        (Give)
       initWays()     ways-to-give carousel + thumbs  (Give)
       initFeed()     calendar category filter        (Events)
       initFaq()      category filter + live search over one accordion

   Section reveals are NOT handled here: markup uses the site's own .rv
   class, which js/app.js observes and flips to .is-in, plus .fmk-reveal
   on each <section> for the section-level entrance.

   IMPORTANT: this file never writes a hover style, and never writes a
   colour, size or position. It toggles state classes (.is-active /
   .is-hidden / .is-empty) and CSS decides how they look. The one style it
   does write is documented at its call site.
   ========================================================================= */

(function () {
  "use strict";

  /* =======================================================================
     CONFIG — every tunable value for these three pages lives here.
     ===================================================================== */
  var CONFIG = {
    /* --- impact carousel (Give, section 05) --- */
    // ms between automatic advances. 0 disables autoplay entirely.
    impactAutoplay: 0,
    // wrap from the last slide back to the first
    impactLoop: true,

    /* --- ways-to-give carousel (Give, section 07) --- */
    waysLoop: true,
    // px of horizontal travel before a touch counts as a swipe. Below this
    // the gesture is treated as a tap and nothing moves.
    swipeThreshold: 45,
    // a drag that wanders more vertically than this ratio is a page scroll,
    // never a swipe — 1 means "must be more horizontal than vertical"
    swipeRatio: 1,
    // build the dimmed thumbnails of the inactive slides
    waysShowThumbs: true,

    /* --- calendar feed (Events, section 02) --- */
    // ms the feed spends faded out while the cards are swapped. Keep this
    // in step with the .feed opacity transition in events.css.
    feedFadeMs: 220,
    // ms between each surviving card's entrance — 0 disables the stagger
    feedStagger: 45,
    // the category the page starts on; must match a filter's data-cat
    feedDefaultCategory: "All",

    /* --- FAQ --- */
    // ms of typing quiet before the search re-filters
    faqSearchDebounce: 120,
    // the category every page starts on; must match a tab's data-cat
    faqDefaultCategory: "All",
    // close any open answer when it is filtered out of view
    faqCloseOnFilter: true
  };

  var REDUCED = window.matchMedia &&
                window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else { fn(); }
  }
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }
  function wrapIndex(i, len, loop) {
    if (loop) { return (i + len) % len; }
    return Math.max(0, Math.min(len - 1, i));
  }

  /* -----------------------------------------------------------------------
     SWIPE
     Left/right dragging for the two carousels, on touch and on mouse.

     Every listener is PASSIVE and nothing calls preventDefault. The element
     carries `touch-action: pan-y` in give.css instead, which tells the
     browser up front that vertical panning is its own and horizontal
     movement is ours. That keeps page scrolling completely native — a
     non-passive touchmove that conditionally blocks scrolling is the usual
     way carousels make a phone feel sticky, and this avoids it.

     The axis is decided once per gesture, on the first few px of movement,
     and never revisited: without that lock, a mostly-vertical scroll that
     drifts sideways at the end would fire a swipe.
     --------------------------------------------------------------------- */
  function addSwipe(el, onNext, onPrev) {
    if (!el) { return; }

    var startX = 0, startY = 0, axis = null, tracking = false;

    function begin(x, y) { startX = x; startY = y; axis = null; tracking = true; }

    function move(x, y) {
      if (!tracking || axis) { return; }
      var dx = Math.abs(x - startX), dy = Math.abs(y - startY);
      if (dx < 8 && dy < 8) { return; }          // too small to read yet
      axis = dx > dy * CONFIG.swipeRatio ? "x" : "y";
      if (axis === "x") { el.classList.add("is-dragging"); }
    }

    function end(x) {
      if (!tracking) { return; }
      var dx = x - startX;
      tracking = false;
      el.classList.remove("is-dragging");
      if (axis !== "x" || Math.abs(dx) < CONFIG.swipeThreshold) { return; }
      if (dx < 0) { onNext(); } else { onPrev(); }
    }

    el.addEventListener("touchstart", function (e) {
      var t = e.changedTouches[0]; begin(t.clientX, t.clientY);
    }, { passive: true });
    el.addEventListener("touchmove", function (e) {
      var t = e.changedTouches[0]; move(t.clientX, t.clientY);
    }, { passive: true });
    el.addEventListener("touchend", function (e) {
      end(e.changedTouches[0].clientX);
    }, { passive: true });
    el.addEventListener("touchcancel", function () {
      tracking = false; el.classList.remove("is-dragging");
    }, { passive: true });

    /* mouse drag, so the same gesture works on a laptop trackpad */
    el.addEventListener("mousedown", function (e) {
      if (e.button !== 0) { return; }
      begin(e.clientX, e.clientY);
    });
    window.addEventListener("mousemove", function (e) {
      if (tracking) { move(e.clientX, e.clientY); }
    });
    window.addEventListener("mouseup", function (e) {
      if (tracking) { end(e.clientX); }
    });
    /* a drag that ends on a link must not also follow it */
    el.addEventListener("click", function (e) {
      if (axis === "x") { e.preventDefault(); e.stopPropagation(); axis = null; }
    }, true);
  }

  /* Runs `fn` once the element has finished its entrance animation, or
     immediately if it has none. Used to strip direction classes so the next
     change starts clean. */
  function afterAnim(el, fn) {
    if (!el) { return; }
    var done = false;
    function go() { if (!done) { done = true; fn(); } }
    el.addEventListener("animationend", go, { once: true });
    setTimeout(go, 700);   // belt and braces if the animation never runs
  }

  /* =======================================================================
     1. IMPACT CAROUSEL
     Slides are the <article class="impact__slide"> elements in the markup.
     Add or remove one and everything else keeps working — the dots are
     generated from whatever is there.
     ===================================================================== */
  function initImpact() {
    var stage = document.querySelector("[data-impact-stage]");
    if (!stage) return;

    var slides = stage.querySelectorAll(".impact__slide");
    if (!slides.length) return;

    var dotsHost = document.querySelector("[data-impact-dots]");
    var index = 0;
    var timer = null;

    var dots = Array.prototype.map.call(slides, function (_, i) {
      if (!dotsHost) return null;
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", "Show impact " + (i + 1));
      b.addEventListener("click", function () { show(i, i > index ? 1 : -1); restart(); });
      dotsHost.appendChild(b);
      return b;
    });

    /* `dir` is +1 when moving forward, -1 back. It only sets which side the
       outgoing slides drift toward — the stage class the CSS reads. */
    function show(i, dir) {
      var prevIndex = index;
      index = wrapIndex(i, slides.length, CONFIG.impactLoop);
      if (index === prevIndex && dir) { return; }

      if (dir) {
        stage.classList.toggle("is-fromRight", dir > 0);
        stage.classList.toggle("is-fromLeft", dir < 0);
      }

      each(slides, function (s, n) {
        s.classList.toggle("is-active", n === index);
        s.setAttribute("aria-hidden", n === index ? "false" : "true");
      });
      each(dots, function (d, n) {
        if (!d) return;
        d.classList.toggle("is-active", n === index);
        d.setAttribute("aria-current", n === index ? "true" : "false");
      });
    }
    function go(step) { show(index + step, step); restart(); }

    function restart() {
      if (timer) { clearInterval(timer); timer = null; }
      // an autoplaying carousel is motion the reader did not ask for
      if (!CONFIG.impactAutoplay || REDUCED) return;
      timer = setInterval(function () { show(index + 1); }, CONFIG.impactAutoplay);
    }

    var prev = document.querySelector("[data-impact-prev]");
    var next = document.querySelector("[data-impact-next]");
    if (prev) prev.addEventListener("click", function () { go(-1); });
    if (next) next.addEventListener("click", function () { go(1); });

    /* drag the photo itself, left for the next story and right for the last */
    addSwipe(stage, function () { go(1); }, function () { go(-1); });

    /* arrow keys once the frame has focus */
    stage.setAttribute("tabindex", "0");
    stage.setAttribute("role", "group");
    stage.setAttribute("aria-label", "Impact stories");
    stage.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      if (e.key === "ArrowLeft")  { e.preventDefault(); go(-1); }
    });

    show(0);
    restart();
  }

  /* =======================================================================
     2. WAYS-TO-GIVE CAROUSEL
     One <article class="way"> per method. The dimmed thumbnails beside the
     stage are built from whichever slides are not currently showing.
     ===================================================================== */
  function initWays() {
    var stage = document.querySelector("[data-ways-stage]");
    if (!stage) return;

    var ways = stage.querySelectorAll(".way");
    if (!ways.length) return;

    var sidesHost = document.querySelector("[data-ways-sides]");
    var index = 0;

    function buildThumbs() {
      if (!sidesHost || !CONFIG.waysShowThumbs) return;
      sidesHost.innerHTML = "";
      each(ways, function (w, n) {
        if (n === index) return;
        var img = w.querySelector(".way__photo img");
        var title = w.querySelector(".way__title");
        var label = title ? title.textContent : "slide " + (n + 1);

        var thumb = document.createElement("button");
        thumb.type = "button";
        thumb.className = "ways__thumb";
        thumb.title = label;
        thumb.setAttribute("aria-label", "Show " + label);
        // an <img> rather than a background-image, so this stays markup the
        // stylesheet owns — no inline style is written anywhere
        if (img) {
          var t = document.createElement("img");
          t.src = img.getAttribute("src");
          t.alt = "";
          t.setAttribute("aria-hidden", "true");
          t.loading = "lazy";
          thumb.appendChild(t);
        }
        thumb.addEventListener("click", function () { show(n, n > index ? 1 : -1); });
        sidesHost.appendChild(thumb);
      });
    }

    /* The slides are display:none / flex, so there is nothing to transition
       between them — instead the incoming slide is animated in from the
       side it travelled, which is what gives the change its direction.
       `dir` is +1 forward, -1 back; omitted on first paint so the page does
       not animate on arrival. */
    function show(i, dir) {
      var prevIndex = index;
      index = wrapIndex(i, ways.length, CONFIG.waysLoop);
      if (index === prevIndex && dir) { return; }

      each(ways, function (w, n) {
        var on = n === index;
        w.classList.remove("is-fromLeft", "is-fromRight");
        w.classList.toggle("is-active", on);
        w.setAttribute("aria-hidden", on ? "false" : "true");
        if (on && dir && !REDUCED) {
          /* forward means the new slide arrives from the right */
          w.classList.add(dir > 0 ? "is-fromRight" : "is-fromLeft");
          afterAnim(w, function () { w.classList.remove("is-fromLeft", "is-fromRight"); });
        }
      });
      buildThumbs();
    }
    function go(step) { show(index + step, step); }

    var prev = document.querySelector("[data-ways-prev]");
    var next = document.querySelector("[data-ways-next]");
    if (prev) prev.addEventListener("click", function () { go(-1); });
    if (next) next.addEventListener("click", function () { go(1); });

    /* swipe the stage: drag left for the next method, right for the last */
    addSwipe(stage, function () { go(1); }, function () { go(-1); });

    stage.setAttribute("tabindex", "0");
    stage.setAttribute("role", "group");
    stage.setAttribute("aria-label", "Ways to give");
    stage.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      if (e.key === "ArrowLeft")  { e.preventDefault(); go(-1); }
    });

    show(0);
  }

  /* =======================================================================
     3. FAQ — category tabs + live search over ONE accordion
     The tabs look like the site's nav-tabs but are not Bootstrap tabs:
     filtering one accordion by data-cat avoids duplicating every question
     into five panes, and avoids the repeated ids that comes with.
     Bootstrap still owns the open/close of each answer.
     ===================================================================== */
  function initFaq() {
    var root = document.querySelector("[data-faq]");
    if (!root) return;

    var items = root.querySelectorAll(".accordion-item");
    var tabs = root.querySelectorAll(".nav-tabs .nav-link");
    var input = root.querySelector("[data-faq-input]");
    var empty = root.querySelector("[data-faq-empty]");
    var clearBtn = root.querySelector("[data-faq-clear]");
    if (!items.length) return;

    var category = CONFIG.faqDefaultCategory;
    var debounce = null;

    function collapse(item) {
      var panel = item.querySelector(".accordion-collapse");
      var btn = item.querySelector(".accordion-button");
      if (panel) panel.classList.remove("show");
      if (btn) {
        btn.classList.add("collapsed");
        btn.setAttribute("aria-expanded", "false");
      }
    }

    function apply() {
      var term = ((input && input.value) || "").trim().toLowerCase();
      var shown = 0;

      each(items, function (item) {
        var cat = item.getAttribute("data-cat") || "";
        var text = (item.textContent || "").toLowerCase();
        var visible = (category === "All" || cat === category) &&
                      (!term || text.indexOf(term) !== -1);
        item.classList.toggle("is-hidden", !visible);
        if (!visible && CONFIG.faqCloseOnFilter) collapse(item);
        if (visible) shown++;
      });

      if (empty) empty.classList.toggle("is-empty", shown === 0);
    }

    each(tabs, function (tab) {
      tab.addEventListener("click", function () {
        each(tabs, function (t) {
          t.classList.remove("active");
          t.setAttribute("aria-pressed", "false");
        });
        tab.classList.add("active");
        tab.setAttribute("aria-pressed", "true");
        category = tab.getAttribute("data-cat") || "All";
        apply();
      });
    });

    if (input) {
      input.addEventListener("input", function () {
        clearTimeout(debounce);
        debounce = setTimeout(apply, CONFIG.faqSearchDebounce);
      });
      // a type="search" clear (the little ✕) fires 'search', not 'input'
      input.addEventListener("search", apply);
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); clearTimeout(debounce); apply(); }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        if (input) input.value = "";
        category = CONFIG.faqDefaultCategory;
        each(tabs, function (t) {
          var on = (t.getAttribute("data-cat") || "All") === category;
          t.classList.toggle("active", on);
          t.setAttribute("aria-pressed", on ? "true" : "false");
        });
        apply();
      });
    }

    apply();
  }


  /* =======================================================================
     4. CALENDAR FEED FILTER  (Events, section 02)
     The category buttons carry data-cat and so does every event card; a
     card shows when its category matches, or when "All" is selected. Add
     or remove a card and nothing here needs touching.

     The swap is a crossfade rather than an instant re-flow: hiding a card
     changes the grid, so cards that survive the filter would otherwise jump
     to new positions mid-view. Fading the feed out, swapping while it is
     invisible and fading back means the movement is never seen. Surviving
     cards then stagger back in, which reads as the list rebuilding itself.
     ===================================================================== */
  function initFeed() {
    var filters = document.querySelector("[data-feed-filters]");
    var feed = document.querySelector("[data-feed]");
    if (!filters || !feed) { return; }

    var buttons = filters.querySelectorAll("[data-cat]");
    var cards = feed.querySelectorAll(".event");
    var empty = document.querySelector("[data-feed-empty]");
    if (!buttons.length || !cards.length) { return; }

    var category = CONFIG.feedDefaultCategory;
    var busy = false;

    function apply() {
      var shown = 0;
      each(cards, function (card) {
        var visible = category === "All" || card.getAttribute("data-cat") === category;
        card.classList.toggle("is-hidden", !visible);
        if (visible) {
          card.style.animationDelay = REDUCED ? "" : (shown * CONFIG.feedStagger) + "ms";
          card.classList.add("is-entering");
          shown++;
        } else {
          card.classList.remove("is-entering");
          card.style.animationDelay = "";
        }
      });
      if (empty) { empty.hidden = shown > 0; }
    }

    function select(btn) {
      var next = btn.getAttribute("data-cat");
      if (next === category || busy) { return; }
      category = next;

      /* the pressed button updates at once — it is the control, not the
         content, and must acknowledge the click immediately */
      each(buttons, function (b) {
        var on = b === btn;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });

      if (REDUCED) { apply(); return; }

      busy = true;
      feed.classList.add("is-filtering");
      setTimeout(function () {
        apply();
        /* one frame for the new set to lay out, then fade the feed back */
        requestAnimationFrame(function () {
          feed.classList.remove("is-filtering");
          busy = false;
        });
      }, CONFIG.feedFadeMs);
    }

    each(buttons, function (btn) {
      btn.setAttribute("aria-pressed", btn.classList.contains("is-active") ? "true" : "false");
      btn.addEventListener("click", function () { select(btn); });
    });

    apply();
    /* the first paint should not animate every card in — the entrance is
       for filter changes, not for arriving on the page */
    each(cards, function (card) {
      card.classList.remove("is-entering");
      card.style.animationDelay = "";
    });
  }

  ready(function () {
    initImpact();
    initWays();
    initFeed();
    initFaq();
  });

})();
