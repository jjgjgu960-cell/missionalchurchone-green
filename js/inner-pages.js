/* =========================================================================
   inner-pages.js — About Us + Plan Your Visit
   ------------------------------------------------------------------------
   Vanilla JS, no dependencies. One init function per feature, all booted
   from a single DOMContentLoaded.

       initNav()      mobile drawer for the shared site header
       initHero()     hero background parallax
       initGlance()   "At a Glance" photo carousel  (About only)
       initFaq()      FAQ accordion + category filter + search
       initForm()     "Plan Your Visit" send state  (Plan Your Visit only)

   Every block guards on its own elements, so a page that omits a component
   just skips it. Every reveal — both the section entrances and the
   per-element ones inside them — is pure CSS driven off a view() timeline,
   never JS. See css/inner-pages.css §02 and §02b.

   IMPORTANT: this file never sets a hover style. It toggles state classes
   (.is-on / .is-open / .is-hidden / .is-sent) and CSS decides how they look.
   ========================================================================= */

(function () {
  "use strict";

  /* =======================================================================
     CONFIG — every tunable value on these two pages lives here.
     ===================================================================== */
  var CONFIG = {
    /* --- hero parallax --- */
    // how far the hero photo drifts per pixel scrolled. 0 disables the drift.
    heroParallaxFactor: 0.2,
    // must stay in step with .fmk-hero__bg's transform in css/inner-pages.css
    heroScale: 1.08,

    /* --- "At a Glance" carousel (About Us) --- */
    // ms each photo is held before the next fades in
    glanceInterval: 4000,
    // mirrors the .fmk-stage__img opacity transition in CSS — change both
    glanceFadeMs: 800,
    // pause the rotation while the pointer is over the stage
    glancePauseOnHover: true,

    /* --- FAQ --- */
    // one panel open at a time; true lets several stay open
    faqAllowMultiOpen: false,
    // ms of typing quiet before the search re-filters
    faqSearchDebounce: 120,
    // the category every page starts on; must match a chip's data-cat
    faqDefaultCategory: "All",

    /* --- Plan Your Visit form --- */
    // NOTE: no endpoint is wired up yet. Until formEndpoint is set the button
    // only confirms locally — see README "Needs the client's input".
    formEndpoint: null,
    formSentLabel: "Message Sent — Thank You!",
    formIdleLabel: "Send Message",
    // ms the confirmation shows before the form resets. 0 keeps it forever.
    formResetAfter: 3600,

    /* --- breakpoint mirrors (kept in step with inner-pages-responsive.css) --- */
    bpTablet: 992,
    bpPhone: 768
  };

  var REDUCED = window.matchMedia &&
                window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function each(list, fn) { Array.prototype.forEach.call(list, fn); }

  /* =======================================================================
     1. NAV — the shared site header's Bootstrap collapse, plus the
        keyboard/outside-click/scroll-lock behaviour Bootstrap leaves out.
     ===================================================================== */
  function initNav() {
    var toggle = document.querySelector(".navbar-toggler");
    var panel = document.getElementById("navbarNav");
    if (!toggle || !panel) return;

    function isOpen() { return panel.classList.contains("show"); }

    function setExpanded() {
      toggle.setAttribute("aria-expanded", isOpen() ? "true" : "false");
      document.body.style.overflow = isOpen() ? "hidden" : "";
    }

    // Bootstrap fires these on the collapse element
    panel.addEventListener("shown.bs.collapse", setExpanded);
    panel.addEventListener("hidden.bs.collapse", setExpanded);

    function close() {
      if (!isOpen()) return;
      toggle.click();           // let Bootstrap run its own transition
    }

    // Escape closes
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });

    // click outside closes
    document.addEventListener("click", function (e) {
      if (!isOpen()) return;
      if (panel.contains(e.target) || toggle.contains(e.target)) return;
      close();
    });

    // following a link closes
    each(panel.querySelectorAll("a"), function (a) {
      a.addEventListener("click", close);
    });

    setExpanded();
  }

  /* =======================================================================
     2. HERO PARALLAX
     ===================================================================== */
  function initHero() {
    var bg = document.querySelector("[data-hero-bg]");
    if (!bg || REDUCED || !CONFIG.heroParallaxFactor) return;

    var ticking = false;

    function frame() {
      ticking = false;
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      bg.style.transform = "translateY(" + (y * CONFIG.heroParallaxFactor) +
                           "px) scale(" + CONFIG.heroScale + ")";
    }

    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(frame);
    }, { passive: true });
  }

  /* =======================================================================
     3. "AT A GLANCE" PHOTO CAROUSEL
     ===================================================================== */
  function initGlance() {
    var stage = document.querySelector("[data-glance]");
    if (!stage) return;

    var imgs = stage.querySelectorAll(".fmk-stage__img");
    var dots = stage.querySelectorAll(".fmk-stage__dot");
    if (imgs.length < 2) return;

    var index = 0;
    var timer = null;

    function show(i) {
      index = (i + imgs.length) % imgs.length;
      each(imgs, function (el, n) { el.classList.toggle("is-on", n === index); });
      each(dots, function (el, n) {
        el.classList.toggle("is-on", n === index);
        el.setAttribute("aria-current", n === index ? "true" : "false");
      });
    }

    function start() {
      stop();
      if (REDUCED) return;
      timer = setInterval(function () { show(index + 1); }, CONFIG.glanceInterval);
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    each(dots, function (dot, n) {
      dot.addEventListener("click", function () { show(n); start(); });
    });

    if (CONFIG.glancePauseOnHover) {
      stage.addEventListener("mouseenter", stop);
      stage.addEventListener("mouseleave", start);
      stage.addEventListener("focusin", stop);
      stage.addEventListener("focusout", start);
    }

    show(0);
    start();
  }

  /* =======================================================================
     4. FAQ — accordion + category chips + search
     Items carry data-cat. Filtering toggles .is-hidden; opening toggles
     .is-open. The open/closed panel animation is entirely CSS — this
     function writes no styles at all.
     ===================================================================== */
  function initFaq() {
    var root = document.querySelector("[data-faq]");
    if (!root) return;

    var items = root.querySelectorAll(".fmk-faq-item");
    var chips = root.querySelectorAll(".fmk-chip");
    var input = root.querySelector("[data-faq-input]");
    var searchBtn = root.querySelector("[data-faq-search]");
    var empty = root.querySelector("[data-faq-empty]");
    var clearBtn = root.querySelector("[data-faq-clear]");
    if (!items.length) return;

    var category = CONFIG.faqDefaultCategory;
    var debounce = null;

    // State only. The panel's open/closed height is a pure CSS transition
    // (grid-template-rows 0fr -> 1fr), so nothing here writes a style.
    function setOpen(item, open) {
      var btn = item.querySelector(".fmk-faq-item__btn");
      var icon = item.querySelector(".fmk-faq-item__icon");
      item.classList.toggle("is-open", open);
      if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (icon) {
        icon.classList.toggle("fa-plus", !open);
        icon.classList.toggle("fa-minus", open);
      }
    }

    each(items, function (item) {
      setOpen(item, false);
      var btn = item.querySelector(".fmk-faq-item__btn");
      if (!btn) return;
      btn.addEventListener("click", function () {
        var willOpen = !item.classList.contains("is-open");
        if (!CONFIG.faqAllowMultiOpen) {
          each(items, function (other) { if (other !== item) setOpen(other, false); });
        }
        setOpen(item, willOpen);
      });
    });

    function apply() {
      var term = ((input && input.value) || "").trim().toLowerCase();
      var shown = 0;

      each(items, function (item) {
        var cat = item.getAttribute("data-cat") || "";
        var text = (item.textContent || "").toLowerCase();
        var visible = (category === "All" || cat === category) &&
                      (!term || text.indexOf(term) !== -1);
        item.classList.toggle("is-hidden", !visible);
        if (!visible) setOpen(item, false);
        if (visible) shown++;
      });

      if (empty) empty.classList.toggle("is-on", shown === 0);
    }

    each(chips, function (chip) {
      chip.addEventListener("click", function () {
        each(chips, function (c) {
          c.classList.remove("is-on");
          c.setAttribute("aria-pressed", "false");
        });
        chip.classList.add("is-on");
        chip.setAttribute("aria-pressed", "true");
        category = chip.getAttribute("data-cat") || "All";
        apply();
      });
    });

    if (input) {
      input.addEventListener("input", function () {
        clearTimeout(debounce);
        debounce = setTimeout(apply, CONFIG.faqSearchDebounce);
      });
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); clearTimeout(debounce); apply(); }
      });
    }
    if (searchBtn) searchBtn.addEventListener("click", apply);

    function clearAll() {
      if (input) input.value = "";
      category = CONFIG.faqDefaultCategory;
      each(chips, function (c) {
        var on = (c.getAttribute("data-cat") || "All") === category;
        c.classList.toggle("is-on", on);
        c.setAttribute("aria-pressed", on ? "true" : "false");
      });
      apply();
    }
    if (clearBtn) clearBtn.addEventListener("click", clearAll);

    apply();
  }

  /* =======================================================================
     5. PLAN YOUR VISIT FORM
     With no CONFIG.formEndpoint set, the button confirms locally so the
     page can be demoed. Point formEndpoint at a real URL to POST for real.
     ===================================================================== */
  function initForm() {
    var form = document.querySelector("[data-visit-form]");
    if (!form) return;

    var btn = form.querySelector("[data-visit-submit]");
    if (!btn) return;

    function confirmSent() {
      btn.classList.add("is-sent");
      btn.textContent = CONFIG.formSentLabel;
      if (!CONFIG.formResetAfter) return;
      setTimeout(function () {
        btn.classList.remove("is-sent");
        btn.textContent = CONFIG.formIdleLabel;
        form.reset();
      }, CONFIG.formResetAfter);
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      if (!CONFIG.formEndpoint) { confirmSent(); return; }

      fetch(CONFIG.formEndpoint, {
        method: "POST",
        body: new FormData(form)
      }).then(confirmSent).catch(function () {
        btn.textContent = "Could not send — please call (972) 542-0041";
      });
    });
  }

  ready(function () {
    initNav();
    initHero();
    initGlance();
    initFaq();
    initForm();
  });

})();
