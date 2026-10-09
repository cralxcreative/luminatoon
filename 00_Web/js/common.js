/* ==========================================================
   common.js
   Shared by every page. Exposes window.Lumina with:
     Lumina.store     - safe localStorage wrapper
     Lumina.stash     - "My Stash" (saved titles)
     Lumina.progress  - watch progress per title
     Lumina.toast()   - small notifications
     Lumina.modal()   - generic modal
     Lumina.card      - shared card helpers
   and builds the banner, header and footer on load.
   ========================================================== */
(function () {
  "use strict";

  const body = document.body;
  const ROOT = body.dataset.root || "./";         // path to the project root
  const WEB = ROOT + "00_Web/";                    // path to 00_Web/
  const PAGE = body.dataset.page || "home";
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  const links = {
    home: ROOT + "index.html",
    movies: WEB + "movies.html",
    series: WEB + "series.html",
    seriesDetail: (id) => WEB + "series.html?id=" + encodeURIComponent(id),
    player: (id) => WEB + "player.html?id=" + encodeURIComponent(id),
    /* Series de archive.org -> ficha con episodios; el resto -> reproductor */
    open: (id) => {
      const t = byId(id);
      return t && t.source === "archive" && !t.seriesId ? links.seriesDetail(id) : links.player(id);
    }
  };

  /* ---------- Utilities ---------- */
  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const byId = (id) =>
    DATA.titles.find((t) => t.id === id) ||
    (window.Lumina && Lumina.archive ? Lumina.archive.episode(id) : null);

  const formatMins = (m) => {
    const h = Math.floor(m / 60);
    const r = Math.round(m % 60);
    return h ? h + "h " + String(r).padStart(2, "0") + "m" : r + "m";
  };

  const formatTime = (sec) => {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const mm = h ? String(m).padStart(2, "0") : String(m);
    return (h ? h + ":" : "") + mm + ":" + String(s).padStart(2, "0");
  };

  const timeAgo = (hours) => {
    if (hours < 1) return "just now";
    if (hours < 24) return Math.round(hours) + (Math.round(hours) === 1 ? " hour ago" : " hours ago");
    const d = Math.round(hours / 24);
    if (d === 1) return "yesterday";
    if (d < 7) return d + " days ago";
    if (d < 30) return "this month";
    return "a while ago";
  };

  const debounce = (fn, ms) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  const highlight = (text, query) => {
    const safe = escapeHtml(text);
    if (!query) return safe;
    const q = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return safe.replace(new RegExp("(" + q + ")", "ig"), '<mark class="hl">$1</mark>');
  };

  /* ---------- Storage ---------- */
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem("lumina:" + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem("lumina:" + key, JSON.stringify(value));
      } catch (e) { /* storage full or blocked */ }
    },
    remove(key) {
      try { localStorage.removeItem("lumina:" + key); } catch (e) { /* ignore */ }
    },
    clearAll() {
      try {
        Object.keys(localStorage)
          .filter((k) => k.indexOf("lumina:") === 0)
          .forEach((k) => localStorage.removeItem(k));
      } catch (e) { /* ignore */ }
    }
  };

  /* ---------- Tiny event bus ---------- */
  const listeners = {};
  const on = (evt, fn) => { (listeners[evt] = listeners[evt] || []).push(fn); };
  const emit = (evt, payload) => (listeners[evt] || []).forEach((fn) => fn(payload));

  /* ---------- Stash (saved titles) ---------- */
  const stash = {
    ids() { return store.get("stash", []); },
    has(id) { return this.ids().indexOf(id) > -1; },
    toggle(id) {
      const list = this.ids();
      const i = list.indexOf(id);
      if (i > -1) list.splice(i, 1);
      else list.unshift(id);
      store.set("stash", list);
      emit("stash", { id: id, saved: i === -1 });
      return i === -1;
    }
  };

  /* ---------- Progress ---------- */
  const progress = {
    all() { return store.get("progress", {}); },
    get(id) { return this.all()[id] || null; },
    set(id, time, duration) {
      if (!duration) return;
      const all = this.all();
      all[id] = { t: time, d: duration, at: Date.now() };
      store.set("progress", all);
    },
    remove(id) {
      const all = this.all();
      delete all[id];
      store.set("progress", all);
      const hidden = store.get("hiddenSeed", []);
      if (hidden.indexOf(id) === -1) hidden.push(id);
      store.set("hiddenSeed", hidden);
      emit("progress", { id: id });
    },
    ratio(id) {
      const p = this.get(id);
      if (p && p.d) return Math.min(1, p.t / p.d);
      const seed = DATA.continueSeed[id];
      return typeof seed === "number" ? seed : 0;
    }
  };

  /* ---------- Toast ---------- */
  function toast(message, opts) {
    opts = opts || {};
    let stack = $("#toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "toast-stack";
      stack.setAttribute("role", "status");
      stack.setAttribute("aria-live", "polite");
      body.appendChild(stack);
    }
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = "<span>" + escapeHtml(message) + "</span>";
    if (opts.action) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = opts.action.label;
      btn.addEventListener("click", () => { opts.action.onClick(); dismiss(); });
      el.appendChild(btn);
    }
    stack.appendChild(el);
    const dismiss = () => {
      el.classList.add("is-leaving");
      setTimeout(() => el.remove(), 220);
    };
    setTimeout(dismiss, opts.duration || 2800);
  }

  /* ---------- Modal ---------- */
  function modal(html, onMount) {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true">' + html + "</div>";
    body.appendChild(backdrop);
    body.classList.add("is-locked");
    requestAnimationFrame(() => backdrop.classList.add("is-open"));

    const close = () => {
      backdrop.classList.remove("is-open");
      body.classList.remove("is-locked");
      document.removeEventListener("keydown", onKey);
      setTimeout(() => backdrop.remove(), 220);
    };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
    $$("[data-close]", backdrop).forEach((b) => b.addEventListener("click", close));
    if (onMount) onMount(backdrop, close);
    const first = $("input, select, button", backdrop);
    if (first) first.focus();
    return close;
  }

  /* ---------- Shared card helpers ---------- */
  const fallbackImg = (img) => {
    img.addEventListener("error", () => {
      img.removeAttribute("src");
      img.parentElement.classList.add("img-fallback");
    }, { once: true });
  };

  const bookmarkButton = (id, cls) => {
    const saved = stash.has(id);
    return '<button type="button" data-stash="' + id + '" class="' + (cls || "") + '" aria-pressed="' + saved +
      '" aria-label="' + (saved ? "Remove from My Stash" : "Add to My Stash") + '">' +
      '<span class="material-symbols-outlined">' + (saved ? "bookmark_added" : "bookmark_add") + "</span></button>";
  };

  /* Keeps every [data-stash] button on the page in sync */
  function syncStashButtons() {
    $$("[data-stash]").forEach((btn) => {
      const saved = stash.has(btn.dataset.stash);
      const icon = $(".material-symbols-outlined", btn);
      if (icon) icon.textContent = saved ? "bookmark_added" : "bookmark_add";
      btn.setAttribute("aria-pressed", saved);
      btn.setAttribute("aria-label", saved ? "Remove from My Stash" : "Add to My Stash");
      btn.classList.toggle("is-saved", saved);
    });
  }

  /* One delegated listener handles every bookmark button */
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-stash]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const t = byId(btn.dataset.stash);
    const saved = stash.toggle(btn.dataset.stash);
    toast(saved ? "Added to My Stash: " + (t ? t.title : "") : "Removed from My Stash");
  });
  on("stash", () => { syncStashButtons(); renderDrawer(); updateStashCount(); });
  on("auth", () => { renderDrawer(); });

  /* One delegated listener makes any [data-play] element open the player */
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-play]");
    if (!el || e.target.closest("[data-stash]")) return;
    if (el.tagName === "A") return;
    window.location.href = links.open(el.dataset.play);
  });

  /* Cards are focusable links: Enter / Space opens the player */
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const el = e.target.closest && e.target.closest("[data-play][tabindex]");
    if (!el || e.target !== el) return;
    e.preventDefault();
    window.location.href = links.open(el.dataset.play);
  });

  /* Profile avatar: swaps the sticker image for a chosen emoji patch */
  function applyAvatar() {
    const emoji = store.get("avatar", "");
    const btn = $("#btn-profile");
    if (!btn || !emoji) return;
    const img = $("img", btn);
    const holder = img || $("[data-avatar]", btn);
    const span = document.createElement("span");
    span.dataset.avatar = "1";
    span.className = "w-8 h-8 rounded-xl border-2 border-comic-ink bg-comic-yellow flex items-center justify-center text-lg rotate-[-4deg]";
    span.textContent = emoji;
    if (holder) holder.replaceWith(span);
  }

  /* Drag-to-scroll for any horizontal rail */
  function enableDragScroll(rail) {
    let down = false, startX = 0, startLeft = 0, moved = false;
    rail.classList.add("rail");
    rail.addEventListener("mousedown", (e) => {
      down = true; moved = false;
      startX = e.pageX; startLeft = rail.scrollLeft;
    });
    window.addEventListener("mouseup", () => {
      if (!down) return;
      down = false;
      rail.classList.remove("is-dragging");
    });
    window.addEventListener("mousemove", (e) => {
      if (!down) return;
      const dx = e.pageX - startX;
      if (Math.abs(dx) > 5) { moved = true; rail.classList.add("is-dragging"); }
      if (moved) rail.scrollLeft = startLeft - dx;
    });
    rail.addEventListener("click", (e) => {
      if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
    }, true);
  }

  /* Rail arrow buttons: <button data-rail="rail-id" data-dir="-1"> */
  function bindRailArrows() {
    $$("[data-rail]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const rail = document.getElementById(btn.dataset.rail);
        if (rail) rail.scrollBy({ left: Number(btn.dataset.dir) * 400, behavior: "smooth" });
      });
    });
  }

  /* Scroll-reveal for sections (only above-the-fold content is exempt) */
  function initReveal() {
    const items = $$(".reveal");
    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("is-visible");
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.08 });
    items.forEach((el) => io.observe(el));
  }

  /* ==========================================================
     LAYOUT: banner + header + footer
     ========================================================== */
  const navItems = [
    { key: "home", icon: "🎈", label: "Home", href: links.home, hover: "" },
    { key: "movies", icon: "🎬", label: "Movies", href: links.movies, hover: "hover:bg-comic-cyan hover:text-comic-ink" },
    { key: "series", icon: "📺", label: "Series", href: links.series, hover: "hover:bg-comic-pink" },
    { key: "top", icon: "🔥", label: "Most Watched", href: links.home + "#top10", hover: "hover:bg-comic-lime hover:text-comic-ink" },
    { key: "stash", icon: "⭐", label: "My Stash", href: "#", hover: "hover:bg-comic-yellow hover:text-comic-ink" }
  ];

  function navLink(item, mobile) {
    const active = item.key === PAGE;
    const base = "px-3.5 py-2 rounded-xl font-fredoka text-sm font-bold border-2 border-comic-ink shadow-comic-sm flex items-center gap-1.5 ";
    const cls = active
      ? "bg-comic-yellow text-comic-ink -rotate-1 comic-btn"
      : "bg-comic-panel text-white transition-colors " + item.hover;
    return '<a class="' + base + cls + (mobile ? " whitespace-nowrap" : "") + '" href="' + item.href + '"' +
      (item.key === "stash" ? ' data-open-stash' : "") + (active ? ' aria-current="page"' : "") + ">" +
      "<span>" + item.icon + "</span> " + item.label +
      (item.key === "stash" ? ' <span id="stash-count" class="ml-1 min-w-[18px] text-center text-[10px] rounded-full bg-comic-pink text-white px-1 hidden"></span>' : "") +
      "</a>";
  }

  function buildBanner() {
    const slot = $("#site-banner");
    if (!slot) return;
    const first = DATA.tickerMessages[0];
    slot.className = "w-full bg-comic-yellow text-comic-ink py-1.5 px-4 comic-border-thick border-t-0 border-x-0 flex items-center justify-center gap-3 font-fredoka font-black text-xs uppercase tracking-wider overflow-hidden";
    slot.innerHTML =
      '<span id="ticker-tag" class="inline-flex items-center gap-1 bg-comic-pink text-white px-2 py-0.5 rounded-md border-2 border-comic-ink text-[10px] font-bangers tracking-wide shadow-comic-sm -rotate-2">' + escapeHtml(first.tag) + "</span>" +
      '<span id="ticker-text" class="ticker-text truncate">' + escapeHtml(first.text) + "</span>" +
      '<span class="hidden md:inline-flex items-center gap-1 bg-comic-cyan text-comic-ink px-2 py-0.5 rounded-md border-2 border-comic-ink text-[10px] font-bold">⚡ 100% AD-FREE</span>';

    let i = 0;
    setInterval(() => {
      i = (i + 1) % DATA.tickerMessages.length;
      const textEl = $("#ticker-text");
      textEl.classList.add("is-swapping");
      setTimeout(() => {
        $("#ticker-tag").textContent = DATA.tickerMessages[i].tag;
        textEl.textContent = DATA.tickerMessages[i].text;
        textEl.classList.remove("is-swapping");
      }, 300);
    }, 6000);
  }

  function buildHeader() {
    const slot = $("#site-header");
    if (!slot) return;
    slot.className = "sticky top-0 z-50 bg-comic-dark/95 backdrop-blur-md comic-border-thick border-t-0 border-x-0 shadow-comic";
    slot.innerHTML =
      '<div class="h-20 w-full px-4 sm:px-8 lg:px-12 flex items-center justify-between gap-4">' +
        '<div class="flex items-center gap-8 lg:gap-10">' +
          '<a class="flex items-center gap-2 group comic-btn" href="' + links.home + '" aria-label="Lumina Toon home">' +
            '<div class="w-12 h-12 rounded-2xl bg-comic-pink border-3 border-comic-ink flex items-center justify-center shadow-comic group-hover:rotate-6 transition-transform rotate-[-3deg] relative overflow-hidden">' +
              '<div class="absolute inset-0 arcade-pattern opacity-40"></div>' +
              '<span class="material-symbols-outlined text-comic-yellow text-3xl font-black relative z-10" style="font-variation-settings: \'FILL\' 1;">smart_toy</span>' +
            "</div>" +
            '<div class="flex flex-col leading-none">' +
              '<div class="font-bangers text-3xl tracking-wider text-white drop-shadow-[2px_2px_0px_#0a0814] flex items-center">Lumina<span class="text-comic-yellow ml-0.5 bg-comic-purple px-1.5 py-0.5 rounded-lg border-2 border-comic-ink shadow-comic-sm text-2xl -rotate-2">TOON!</span></div>' +
              '<span class="font-fredoka text-[11px] font-black uppercase tracking-widest text-comic-cyan pl-0.5">COMICS &amp; STREAM</span>' +
            "</div>" +
          "</a>" +
          '<nav class="hidden lg:flex items-center gap-2.5" aria-label="Main">' + navItems.map((n) => navLink(n)).join("") + "</nav>" +
        "</div>" +
        '<div class="flex items-center gap-3">' +
          /* Search */
          '<div class="relative hidden sm:flex items-center" id="search-wrap">' +
            '<span class="material-symbols-outlined absolute left-3.5 text-comic-yellow text-lg pointer-events-none">search</span>' +
            '<input id="global-search" class="w-48 lg:w-64 pl-10 pr-10 py-2 bg-comic-panel rounded-full font-fredoka text-xs text-white placeholder:text-gray-400 border-3 border-comic-ink shadow-comic-sm focus:outline-none focus:bg-comic-dark focus:border-comic-yellow transition-all" placeholder="Search heroes, comics...  ( / )" type="search" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="search-results">' +
            '<div id="search-results" class="dropdown !right-0 !min-w-[340px] p-2" role="listbox"></div>' +
          "</div>" +
          /* Kids club */
          '<button id="btn-kids-club" type="button" class="px-3.5 py-2 rounded-xl bg-comic-lime text-comic-ink font-bangers text-base tracking-wider border-3 border-comic-ink shadow-comic-sm hover:bg-comic-yellow comic-btn hidden md:flex items-center gap-1.5 rotate-1">' +
            '<span class="w-2.5 h-2.5 rounded-full bg-comic-pink border border-comic-ink animate-ping"></span>' +
            '<span id="kids-label">KIDS CLUB 🚀</span>' +
          "</button>" +
          /* Login con Google (lo gestiona firebase.js) */
          '<button id="btn-login" type="button" class="px-3.5 py-2 rounded-xl bg-white text-comic-ink font-fredoka font-black text-xs border-3 border-comic-ink shadow-comic-sm hover:bg-comic-yellow comic-btn flex items-center gap-2">' +
            '<svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>' +
            '<span class="hidden sm:inline">Sign in</span>' +
          "</button>" +
          /* Notifications */
          '<div class="relative">' +
            '<button id="btn-bell" aria-label="Notifications" aria-haspopup="true" class="w-10 h-10 rounded-xl bg-comic-panel hover:bg-comic-cyan hover:text-comic-ink text-comic-yellow border-2 border-comic-ink shadow-comic-sm flex items-center justify-center relative comic-btn" type="button">' +
              '<span class="material-symbols-outlined text-xl">notifications</span>' +
              '<span id="bell-badge" class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-comic-pink border-2 border-comic-ink flex items-center justify-center text-[8px] font-black text-white"></span>' +
            "</button>" +
            '<div id="bell-menu" class="dropdown p-2"></div>' +
          "</div>" +
          /* Profile */
          '<div class="relative">' +
            '<button id="btn-profile" type="button" aria-haspopup="true" class="flex items-center gap-1.5 p-1 bg-comic-purple rounded-2xl border-3 border-comic-ink shadow-comic-sm cursor-pointer hover:bg-comic-pink transition-colors">' +
              '<img alt="Toon sticker avatar" class="w-8 h-8 rounded-xl object-cover border-2 border-comic-ink bg-comic-yellow rotate-[-4deg]" src="' + IMG.avatar + '">' +
              '<span class="material-symbols-outlined text-white text-base pr-1 font-bold">keyboard_arrow_down</span>' +
            "</button>" +
            '<div id="profile-menu" class="dropdown p-2">' +
              '<div id="auth-info" class="hidden px-3 py-2 mb-1 border-b-2 border-comic-ink"></div>' +
              '<button class="dropdown-item" type="button" id="menu-login"><span class="material-symbols-outlined text-base">login</span> Sign in with Google</button>' +
              '<button class="dropdown-item hidden" type="button" id="menu-logout"><span class="material-symbols-outlined text-base">logout</span> Sign out</button>' +
              '<button class="dropdown-item" type="button" data-open-stash><span class="material-symbols-outlined text-base">star</span> My Stash</button>' +
              '<button class="dropdown-item" type="button" id="menu-kids"><span class="material-symbols-outlined text-base">child_care</span> Kids Mode settings</button>' +
              '<a class="dropdown-item" href="' + links.movies + '"><span class="material-symbols-outlined text-base">casino</span> Random movie</a>' +
              '<button class="dropdown-item" type="button" id="menu-reset"><span class="material-symbols-outlined text-base">restart_alt</span> Reset saved data</button>' +
            "</div>" +
          "</div>" +
        "</div>" +
      "</div>" +
      /* Mobile nav strip */
      '<nav class="lg:hidden flex items-center gap-2 overflow-x-auto no-scrollbar px-4 pb-3" aria-label="Main (mobile)">' +
        navItems.map((n) => navLink(n, true)).join("") +
      "</nav>";
  }

  function buildFooter() {
    const slot = $("#site-footer");
    if (!slot) return;
    slot.className = "w-full bg-comic-ink border-t-3 border-comic-ink mt-8";
    const col = (color, icon, title, items) =>
      '<div class="flex flex-col gap-3">' +
        '<div class="flex items-center gap-2 font-bangers text-xl text-' + color + ' tracking-wider"><span class="material-symbols-outlined text-xl">' + icon + "</span> " + title + "</div>" +
        items.map((i) => '<a class="font-fredoka text-xs font-semibold text-gray-300 hover:text-' + color + ' transition-colors" href="' + (i[1] || "#") + '"' + (i[2] ? " " + i[2] : "") + ">" + i[0] + "</a>").join("") +
      "</div>";

    slot.innerHTML =
      '<div class="w-full px-5 sm:px-8 lg:px-12 py-12 flex flex-col gap-10">' +
        '<div class="grid grid-cols-2 md:grid-cols-4 gap-8">' +
          col("comic-yellow", "movie", "Explore Toon", [
            ["Original Toon Series", links.series],
            ["Animated Movies", links.movies],
            ["Anime & Manga Pop", links.home + "#top10"],
            ["Magic Shorts", links.movies + "?genre=fantasy"]
          ]) +
          col("comic-cyan", "star", "Your Collection", [
            ["My Stash", "#", "data-open-stash"],
            ["Continue Watching", links.home + "#continue"],
            ["Offline Downloads", "#", 'data-soon="Offline downloads are coming soon"'],
            ["Badges & Trophies", "#", 'data-soon="Badges are coming soon"']
          ]) +
          col("comic-pink", "shield", "Parents & Controls", [
            ["Family Guide", "#", 'data-soon="Family guide is coming soon"'],
            ["Screen Time Limits", "#", "data-kids"],
            ["Child Privacy & Safety", "#", 'data-soon="Privacy center is coming soon"'],
            ["24/7 Support", "#", 'data-soon="Support chat is coming soon"']
          ]) +
          '<div class="flex flex-col gap-3">' +
            '<div class="flex items-center gap-2 font-bangers text-xl text-comic-lime tracking-wider"><span class="material-symbols-outlined text-xl">settings</span> Pop Settings</div>' +
            '<div class="flex items-center gap-2 text-gray-300 font-fredoka text-xs font-semibold"><span class="material-symbols-outlined text-sm text-comic-yellow">language</span><span>English (Original Audio)</span></div>' +
            '<div class="flex items-center gap-2 text-gray-300 font-fredoka text-xs font-semibold"><span class="material-symbols-outlined text-sm text-comic-pink">palette</span><span>Theme: Retro Comic Pop ✨</span></div>' +
            '<div class="flex items-center gap-2 text-gray-300 font-fredoka text-xs font-semibold"><span class="material-symbols-outlined text-sm text-comic-cyan">high_quality</span><span>Spatial Audio &amp; ToonSound</span></div>' +
          "</div>" +
        "</div>" +
        '<div class="flex flex-col sm:flex-row items-center justify-between pt-6 border-t-2 border-comic-panel text-gray-400 text-xs gap-3 font-fredoka">' +
          '<div class="flex items-center gap-2"><span class="font-bangers text-xl text-comic-yellow">Lumina Toon!</span><span>© ' + new Date().getFullYear() + " Lumina Stream, Inc. All animated characters are pure magic.</span></div>" +
          '<div class="px-3 py-1 rounded-lg bg-comic-purple text-comic-yellow font-bangers text-sm tracking-wider border-2 border-comic-ink shadow-comic-sm -rotate-1">🎈 Made to dream and laugh awake!</div>' +
        "</div>" +
      "</div>";

    $$("[data-soon]", slot).forEach((a) =>
      a.addEventListener("click", (e) => { e.preventDefault(); toast(a.dataset.soon); }));
  }

  /* ==========================================================
     Dropdowns: notifications + profile
     ========================================================== */
  function closeMenus(except) {
    $$(".dropdown.is-open").forEach((m) => { if (m !== except && m.id !== "search-results") m.classList.remove("is-open"); });
  }

  function initMenus() {
    const bell = $("#btn-bell");
    const bellMenu = $("#bell-menu");
    const badge = $("#bell-badge");
    const profileBtn = $("#btn-profile");
    const profileMenu = $("#profile-menu");
    if (!bell) return;

    const seen = store.get("notifSeen", false);
    badge.textContent = DATA.notifications.length;
    badge.classList.toggle("hidden", seen);

    bellMenu.innerHTML =
      '<div class="px-3 py-2 font-bangers text-lg text-comic-yellow tracking-wide">Notifications</div>' +
      DATA.notifications.map((n) =>
        '<a class="dropdown-item" href="' + links.player(n.id) + '"><span class="material-symbols-outlined text-base">' + n.icon + "</span>" +
        '<span class="flex flex-col"><span>' + escapeHtml(n.text) + '</span><span class="text-[10px] opacity-70">' + n.when + "</span></span></a>"
      ).join("");

    bell.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = !bellMenu.classList.contains("is-open");
      closeMenus(bellMenu);
      bellMenu.classList.toggle("is-open", open);
      if (open) { badge.classList.add("hidden"); store.set("notifSeen", true); }
    });

    profileBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = !profileMenu.classList.contains("is-open");
      closeMenus(profileMenu);
      profileMenu.classList.toggle("is-open", open);
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".dropdown")) closeMenus();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenus(); });

    $("#menu-reset").addEventListener("click", () => {
      closeMenus();
      modal(
        '<h3 class="font-bangers text-3xl text-comic-yellow mb-2">Reset saved data?</h3>' +
        '<p class="font-fredoka text-sm text-gray-300 mb-5">This clears My Stash, watch progress and Kids Mode settings on this device.</p>' +
        '<div class="flex gap-3 justify-end">' +
          '<button data-close type="button" class="px-4 py-2 rounded-xl bg-comic-panel text-white font-fredoka font-bold text-sm border-2 border-comic-ink shadow-comic-sm comic-btn">Cancel</button>' +
          '<button id="confirm-reset" type="button" class="px-4 py-2 rounded-xl bg-comic-pink text-white font-fredoka font-black text-sm border-2 border-comic-ink shadow-comic-sm comic-btn">Reset everything</button>' +
        "</div>",
        (box, close) => $("#confirm-reset", box).addEventListener("click", () => {
          store.clearAll();
          close();
          toast("Saved data cleared");
          setTimeout(() => location.reload(), 600);
        })
      );
    });
  }

  /* ==========================================================
     Global search (header)
     ========================================================== */
  function initSearch() {
    const input = $("#global-search");
    const results = $("#search-results");
    if (!input) return;
    let active = -1;
    let current = [];

    const close = () => {
      results.classList.remove("is-open");
      input.setAttribute("aria-expanded", "false");
      active = -1;
    };

    const render = (q) => {
      const query = q.trim().toLowerCase();
      if (!query) { close(); return; }
      current = DATA.titles.filter((t) =>
        (t.title + " " + t.genre + " " + t.director).toLowerCase().indexOf(query) > -1
      ).sort((a, b) => b.views - a.views).slice(0, 6);

      results.innerHTML = current.length
        ? current.map((t, i) =>
            '<a role="option" data-i="' + i + '" class="dropdown-item" href="' + links.open(t.id) + '">' +
              '<img alt="" class="w-9 h-12 rounded-md object-cover border-2 border-comic-ink" src="' + t.img + '">' +
              '<span class="flex flex-col min-w-0"><span class="truncate">' + highlight(t.title, q.trim()) + "</span>" +
              '<span class="text-[10px] opacity-70">' + (t.kind === "movie" ? "Movie" : "Series") + " • " + escapeHtml(t.genre) + " • ★ " + t.score + "</span></span></a>"
          ).join("")
        : '<div class="px-3 py-4 font-fredoka text-sm text-gray-300">No toons match “' + escapeHtml(q.trim()) + "”. Try a title or genre.</div>";
      results.classList.add("is-open");
      input.setAttribute("aria-expanded", "true");
      $$("img", results).forEach(fallbackImg);
      active = -1;
    };

    const setActive = (n) => {
      const items = $$("[role=option]", results);
      if (!items.length) return;
      active = (n + items.length) % items.length;
      items.forEach((el, i) => el.classList.toggle("is-active", i === active));
    };

    input.addEventListener("input", debounce(() => render(input.value), 120));
    input.addEventListener("focus", () => { if (input.value) render(input.value); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
      else if (e.key === "Enter") {
        const target = current[active >= 0 ? active : 0];
        if (target) window.location.href = links.player(target.id);
      } else if (e.key === "Escape") { close(); input.blur(); }
    });
    document.addEventListener("click", (e) => { if (!e.target.closest("#search-wrap")) close(); });

    /* "/" focuses the search box from anywhere */
    document.addEventListener("keydown", (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (e.key === "/" && tag !== "input" && tag !== "textarea" && tag !== "select") {
        const target = $("#catalog-search-input") || input;
        if (target && target.offsetParent !== null) { e.preventDefault(); target.focus(); }
      }
    });
  }

  /* ==========================================================
     Stash drawer
     ========================================================== */
  let drawerEl, drawerBackdrop;

  function buildDrawer() {
    drawerBackdrop = document.createElement("div");
    drawerBackdrop.className = "drawer-backdrop";
    drawerEl = document.createElement("aside");
    drawerEl.className = "drawer";
    drawerEl.setAttribute("aria-label", "My Stash");
    drawerEl.setAttribute("aria-hidden", "true");
    body.appendChild(drawerBackdrop);
    body.appendChild(drawerEl);
    drawerBackdrop.addEventListener("click", closeDrawer);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });
    document.addEventListener("click", (e) => {
      const opener = e.target.closest("[data-open-stash]");
      if (opener) { e.preventDefault(); closeMenus(); openDrawer(); }
    });
    renderDrawer();
  }

  function renderDrawer() {
    if (!drawerEl) return;
    const items = stash.ids().map(byId).filter(Boolean);
    drawerEl.innerHTML =
      '<div class="flex items-center justify-between p-5 border-b-3 border-comic-ink bg-comic-panel">' +
        '<div class="font-bangers text-3xl text-comic-yellow tracking-wide">⭐ My Stash <span class="text-comic-cyan text-xl">(' + items.length + ")</span></div>" +
        '<button type="button" id="drawer-close" aria-label="Close My Stash" class="w-10 h-10 rounded-xl bg-comic-ink text-comic-yellow border-2 border-comic-ink hover:bg-comic-pink hover:text-white flex items-center justify-center"><span class="material-symbols-outlined">close</span></button>' +
      "</div>" +
      (Lumina.user ? "" : '<button type="button" data-login class="mx-4 mt-4 px-4 py-2.5 rounded-xl bg-comic-yellow text-comic-ink font-fredoka font-black text-xs border-2 border-comic-ink shadow-comic-sm comic-btn flex items-center justify-center gap-2"><span class="material-symbols-outlined text-base">cloud_sync</span> Sign in with Google to sync your stash</button>') +
      '<div class="flex-1 overflow-y-auto p-4 flex flex-col gap-3">' +
        (items.length
          ? items.map((t) =>
              '<div class="flex items-center gap-3 p-2.5 bg-comic-panel border-2 border-comic-ink rounded-xl shadow-comic-sm">' +
                '<a href="' + links.open(t.id) + '" class="flex items-center gap-3 min-w-0 flex-1">' +
                  '<img alt="" class="w-14 h-20 rounded-lg object-cover border-2 border-comic-ink" src="' + t.img + '">' +
                  '<span class="flex flex-col min-w-0"><span class="font-bangers text-lg text-white truncate">' + escapeHtml(t.title) + "</span>" +
                  '<span class="font-fredoka text-xs text-comic-cyan font-bold">' + escapeHtml(t.genre) + " • " + (t.kind === "movie" ? formatMins(t.mins) : "Series") + "</span></span></a>" +
                '<button type="button" data-stash="' + t.id + '" aria-label="Remove from My Stash" class="w-9 h-9 rounded-lg bg-comic-dark text-comic-yellow hover:bg-comic-pink hover:text-white flex items-center justify-center shrink-0"><span class="material-symbols-outlined text-lg">bookmark_added</span></button>' +
              "</div>").join("")
          : '<div class="m-auto text-center p-6 font-fredoka text-gray-300"><div class="text-5xl mb-3">📭</div><p class="font-bold text-white mb-1">Your stash is empty</p><p class="text-sm">Tap the bookmark on any title to save it here.</p></div>') +
      "</div>";
    $("#drawer-close", drawerEl).addEventListener("click", closeDrawer);
  }

  function openDrawer() {
    renderDrawer();
    drawerEl.classList.add("is-open");
    drawerBackdrop.classList.add("is-open");
    drawerEl.setAttribute("aria-hidden", "false");
    body.classList.add("is-locked");
    $("#drawer-close", drawerEl).focus();
  }

  function closeDrawer() {
    if (!drawerEl || !drawerEl.classList.contains("is-open")) return;
    drawerEl.classList.remove("is-open");
    drawerBackdrop.classList.remove("is-open");
    drawerEl.setAttribute("aria-hidden", "true");
    body.classList.remove("is-locked");
  }

  function updateStashCount() {
    const n = stash.ids().length;
    $$("#stash-count").forEach((el) => {
      el.textContent = n;
      el.classList.toggle("hidden", n === 0);
    });
  }

  /* ==========================================================
     Kids Mode (PIN + screen-time limit, stored locally)
     ========================================================== */
  function openKidsModal() {
    const settings = store.get("kids", { on: false, pin: "", limit: "none" });
    modal(
      '<div class="flex items-center gap-3 mb-4"><div class="w-12 h-12 rounded-xl bg-comic-lime border-2 border-comic-ink flex items-center justify-center text-2xl shadow-comic-sm -rotate-3">🚀</div>' +
      '<h3 class="font-bangers text-3xl text-comic-yellow tracking-wide">Kids Mode</h3></div>' +
      '<p class="font-fredoka text-sm text-gray-300 mb-5">Safe, ad-free fun. Set a 4-digit PIN to lock adult content and pick a daily screen-time limit.</p>' +
      '<label class="font-fredoka font-bold text-xs text-comic-cyan uppercase" for="kids-pin">4-digit PIN</label>' +
      '<input id="kids-pin" class="pin-input mt-1 mb-4" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••" value="' + escapeHtml(settings.pin) + '">' +
      '<label class="font-fredoka font-bold text-xs text-comic-cyan uppercase" for="kids-limit">Daily screen time</label>' +
      '<select id="kids-limit" class="select-comic mt-1 mb-4">' +
        ["none:No limit", "30:30 minutes", "60:1 hour", "120:2 hours"].map((o) => {
          const p = o.split(":");
          return '<option value="' + p[0] + '"' + (settings.limit === p[0] ? " selected" : "") + ">" + p[1] + "</option>";
        }).join("") +
      "</select>" +
      '<label class="flex items-center gap-3 font-fredoka font-bold text-sm text-white mb-6 cursor-pointer"><input id="kids-on" type="checkbox" class="w-5 h-5 accent-[#A6FF00]"' + (settings.on ? " checked" : "") + "> Turn Kids Mode on</label>" +
      '<p id="kids-error" class="font-fredoka text-xs text-comic-pink font-bold mb-3 hidden"></p>' +
      '<div class="flex gap-3 justify-end">' +
        '<button data-close type="button" class="px-4 py-2 rounded-xl bg-comic-dark text-white font-fredoka font-bold text-sm border-2 border-comic-ink shadow-comic-sm comic-btn">Cancel</button>' +
        '<button id="kids-save" type="button" class="px-5 py-2 rounded-xl bg-comic-yellow text-comic-ink font-bangers text-lg tracking-wide border-2 border-comic-ink shadow-comic-sm comic-btn">Save settings</button>' +
      "</div>",
      (box, close) => {
        const pin = $("#kids-pin", box);
        pin.addEventListener("input", () => { pin.value = pin.value.replace(/\D/g, "").slice(0, 4); });
        $("#kids-save", box).addEventListener("click", () => {
          const err = $("#kids-error", box);
          const on = $("#kids-on", box).checked;
          if (on && pin.value.length !== 4) {
            err.textContent = "Enter a 4-digit PIN to turn Kids Mode on.";
            err.classList.remove("hidden");
            pin.focus();
            return;
          }
          store.set("kids", { on: on, pin: pin.value, limit: $("#kids-limit", box).value });
          applyKidsState();
          close();
          toast(on ? "Kids Mode is on" : "Kids Mode settings saved");
        });
      }
    );
  }

  function applyKidsState() {
    const on = store.get("kids", { on: false }).on;
    const label = $("#kids-label");
    if (label) label.textContent = on ? "KIDS MODE ✓" : "KIDS CLUB 🚀";
  }

  function initKids() {
    document.addEventListener("click", (e) => {
      if (e.target.closest("#btn-kids-club, #menu-kids, [data-kids]")) {
        e.preventDefault();
        closeMenus();
        openKidsModal();
      }
    });
    applyKidsState();
  }

  /* ---------- Back to top ---------- */
  function initBackToTop() {
    const btn = document.createElement("button");
    btn.id = "back-to-top";
    btn.type = "button";
    btn.setAttribute("aria-label", "Back to top");
    btn.className = "w-12 h-12 rounded-2xl bg-comic-yellow text-comic-ink border-3 border-comic-ink shadow-comic flex items-center justify-center comic-btn";
    btn.innerHTML = '<span class="material-symbols-outlined text-2xl font-black">arrow_upward</span>';
    body.appendChild(btn);
    btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    window.addEventListener("scroll", () => btn.classList.toggle("is-visible", window.scrollY > 600), { passive: true });
  }

  /* ---------- Boot ---------- */
  function boot() {
    buildBanner();
    buildHeader();
    buildFooter();
    initMenus();
    initSearch();
    buildDrawer();
    initKids();
    applyAvatar();
    initBackToTop();
    updateStashCount();
    bindRailArrows();
    initReveal();
    $$("img").forEach(fallbackImg);
  }

  window.Lumina = {
    $: $, $$: $$, store: store, stash: stash, progress: progress, on: on, emit: emit,
    toast: toast, modal: modal, links: links, byId: byId,
    escapeHtml: escapeHtml, formatMins: formatMins, formatTime: formatTime,
    timeAgo: timeAgo, debounce: debounce, highlight: highlight,
    bookmarkButton: bookmarkButton, syncStashButtons: syncStashButtons,
    enableDragScroll: enableDragScroll, fallbackImg: fallbackImg, initReveal: initReveal,
    bindRailArrows: bindRailArrows, applyAvatar: applyAvatar
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
