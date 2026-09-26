/* =========================================================================
   journey-serve.js — Faith Journey + Serve
   ------------------------------------------------------------------------
   Vanilla JS, no dependencies. One init function per feature, all booted
   from a single DOMContentLoaded. Every block guards on its own elements,
   so a page that omits a component simply skips it — which is how one file
   serves both pages.

       initPathway()   discipleship spotlight, autoplay   (Faith Journey)
       initPrayer()    click a mini card to swap the photo (Faith Journey)
       initDisciple()  disciple-making photo pair, autoplay (Faith Journey)
       initTracks()    "three ways in" featured card       (Serve)
       initGlobal()    Serve Global tabs + side panels     (Serve)
       initDisc()      "why it's discipleship" accordion   (Serve)
       initFaq()       category filter + live search over one accordion
                       — runs once per [data-faq] root, so both pages' FAQs
                       are the same code with different markup roots.

   Section reveals are NOT handled here: the markup uses the site's own .rv
   class, which js/app.js observes and flips to .is-in.

   IMPORTANT: this file never writes a hover style, and never writes a
   colour, size or position. It toggles state classes (.is-active /
   .is-open / .is-hidden) and CSS decides how they look. The two exceptions
   are documented at their call sites: the <img> src swaps, which are
   content rather than style, and the SMIL pause for reduced motion.
   ========================================================================= */

(function () {
  "use strict";

  /* =======================================================================
     CONFIG — every tunable value for these two pages lives here.
     ===================================================================== */
  var CONFIG = {
    /* --- Faith Journey, section 06: discipleship pathway --- */
    // ms between automatic advances. 0 disables autoplay entirely.
    pathwayAutoplay: 3500,

    /* --- Faith Journey, section 09: disciple-making photo pair --- */
    discipleAutoplay: 4200,

    /* --- Serve, section 03: "three ways in" --- */
    // wrap from the last slide back to the first
    tracksLoop: true,

    /* --- FAQ (both pages) --- */
    // ms of typing quiet before the search re-filters
    faqSearchDebounce: 120,
    // the category every page starts on; must match a chip's data-faq-cat
    faqDefaultCategory: "All",
    // close any open answer when it is filtered out of view
    faqCloseOnFilter: true
  };

  /* The carousel copy lives here rather than in the markup because each
     slide replaces several fields at once. Swap an image by editing the
     path below, exactly as serve-main/README.md describes. */
  var TRACKS = [
    {
      img: "serve-main/images/tracks/track-01-serve-the-church.jpg",
      alt: "Hospitality volunteers welcoming guests at Missional Church One Baptist Church",
      title: "Sunday ministry teams",
      icon: "fas fa-church",
      badge: "01 · Serve the Church",
      desc: "Hospitality, kids & students, worship, media & production, and prayer — many serve one hour and worship the other.",
      href: "#church",
      cta: "Explore teams"
    },
    {
      img: "serve-main/images/tracks/track-02-serve-local.jpg",
      alt: "Church volunteers serving the Missional Church One community through local outreach",
      title: "Outreach across Missional Church One ",
      icon: "fas fa-hands-helping",
      badge: "02 · Serve Local",
      desc: "The warming shelter, Finch Elementary, neighbors facing housing insecurity, and Seniors Helping Seniors",
      href: "#local",
      cta: "Serve your city"
    },
    {
      img: "serve-main/images/tracks/track-03-serve-global.jpg",
      alt: "Missional Church One Baptist Church mission team serving through global missions",
      title: "Missions &amp; mission trips",
      icon: "fas fa-globe-americas",
      badge: "03 · Serve Global",
      desc: "Pray, Give, Go with the Beyond season — serving alongside the missionaries and partners we support.",
      href: "#global",
      cta: "Go global"
    }
  ];

  var GLOBAL = [
    {
      title: "Pray for the nations",
      icon: "fas fa-hands",
      desc: "Throughout the year, Missional Church One partners with missionaries, church planters, and trusted ministry partners around the world while sending teams to serve alongside them through mission trips.",
      img: "serve-main/images/global/global-01-pray.jpg",
      alt: "The Missional Church One choir and worship team leading worship",
      pos: "center 30%"
    },
    {
      title: "Give to send others",
      icon: "fas fa-gift",
      desc: "Each November, our Beyond emphasis invites our church family to look beyond ourselves through three simple words: Pray. Give. Go.",
      img: "serve-main/images/global/global-02-give.jpg",
      alt: "A young family at a Missional Church One gathering",
      pos: "center 30%"
    },
    {
      title: "Go when God says go",
      icon: "fas fa-plane-departure",
      desc: "Whether you're called to pray, give, or go, we'll help you discover how you can be part of what God is doing around the world.",
      img: "serve-main/images/global/global-03-go.png",
      alt: "A Missional Church One mission team in front of a Hope Brings Change mural",
      pos: "center 40%"
    }
  ];

  /* One photo per accordion item in Serve → "Why it's discipleship". */
  var DISC_PHOTOS = [
    { img: "serve-main/images/discipleship/accordion-01-third-movement.jpg", pos: "center 30%" },
    { img: "serve-main/images/discipleship/accordion-02-gifts-discovered.jpg", pos: "center 40%" },
    { img: "serve-main/images/discipleship/accordion-03-leaders.jpg", pos: "center 35%" },
    { img: "serve-main/images/discipleship/accordion-04-two-lives.jpg", pos: "center 30%" },
    { img: "serve-main/images/discipleship/accordion-05-start-small.jpg", pos: "center 40%" }
  ];

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
  /* Swaps a Font Awesome icon without disturbing the component class that
     sits alongside it (e.g. "fas fa-plus sv-disc-item__sign"). */
  function setIcon(el, icon, keep) {
    if (el) { el.className = icon + (keep ? " " + keep : ""); }
  }

  /* -----------------------------------------------------------------------
     CROSSFADE
     The Serve carousels replace a photo and several text fields in the same
     tick, which reads as a flicker if done raw. crossfade() fades the given
     elements out, runs the swap while they are invisible, then fades them
     back, so each change reads as one dissolve.

     The duration is read off --sv-fade rather than hard-coded, so the CSS
     transition and this timer cannot drift apart. Under reduced motion the
     swap runs immediately with no fade at all.
     --------------------------------------------------------------------- */
  var FADE_MS = null;
  function fadeMs(el) {
    if (FADE_MS !== null) { return FADE_MS; }
    var raw = "";
    try {
      raw = getComputedStyle(el).getPropertyValue("--sv-fade") || "";
    } catch (e) { raw = ""; }
    raw = raw.trim();
    // the token is authored in seconds ("0.28s"); ms is accepted too
    var n = parseFloat(raw);
    if (isNaN(n)) { FADE_MS = 280; }
    else { FADE_MS = raw.indexOf("ms") !== -1 ? n : n * 1000; }
    return FADE_MS;
  }

  function crossfade(els, apply) {
    var list = [];
    each(els, function (el) { if (el) { list.push(el); } });

    if (REDUCED || !list.length) { apply(); return; }

    each(list, function (el) { el.classList.add("is-fading"); });
    setTimeout(function () {
      apply();
      /* two frames: one for the new content to be laid out, one for the
         browser to register the starting opacity before it transitions */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          each(list, function (el) { el.classList.remove("is-fading"); });
        });
      });
    }, fadeMs(list[0]));
  }

  /* Preloads the next photo so the fade-in never lands on a blank frame. */
  function preload(src) {
    if (!src) { return; }
    var img = new Image();
    img.src = src;
  }

  /* =======================================================================
     1. DISCIPLESHIP PATHWAY  (Faith Journey, section 06)
     Slides are .fj-pathway__slide; the list items are [data-movement].
     Add or remove a movement and both stay in step — everything is driven
     off however many slides are in the markup.
     ===================================================================== */
  function initPathway() {
    var root = document.querySelector("[data-pathway]");
    if (!root) { return; }

    var slides = root.querySelectorAll(".fj-pathway__slide");
    var items  = root.querySelectorAll("[data-movement]");
    var stepEl = root.querySelector("[data-pathway-step]");
    var nameEl = root.querySelector("[data-pathway-name]");
    if (!slides.length || !items.length) { return; }

    var index = 0, hold = false, timer = null;

    function show(i) {
      index = wrapIndex(i, slides.length, true);
      each(slides, function (s, n) { s.classList.toggle("is-active", n === index); });
      each(items,  function (m, n) { m.classList.toggle("is-active", n === index); });
      if (stepEl) { stepEl.textContent = "Movement " + (index + 1) + " of " + slides.length; }
      if (nameEl && items[index]) { nameEl.textContent = items[index].getAttribute("data-title"); }
    }

    each(items, function (m, n) {
      m.addEventListener("mouseenter", function () { hold = true; show(n); });
      m.addEventListener("mouseleave", function () { hold = false; });
      m.addEventListener("click", function () { show(n); });
      m.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); show(n); }
      });
    });

    show(0);
    if (!REDUCED && CONFIG.pathwayAutoplay > 0) {
      timer = setInterval(function () {
        if (!hold) { show(index + 1); }
      }, CONFIG.pathwayAutoplay);
    }
  }

  /* =======================================================================
     2. PRAYER PHOTO SWAP  (Faith Journey, section 07)
     Clicking a mini card enlarges it; clicking the same card again returns
     to the default photo, which is always slide 0.
     ===================================================================== */
  function initPrayer() {
    var root = document.querySelector("[data-prayer]");
    if (!root) { return; }

    var slides  = root.querySelectorAll(".fj-prayer__slide");
    var cards   = root.querySelectorAll("[data-prayer-card]");
    var current = 0;

    function show(i) {
      current = i;
      each(slides, function (s, n) { s.classList.toggle("is-active", n === i); });
      each(cards, function (c) {
        c.classList.toggle("is-active", parseInt(c.getAttribute("data-prayer-card"), 10) === i);
      });
    }

    each(cards, function (card) {
      card.addEventListener("click", function () {
        var i = parseInt(card.getAttribute("data-prayer-card"), 10);
        show(current === i ? 0 : i);
      });
    });
  }

  /* =======================================================================
     3. DISCIPLE-MAKING CAROUSEL  (Faith Journey, section 09)
     The big frame shows the current photo; the thin sliver beside it
     previews the next one.
     ===================================================================== */
  function initDisciple() {
    var root = document.querySelector("[data-disciple]");
    if (!root || REDUCED || CONFIG.discipleAutoplay <= 0) { return; }

    var big    = root.querySelectorAll(".fj-disciple__big .fj-disciple__slide");
    var sliver = root.querySelectorAll(".fj-disciple__sliver .fj-disciple__slide");
    var total  = big.length;
    if (!total) { return; }

    var index = 0;
    setInterval(function () {
      index = (index + 1) % total;
      each(big,    function (s, n) { s.classList.toggle("is-active", n === index); });
      each(sliver, function (s, n) { s.classList.toggle("is-active", n === (index + 1) % total); });
    }, CONFIG.discipleAutoplay);
  }

  /* =======================================================================
     4. THREE WAYS IN  (Serve, section 03)
     One featured card whose every field is replaced from TRACKS above.
     ===================================================================== */
  function initTracks() {
    var root = document.querySelector("[data-tracks]");
    if (!root) { return; }

    var img   = root.querySelector("[data-track-img]");
    var title = root.querySelector("[data-track-title]");
    var icon  = root.querySelector("[data-track-icon]");
    var badge = root.querySelector("[data-track-badge]");
    var desc  = root.querySelector("[data-track-desc]");
    var cta   = root.querySelector("[data-track-cta]");
    var label = root.querySelector("[data-track-cta-label]");
    var count = root.querySelector("[data-track-count]");
    var ticks = root.querySelectorAll("[data-track-tick]");
    var prev  = root.querySelector("[data-track-prev]");
    var next  = root.querySelector("[data-track-next]");
    var body  = root.querySelector(".sv-track__body");
    if (!img) { return; }

    var i = 0;

    function paint() {
      var t = TRACKS[i];
      /* src/alt/href are content, not style — the one place this file
         writes an attribute rather than toggling a class. */
      img.src = t.img;
      img.alt = t.alt;
      if (title) { title.innerHTML = t.title; }
      setIcon(icon, t.icon);
      if (badge) { badge.textContent = t.badge; }
      if (desc)  { desc.innerHTML = t.desc; }
      if (cta)   { cta.setAttribute("href", t.href); }
      if (label) { label.textContent = t.cta; }
      if (count) { count.textContent = (i + 1) + " / " + TRACKS.length; }
    }

    function go(step) {
      i = wrapIndex(i + step, TRACKS.length, CONFIG.tracksLoop);
      preload(TRACKS[i].img);
      /* the ticks are the one thing that must move immediately — they are
         the control the user just pressed, so they acknowledge the click
         while the card behind them dissolves */
      each(ticks, function (el, n) { el.classList.toggle("is-active", n === i); });
      crossfade([img, body], paint);
    }

    if (prev) { prev.addEventListener("click", function () { go(-1); }); }
    if (next) { next.addEventListener("click", function () { go(1); }); }

    paint();
    each(ticks, function (el, n) { el.classList.toggle("is-active", n === i); });
  }

  /* =======================================================================
     5. SERVE GLOBAL  (Serve, section 07)
     A centre panel flanked by the previous and next focus. Clicking either
     flank rotates it into the centre; the tabs jump straight to one.
     ===================================================================== */
  function initGlobal() {
    var root = document.querySelector("[data-global]");
    if (!root) { return; }

    var title = root.querySelector("[data-glob-title]");
    var desc  = root.querySelector("[data-glob-desc]");
    var icon  = root.querySelector("[data-glob-icon]");
    var count = root.querySelector("[data-glob-count]");
    var tabs  = root.querySelectorAll("[data-glob-tab]");
    var left      = root.querySelector("[data-glob-left]");
    var right     = root.querySelector("[data-glob-right]");
    var leftImg   = root.querySelector("[data-glob-left-img]");
    var rightImg  = root.querySelector("[data-glob-right-img]");
    var leftLabel = root.querySelector("[data-glob-left-label]");
    var rightLabel = root.querySelector("[data-glob-right-label]");
    if (!title) { return; }

    var i = 0;
    var len = GLOBAL.length;

    function paintSide(imgEl, labelEl, n) {
      if (imgEl) {
        imgEl.src = GLOBAL[n].img;
        imgEl.alt = GLOBAL[n].alt;
        /* object-position is per-photo cropping data, so it travels with
           the image rather than living in serve.css */
        imgEl.style.objectPosition = GLOBAL[n].pos;
      }
      if (labelEl) { labelEl.textContent = GLOBAL[n].title; }
    }

    /* everything that changes when the focus moves — faded as one group */
    var fading = [leftImg, leftLabel, rightImg, rightLabel, icon, title, desc];

    function paint() {
      var L = wrapIndex(i - 1, len, true);
      var R = wrapIndex(i + 1, len, true);

      title.textContent = GLOBAL[i].title;
      if (desc)  { desc.textContent = GLOBAL[i].desc; }
      setIcon(icon, GLOBAL[i].icon);

      paintSide(leftImg, leftLabel, L);
      paintSide(rightImg, rightLabel, R);

      /* the flanks always step one place, so their targets are recomputed
         on every paint rather than bound once */
      if (left)  { left.onclick  = function () { go(L); }; }
      if (right) { right.onclick = function () { go(R); }; }
    }

    function go(n) {
      if (n === i) { return; }
      i = n;
      preload(GLOBAL[wrapIndex(i - 1, len, true)].img);
      preload(GLOBAL[wrapIndex(i + 1, len, true)].img);
      /* the tabs and the counter are the controls, not the content — they
         update at once so the click is acknowledged immediately */
      each(tabs, function (el, k) { el.classList.toggle("is-active", k === i); });
      if (count) { count.textContent = (i + 1) + " / " + len; }
      crossfade(fading, paint);
    }

    each(tabs, function (el, n) {
      el.addEventListener("click", function () { go(n); });
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(n); }
      });
    });

    paint();
    each(tabs, function (el, n) { el.classList.toggle("is-active", n === i); });
    if (count) { count.textContent = (i + 1) + " / " + len; }
  }

  /* =======================================================================
     6. WHY IT'S DISCIPLESHIP  (Serve, section 08)
     An accordion where opening an item also swaps the photo beside it.
     Clicking the open item closes it but leaves its photo up, so the panel
     is never blank.
     ===================================================================== */
  function initDisc() {
    var root = document.querySelector("[data-disc]");
    if (!root) { return; }

    var items = root.querySelectorAll("[data-disc-item]");
    var photo = root.querySelector("[data-disc-img]");
    if (!items.length) { return; }

    var open = 0;

    function render() {
      each(items, function (item, n) {
        var isOpen = n === open;
        item.classList.toggle("is-open", isOpen);
        setIcon(item.querySelector("[data-disc-sign]"),
                isOpen ? "fas fa-minus" : "fas fa-plus",
                "sv-disc-item__sign");
      });
    }

    each(items, function (item, n) {
      item.addEventListener("click", function () {
        open = (open === n) ? -1 : n;
        render();
        /* the photo dissolves rather than cutting. It changes even when the
           click closed the item, so the panel is never left blank. */
        if (photo && DISC_PHOTOS[n] && photo.getAttribute("src") !== DISC_PHOTOS[n].img) {
          preload(DISC_PHOTOS[n].img);
          crossfade([photo], function () {
            photo.src = DISC_PHOTOS[n].img;
            photo.style.objectPosition = DISC_PHOTOS[n].pos;
          });
        }
      });
    });

    render();
  }

  /* =======================================================================
     7. FAQ — category chips + live search over one accordion
     Runs once per [data-faq] root, so the same code drives the Faith
     Journey FAQ and the Serve FAQ. Every hook is a data attribute, and the
     open/hidden states are classes, so the two pages can look completely
     different while sharing this behaviour.
     ===================================================================== */
  function initFaqRoot(root) {
    var items = root.querySelectorAll("[data-faq-item]");
    var chips = root.querySelectorAll("[data-faq-cat]");
    var search = root.querySelector("[data-faq-search]");
    var searchBtn = root.querySelector("[data-faq-search-btn]");
    var empty = root.querySelector("[data-faq-empty]");
    var clearBtn = root.querySelector("[data-faq-clear]");
    if (!items.length) { return; }

    var category = CONFIG.faqDefaultCategory;
    var debounce = null;

    function signOf(item) { return item.querySelector("[data-faq-sign]"); }
    /* the two pages name their sign icon differently, so the component
       class is read back off the element instead of being hard-coded */
    function signClass(item) {
      var el = signOf(item);
      if (!el) { return ""; }
      return (el.className.match(/[\w-]*faq[\w-]*__?sign/) || [""])[0];
    }

    function setOpen(item, open) {
      item.classList.toggle("is-open", open);
      setIcon(signOf(item), open ? "fas fa-minus" : "fas fa-plus", signClass(item));
    }
    function closeAll() { each(items, function (item) { setOpen(item, false); }); }

    function applyFilter() {
      var q = (search && search.value ? search.value : "").trim().toLowerCase();
      var any = false;

      each(items, function (item) {
        var cat = item.getAttribute("data-cat");
        var text = item.textContent.toLowerCase();
        var visible = (category === "All" || cat === category) &&
                      (!q || text.indexOf(q) !== -1);
        item.classList.toggle("is-hidden", !visible);
        if (visible) { any = true; }
        if (!visible && CONFIG.faqCloseOnFilter) { setOpen(item, false); }
      });

      if (empty) { empty.hidden = any; }
      each(chips, function (c) {
        c.classList.toggle("is-active", c.getAttribute("data-faq-cat") === category);
      });
    }

    /* accordion — one answer open at a time */
    each(items, function (item) {
      item.addEventListener("click", function () {
        var open = item.classList.contains("is-open");
        closeAll();
        if (!open) { setOpen(item, true); }
      });
    });

    each(chips, function (chip) {
      chip.addEventListener("click", function () {
        category = chip.getAttribute("data-faq-cat");
        closeAll();
        applyFilter();
      });
    });

    if (search) {
      search.addEventListener("input", function () {
        clearTimeout(debounce);
        debounce = setTimeout(function () { closeAll(); applyFilter(); },
                              CONFIG.faqSearchDebounce);
      });
      /* Enter must not submit anything — there is no form behind this */
      search.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); clearTimeout(debounce); applyFilter(); }
      });
    }
    if (searchBtn) {
      searchBtn.addEventListener("click", function (e) {
        e.preventDefault(); clearTimeout(debounce); applyFilter();
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        if (search) { search.value = ""; }
        category = CONFIG.faqDefaultCategory;
        closeAll();
        applyFilter();
      });
    }

    applyFilter();
  }

  function initFaq() {
    each(document.querySelectorAll("[data-faq]"), initFaqRoot);
  }

  /* =======================================================================
     8. REDUCED MOTION — the SVG ribbon
     The ribbon in Serve → "Serve at Missional Church One" travels along a
     textPath, which only SMIL can animate; no CSS media query can reach an
     <animate> element. Pausing the document's SMIL timeline stops it, and
     it is the only SMIL on either page.
     ===================================================================== */
  function initRibbon() {
    if (!REDUCED) { return; }
    var svg = document.querySelector("[data-ribbon]");
    if (svg && typeof svg.pauseAnimations === "function") { svg.pauseAnimations(); }
  }

  ready(function () {
    initPathway();
    initPrayer();
    initDisciple();
    initTracks();
    initGlobal();
    initDisc();
    initFaq();
    initRibbon();
  });

})();
