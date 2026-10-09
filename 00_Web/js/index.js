/* ==========================================================
   index.js  -  home page
   Renders: hero slider, Continue Watching, Trending, Top 10
   and wires the avatar patches.
   ========================================================== */
(function () {
  "use strict";

  const { $, $$, byId, links, escapeHtml, formatMins, progress, stash, store, modal, toast } = Lumina;

  const ACCENTS = ["yellow", "pink", "lime", "cyan", "purple"];
  const accent = (i) => ACCENTS[i % ACCENTS.length];
  const onAccent = (c) => (c === "pink" || c === "purple" ? "text-white" : "text-comic-ink");
  const TAG_LABEL = { action: "ACTION", comedy: "FUNNY", fantasy: "MAGIC", anime: "ANIME", classic: "CLASSIC", "3d": "3D" };

  /* ==========================================================
     HERO SLIDER
     ========================================================== */
  const BADGE_STYLES = [
    "bg-comic-yellow text-comic-ink font-bangers text-base -rotate-2",
    "bg-comic-pink text-white font-bangers text-base rotate-2",
    "bg-comic-purple text-comic-yellow font-fredoka font-black text-xs uppercase",
    "bg-comic-lime text-comic-ink font-fredoka font-black text-xs uppercase"
  ];

  /* Slides construidos con las series/películas de archive.org (nada de relleno) */
  let slides = [];
  const srcTag = (t) => (t.imdb && t.imdb.rating ? (t.imdb.src === "tvmaze" ? "TVMAZE" : "IMDB") : "POP");

  function slideFor(t) {
    const isSeries = t.kind === "series";
    const badges = [];
    if (t.imdb && t.imdb.rating) badges.push("★ " + Number(t.score).toFixed(1) + " " + srcTag(t));
    if (t.year) badges.push(String(t.year));
    if (t.rating) badges.push(t.rating);
    badges.push(String(t.genre || "").split("•")[0].trim() || (isSeries ? "Series" : "Movie"));
    return {
      id: t.id, bg: String(t.img || "").replace(/'/g, "%27"),
      issue: isSeries ? "★ LUMINA SERIES" : "★ LUMINA MOVIES",
      stamp: "STREAMING FROM ARCHIVE.ORG!",
      sticker: isSeries ? "BINGE TIME!" : "MOVIE TIME!",
      kicker: String(t.genre || (isSeries ? "SERIES" : "MOVIE")).toUpperCase(),
      pre: isSeries ? "Binge the series" : "Now streaming", hi: t.title,
      badges: badges.filter(Boolean).slice(0, 4),
      synopsis: t.desc || "Streaming straight from archive.org.",
      play: isSeries ? "WATCH NOW" : "WATCH THE MOVIE",
      rating: String(t.rating || "ALL AUDIENCES").toUpperCase()
    };
  }

  function buildSlides() {
    const pool = DATA.titles.filter((t) => t.source === "archive" && !t.seriesId);
    const series = pool.filter((t) => t.kind === "series");
    const movies = pool.filter((t) => t.kind === "movie").sort((a, b) => b.score - a.score);
    return series.concat(movies).slice(0, 5).map(slideFor);
  }

  let heroIndex = 0;
  let heroTimer = null;
  let heroPaused = false;
  let muted = store.get("muted", false);

  function heroHtml(s) {
    const badges = s.badges.map((b, i) =>
      '<span class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl tracking-wide border-2 border-comic-ink shadow-comic-sm ' + BADGE_STYLES[i % 4] + '">' + escapeHtml(b) + "</span>"
    ).join("");

    return (
      '<div class="w-full min-h-[580px] lg:min-h-[640px] bg-cover bg-center flex items-end relative hero-slide-enter" style="background-image: url(\'' + s.bg + '\');">' +
        '<div class="absolute inset-0 bg-gradient-to-t from-comic-ink via-comic-ink/80 to-transparent"></div>' +
        '<div class="absolute inset-0 bg-gradient-to-r from-comic-ink via-comic-ink/65 to-transparent"></div>' +
        '<div class="absolute inset-0 bg-[radial-gradient(#FFE600_1px,transparent_1px)] [background-size:20px_20px] opacity-15 pointer-events-none"></div>' +

        '<div class="absolute top-6 left-6 z-20 flex items-center gap-2">' +
          '<div class="px-4 py-2 rounded-xl bg-comic-yellow text-comic-ink border-3 border-comic-ink font-bangers text-lg tracking-wider shadow-comic -rotate-3">' + escapeHtml(s.issue) + "</div>" +
          '<div class="hidden sm:inline-block px-3 py-1.5 rounded-lg bg-comic-pink text-white border-2 border-comic-ink font-fredoka font-black text-xs uppercase shadow-comic-sm rotate-2">' + escapeHtml(s.stamp) + "</div>" +
        "</div>" +

        '<div class="absolute top-6 right-6 hidden md:flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-comic-cyan text-comic-ink font-bangers text-lg tracking-wide border-3 border-comic-ink shadow-comic rotate-2">' +
          '<span class="material-symbols-outlined text-2xl font-bold">bolt</span> ' + escapeHtml(s.sticker) +
        "</div>" +

        '<div class="relative z-10 w-full p-6 sm:p-10 lg:p-12 pb-16 flex flex-col lg:flex-row lg:items-end justify-between gap-8">' +
          '<div class="max-w-3xl flex flex-col gap-4">' +
            '<div class="flex flex-wrap items-center gap-2.5">' + badges + "</div>" +

            '<div class="flex flex-col gap-1 pt-1">' +
              '<div class="inline-flex items-center gap-2 text-comic-cyan font-bangers text-xl tracking-wider drop-shadow-[2px_2px_0px_#0a0814]">' +
                '<span class="material-symbols-outlined text-2xl">auto_awesome</span> ' + escapeHtml(s.kicker) +
              "</div>" +
              '<h1 class="font-bangers text-5xl sm:text-6xl lg:text-7xl font-normal text-white tracking-wide uppercase leading-tight drop-shadow-[4px_4px_0px_#0a0814]">' +
                escapeHtml(s.pre) + ' <br class="hidden sm:inline">' +
                '<span class="text-comic-yellow bg-comic-ink/80 px-2 rounded-xl border-3 border-comic-yellow inline-block my-1 shadow-comic-yellow">' + escapeHtml(s.hi) + "</span> ⚡" +
              "</h1>" +
            "</div>" +

            '<div class="speech-bubble bg-comic-panel border-3 border-comic-ink p-4 rounded-2xl max-w-2xl shadow-comic">' +
              '<p class="font-fredoka text-sm sm:text-base text-gray-200 leading-relaxed font-semibold">“' + escapeHtml(s.synopsis) + "”</p>" +
            "</div>" +

            '<div class="flex flex-wrap items-center gap-4 pt-3">' +
              '<a class="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-comic-yellow hover:bg-white text-comic-ink font-bangers text-2xl tracking-wider border-3 border-comic-ink shadow-comic comic-btn group" href="' + links.player(s.id) + '">' +
                '<span class="w-9 h-9 rounded-xl bg-comic-ink text-comic-yellow flex items-center justify-center border-2 border-comic-ink group-hover:scale-110 transition-transform">' +
                  '<span class="material-symbols-outlined text-2xl" style="font-variation-settings: \'FILL\' 1;">play_arrow</span>' +
                "</span><span>" + escapeHtml(s.play) + "</span>" +
              "</a>" +
              '<button class="inline-flex items-center gap-2.5 px-6 py-4 rounded-2xl bg-comic-purple hover:bg-comic-pink text-white font-fredoka font-black text-sm uppercase tracking-wider border-3 border-comic-ink shadow-comic comic-btn" data-stash="' + s.id + '" type="button">' +
                '<span class="material-symbols-outlined text-comic-yellow text-xl">bookmark_add</span>' +
                '<span data-stash-label>Add to My Stash</span>' +
              "</button>" +
              '<button id="hero-info" class="w-14 h-14 rounded-2xl bg-comic-cyan hover:bg-comic-yellow text-comic-ink border-3 border-comic-ink shadow-comic flex items-center justify-center comic-btn" title="Title details" aria-label="Title details" type="button">' +
                '<span class="material-symbols-outlined text-2xl font-black">info</span>' +
              "</button>" +
            "</div>" +
          "</div>" +

          '<div class="flex items-center gap-3 self-end">' +
            '<button aria-label="' + (muted ? "Unmute sound" : "Mute sound") + '" class="w-12 h-12 rounded-2xl bg-comic-panel border-3 border-comic-ink text-comic-yellow hover:bg-comic-yellow hover:text-comic-ink shadow-comic flex items-center justify-center comic-btn" id="hero-mute-toggle" type="button">' +
              '<span class="material-symbols-outlined text-xl" id="hero-mute-icon">' + (muted ? "volume_off" : "volume_up") + "</span>" +
            "</button>" +
            '<div class="px-4 py-2.5 rounded-2xl bg-comic-pink text-white font-bangers text-lg tracking-wider border-3 border-comic-ink shadow-comic flex items-center gap-1.5 -rotate-2">' +
              '<span class="material-symbols-outlined text-base">family_restroom</span> ' + escapeHtml(s.rating) +
            "</div>" +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function updateHeroStashLabel() {
    const btn = $("#hero-slide [data-stash]");
    const label = $("#hero-slide [data-stash-label]");
    if (!btn || !label) return;
    label.textContent = stash.has(btn.dataset.stash) ? "In My Stash!" : "Add to My Stash";
    btn.classList.toggle("!bg-comic-yellow", stash.has(btn.dataset.stash));
    btn.classList.toggle("!text-comic-ink", stash.has(btn.dataset.stash));
  }

  function showEmptyHero() {
    $("#hero-slide").innerHTML =
      '<div class="w-full min-h-[360px] flex flex-col items-center justify-center gap-3 p-10 text-center font-fredoka">' +
        '<div class="text-6xl">📼</div><h2 class="font-bangers text-4xl text-comic-yellow tracking-wide">Nothing to stream yet</h2>' +
        '<p class="text-sm text-gray-300 max-w-md">Add your series and movie packs from archive.org in <b>config.js</b> and they will show up here.</p></div>';
    ["#hero-prev", "#hero-next", "#hero-dots"].forEach((q) => { const el = $(q); if (el) el.style.display = "none"; });
  }

  function renderDots() {
    ["#hero-prev", "#hero-next", "#hero-dots"].forEach((q) => { const el = $(q); if (el) el.style.display = ""; });
    $("#hero-dots").innerHTML = slides.map((s, i) =>
      '<button type="button" aria-label="Show slide ' + (i + 1) + ': ' + escapeHtml(s.hi) + '"></button>'
    ).join("");
  }

  /* Llegan películas o metadatos (portadas, notas...): reconstruir solo si cambió algo */
  function refreshHero() {
    const next = buildSlides();
    if (JSON.stringify(next) === JSON.stringify(slides)) return;
    const same = next.length === slides.length && next.every((s, i) => s.id === slides[i].id);
    slides = next;
    if (!slides.length) { showEmptyHero(); return; }
    if (!same) { renderDots(); heroIndex = 0; }
    showSlide(heroIndex);
  }

  function showSlide(i) {
    if (!slides.length) { showEmptyHero(); return; }
    heroIndex = (i + slides.length) % slides.length;
    const s = slides[heroIndex];
    $("#hero-slide").innerHTML = heroHtml(s);
    Lumina.syncStashButtons();
    updateHeroStashLabel();

    $("#hero-info").addEventListener("click", () => {
      const t = byId(s.id);
      modal(
        '<div class="flex gap-4">' +
          '<img alt="" class="w-28 h-40 rounded-xl object-cover border-3 border-comic-ink shadow-comic-sm" src="' + t.img + '">' +
          '<div class="min-w-0"><h3 class="font-bangers text-3xl text-comic-yellow tracking-wide leading-tight">' + escapeHtml(t.title) + "</h3>" +
          '<p class="font-fredoka text-xs font-bold text-comic-cyan mt-1">' + escapeHtml(t.genre) + " • " + t.year + " • ★ " + t.score + "</p>" +
          '<p class="font-fredoka text-xs text-gray-300 mt-2">' + escapeHtml(t.audio) + " • " + escapeHtml(t.rating) + "</p></div>" +
        "</div>" +
        '<p class="font-fredoka text-sm text-gray-200 leading-relaxed mt-4">' + escapeHtml(t.desc) + "</p>" +
        '<div class="flex gap-3 justify-end mt-6">' +
          '<button data-close type="button" class="px-4 py-2 rounded-xl bg-comic-dark text-white font-fredoka font-bold text-sm border-2 border-comic-ink shadow-comic-sm comic-btn">Close</button>' +
          '<a href="' + links.player(t.id) + '" class="px-5 py-2 rounded-xl bg-comic-yellow text-comic-ink font-bangers text-lg tracking-wide border-2 border-comic-ink shadow-comic-sm comic-btn">Play now</a>' +
        "</div>"
      );
    });

    $("#hero-mute-toggle").addEventListener("click", () => {
      muted = !muted;
      store.set("muted", muted);
      $("#hero-mute-icon").textContent = muted ? "volume_off" : "volume_up";
      $("#hero-mute-toggle").setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
    });

    $$("#hero-dots button").forEach((d, n) => {
      const on = n === heroIndex;
      d.className = "h-3 rounded-full border-2 border-comic-ink transition-all " + (on ? "w-10 bg-comic-yellow" : "w-3 bg-comic-panel hover:bg-comic-cyan");
      d.setAttribute("aria-current", on);
    });
  }

  function startHeroTimer() {
    clearInterval(heroTimer);
    heroTimer = setInterval(() => {
      if (!heroPaused && !document.hidden && slides.length > 1) showSlide(heroIndex + 1);
    }, 8000);
  }

  function initHero() {
    const frame = $("#hero-frame");
    slides = buildSlides();
    if (slides.length) renderDots();
    $("#hero-dots").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      showSlide($$("#hero-dots button").indexOf(b)); startHeroTimer();
    });
    $("#hero-prev").addEventListener("click", () => { showSlide(heroIndex - 1); startHeroTimer(); });
    $("#hero-next").addEventListener("click", () => { showSlide(heroIndex + 1); startHeroTimer(); });

    frame.addEventListener("mouseenter", () => { heroPaused = true; });
    frame.addEventListener("mouseleave", () => { heroPaused = false; });
    frame.addEventListener("focusin", () => { heroPaused = true; });
    frame.addEventListener("focusout", () => { heroPaused = false; });

    /* Swipe on touch screens */
    let touchX = null;
    frame.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    frame.addEventListener("touchend", (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) { showSlide(heroIndex + (dx < 0 ? 1 : -1)); startHeroTimer(); }
      touchX = null;
    });

    showSlide(0);
    startHeroTimer();
    Lumina.on("stash", updateHeroStashLabel);
  }

  /* ==========================================================
     CONTINUE WATCHING
     ========================================================== */
  function continueItems() {
    const prog = progress.all();
    const hidden = store.get("hiddenSeed", []);
    const ids = new Set();
    Object.keys(DATA.continueSeed).forEach((id) => { if (hidden.indexOf(id) === -1) ids.add(id); });
    Object.keys(prog).forEach((id) => ids.add(id));
    return Array.from(ids).map(byId).filter(Boolean)
      .filter((t) => { const r = progress.ratio(t.id); return r > 0 && r < 0.97; })
      .sort((a, b) => ((prog[b.id] || {}).at || 0) - ((prog[a.id] || {}).at || 0));
  }

  function continueCard(t, i) {
    const c = accent(i + 1);
    const ratio = progress.ratio(t.id);
    const pct = Math.round(ratio * 100);
    const left = Math.max(1, Math.round((1 - ratio) * t.mins));
    const tag = t.kind === "series" ? t.episode.split(":")[0] : "TOON MOVIE";
    const sub = t.kind === "series" ? t.episode.split(":").slice(1).join(":").trim() : t.genre;
    return (
      '<article class="flex-none w-[300px] sm:w-[360px] lg:w-[390px] snap-start comic-card cursor-pointer flex flex-col group relative" data-play="' + t.id + '" tabindex="0" role="link" aria-label="Resume ' + escapeHtml(t.title) + '">' +
        '<div class="relative aspect-video w-full rounded-2xl overflow-hidden bg-comic-ink border-3 border-comic-ink shadow-comic group-hover:border-comic-' + c + ' transition-all">' +
          '<img alt="' + escapeHtml(t.title) + '" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" src="' + t.img + '" loading="lazy">' +
          '<div class="absolute inset-0 bg-gradient-to-t from-comic-ink via-transparent to-transparent"></div>' +
          '<span class="absolute top-3 left-3 px-3 py-1 rounded-lg bg-comic-' + c + " " + onAccent(c) + ' font-bangers text-xs tracking-wider border-2 border-comic-ink shadow-comic-sm -rotate-2">' + escapeHtml(tag.toUpperCase()) + "</span>" +
          '<button type="button" data-remove-continue="' + t.id + '" aria-label="Remove from Continue Watching" class="absolute top-3 right-3 w-8 h-8 rounded-lg bg-comic-ink/80 text-white hover:bg-comic-pink border-2 border-comic-ink flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"><span class="material-symbols-outlined text-lg">close</span></button>' +
          '<div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-comic-ink/50 pointer-events-none">' +
            '<div class="w-14 h-14 rounded-2xl bg-comic-' + c + " " + onAccent(c) + ' border-3 border-comic-ink flex items-center justify-center shadow-comic scale-90 group-hover:scale-100 transition-transform"><span class="material-symbols-outlined text-3xl font-black" style="font-variation-settings: \'FILL\' 1;">play_arrow</span></div>' +
          "</div>" +
          '<div class="absolute bottom-2.5 inset-x-3 bg-comic-ink p-1 rounded-lg border-2 border-comic-ink shadow-comic-sm">' +
            '<div class="flex items-center justify-between text-[9px] font-fredoka font-black text-comic-' + (c === "purple" ? "yellow" : c) + ' pb-0.5 uppercase tracking-wide"><span>Progress</span><span>' + pct + "%" + (pct >= 85 ? " (almost done!)" : "") + "</span></div>" +
            '<div class="w-full h-2.5 bg-comic-panel rounded-md overflow-hidden border border-comic-ink"><div class="h-full bg-gradient-to-r from-comic-pink to-comic-yellow arcade-pattern rounded-sm" style="width: ' + pct + '%;"></div></div>' +
          "</div>" +
        "</div>" +
        '<div class="pt-3 px-1 flex items-center justify-between">' +
          '<div class="min-w-0"><h3 class="font-bangers text-xl text-white group-hover:text-comic-' + c + ' transition-colors tracking-wide truncate">' + escapeHtml(t.title) + "</h3>" +
          '<p class="font-fredoka text-xs text-gray-300 font-semibold truncate">' + left + " min left • " + escapeHtml(sub) + "</p></div>" +
          '<span class="w-9 h-9 shrink-0 rounded-xl bg-comic-' + c + " " + onAccent(c) + ' border-2 border-comic-ink shadow-comic-sm flex items-center justify-center group-hover:rotate-12 transition-transform"><span class="material-symbols-outlined text-xl font-bold">play_arrow</span></span>' +
        "</div>" +
      "</article>"
    );
  }

  function renderContinue() {
    const items = continueItems();
    const section = $("#continue");
    const rail = $("#rail-continue");
    section.classList.toggle("hidden", false);
    rail.innerHTML = items.length
      ? items.map(continueCard).join("")
      : '<div class="w-full p-8 bg-comic-panel border-3 border-comic-ink rounded-2xl shadow-comic font-fredoka text-center">' +
          '<div class="text-4xl mb-2">🍿</div><p class="font-bold text-white">Nothing paused right now</p>' +
          '<p class="text-sm text-gray-300 mb-4">Start any title and it will show up here.</p>' +
          '<a class="inline-block px-5 py-2 rounded-xl bg-comic-yellow text-comic-ink font-bangers text-lg border-2 border-comic-ink shadow-comic-sm comic-btn" href="' + links.movies + '">Browse movies</a></div>';
    $$("img", rail).forEach(Lumina.fallbackImg);
  }

  /* ==========================================================
     TRENDING
     ========================================================== */
  function trendingCard(t, i) {
    const c = accent(i);
    const c2 = accent(i + 2);
    const tag = TAG_LABEL[(t.tags || [])[0]] || (t.kind === "series" ? "SERIES" : "MOVIE");
    const rot = ["-rotate-6", "-rotate-3", "-rotate-4", "-rotate-2", "-rotate-3"][i % 5];
    return (
      '<article class="snap-start comic-card flex flex-col group cursor-pointer" data-play="' + t.id + '" tabindex="0" role="link" aria-label="Play ' + escapeHtml(t.title) + '">' +
        '<div class="relative aspect-[2/3] w-full rounded-2xl overflow-hidden bg-comic-ink border-3 border-comic-ink shadow-comic group-hover:border-comic-' + c + ' transition-all">' +
          '<img alt="' + escapeHtml(t.title) + '" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" src="' + t.img + '" loading="lazy">' +
          '<div class="absolute inset-0 bg-gradient-to-t from-comic-ink via-transparent to-transparent"></div>' +
          '<span class="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-comic-' + c + " " + onAccent(c) + " font-bangers text-xs tracking-wider border-2 border-comic-ink shadow-comic-sm " + rot + '">★ ' + Number(t.score).toFixed(1) + " " + srcTag(t) + "</span>" +
          '<span class="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-comic-' + c2 + " " + onAccent(c2) + ' font-bangers text-[11px] tracking-wider border-2 border-comic-ink shadow-comic-sm rotate-3">' + tag + "</span>" +
          Lumina.bookmarkButton(t.id, "absolute bottom-2.5 right-2.5 w-9 h-9 rounded-lg bg-comic-ink/85 text-comic-yellow hover:bg-comic-yellow hover:text-comic-ink border-2 border-comic-ink flex items-center justify-center") +
          '<div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-comic-ink/40 pointer-events-none">' +
            '<div class="w-12 h-12 rounded-xl bg-comic-' + c + " " + onAccent(c) + ' border-2 border-comic-ink flex items-center justify-center shadow-comic"><span class="material-symbols-outlined text-2xl font-black">play_arrow</span></div>' +
          "</div>" +
        "</div>" +
        '<div class="pt-2.5 px-1 flex flex-col">' +
          '<h3 class="font-bangers text-lg text-white truncate group-hover:text-comic-' + c + ' transition-colors tracking-wide">' + escapeHtml(t.title) + "</h3>" +
          '<p class="font-fredoka text-xs text-comic-' + (c === "purple" ? "pink" : c) + ' font-bold truncate">' + escapeHtml(t.genre) + "</p>" +
        "</div>" +
      "</article>"
    );
  }

  function renderTrending() {
    const rail = $("#rail-trending");
    const ids = DATA.trendingIds.slice();
    DATA.titles.filter((t) => t.kind === "movie" && t.source === "archive")
      .sort((a, b) => b.score - a.score).forEach((t) => { if (ids.indexOf(t.id) === -1) ids.push(t.id); });
    const list = ids.slice(0, 10).map(byId).filter(Boolean);
    rail.innerHTML = list.length ? list.map(trendingCard).join("") : '<p class="font-fredoka text-gray-300">Nothing trending yet.</p>';
    $$("img", rail).forEach(Lumina.fallbackImg);
  }

  /* ==========================================================
     TOP 10 (ranked by views, filterable)
     ========================================================== */
  let topFilter = "all";

  function topCard(t, i) {
    const c = accent(i);
    const rot = i % 2 ? "-rotate-3" : "-rotate-6";
    const label = i === 0 ? "THE TOON KING!" : (TAG_LABEL[(t.tags || [])[0]] || "TOON") + " PICK";
    const numColor = c === "purple" ? "comic-purple" : "comic-" + c;
    return (
      '<article class="flex-none snap-start flex items-end group cursor-pointer comic-card" data-play="' + t.id + '" tabindex="0" role="link" aria-label="Rank ' + (i + 1) + ': ' + escapeHtml(t.title) + '">' +
        '<span class="font-bangers text-[150px] lg:text-[170px] leading-none select-none -mr-9 lg:-mr-11 z-10 text-' + numColor + " drop-shadow-[7px_7px_0px_#0a0814] " + rot + '" style="-webkit-text-stroke: 4.5px #0a0814;">' + (i + 1) + "</span>" +
        '<div class="relative w-[190px] lg:w-[220px] aspect-[2/3] rounded-2xl overflow-hidden bg-comic-ink border-3 border-comic-' + c + ' shadow-comic-xl">' +
          '<img alt="' + escapeHtml(t.title) + '" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" src="' + t.img + '" loading="lazy">' +
          '<div class="absolute inset-0 bg-gradient-to-t from-comic-ink via-transparent to-transparent"></div>' +
          '<div class="absolute bottom-3 left-3 right-3 flex flex-col">' +
            '<span class="px-2 py-0.5 rounded-md bg-comic-' + c + " " + onAccent(c) + ' font-bangers text-[10px] tracking-wider border border-comic-ink inline-block w-fit mb-1">' + escapeHtml(label) + "</span>" +
            '<h4 class="font-bangers text-lg text-white truncate tracking-wide">' + escapeHtml(t.title) + "</h4>" +
          "</div>" +
        "</div>" +
      "</article>"
    );
  }

  function renderTop() {
    const list = DATA.titles
      .filter((t) => topFilter === "all" || (t.tags || []).indexOf(topFilter) > -1)
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
    const rail = $("#rail-top");
    rail.innerHTML = list.length ? list.map(topCard).join("") : '<p class="font-fredoka text-gray-300">Nothing ranked in this category yet.</p>';
    rail.scrollTo({ left: 0 });
    $$("img", rail).forEach(Lumina.fallbackImg);
  }

  function initTopFilters() {
    const box = $("#filter-pills");
    const base = "px-4 py-2 rounded-xl font-fredoka text-xs uppercase border-2 border-comic-ink shadow-comic-sm comic-btn whitespace-nowrap ";
    const render = () => {
      box.innerHTML = DATA.topFilters.map((f, i) => {
        const on = f.key === topFilter;
        return '<button type="button" data-key="' + f.key + '" aria-pressed="' + on + '" class="' + base +
          (on ? "bg-comic-yellow text-comic-ink font-black -rotate-1" : "bg-comic-panel hover:bg-comic-" + accent(i + 1) + " hover:text-comic-ink text-gray-200 font-bold") + '">' + f.label + "</button>";
      }).join("");
    };
    render();
    box.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-key]");
      if (!btn) return;
      topFilter = btn.dataset.key;
      render();
      renderTop();
    });
  }

  /* ==========================================================
     AVATAR PATCHES
     ========================================================== */
  function initPatches() {
    const box = $("#avatar-patches");
    if (!box) return;
    const mark = () => {
      const chosen = store.get("avatar", "");
      $$("button", box).forEach((b) => {
        const on = b.dataset.emoji === chosen;
        b.setAttribute("aria-pressed", on);
        b.classList.toggle("ring-4", on);
        b.classList.toggle("ring-white", on);
      });
    };
    box.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-emoji]");
      if (!btn) return;
      store.set("avatar", btn.dataset.emoji);
      Lumina.applyAvatar();
      mark();
      toast("New avatar patch applied " + btn.dataset.emoji);
    });
    mark();
  }

  /* ---------- Rail arrows already wired by common.js; add drag-scroll ---------- */
  function initRails() {
    ["rail-continue", "rail-trending", "rail-top"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) Lumina.enableDragScroll(el);
    });
  }

  /* ---------- Boot ---------- */
  initHero();
  renderContinue();
  renderTrending();
  initTopFilters();
  renderTop();
  initPatches();
  initRails();

  /* Re-render Continue Watching after actions or when returning from the player */
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove-continue]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    progress.remove(btn.dataset.removeContinue);
    toast("Removed from Continue Watching");
  }, true);
  Lumina.on("progress", renderContinue);
  Lumina.on("catalog", () => { renderContinue(); renderTrending(); renderTop(); refreshHero(); });   // películas de archive.org
  Lumina.on("meta", () => { renderTrending(); renderTop(); refreshHero(); });                         // portadas / notas
  window.addEventListener("pageshow", renderContinue);
})();
