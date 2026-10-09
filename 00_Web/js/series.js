/* ==========================================================
   series.js  -  series.html
   Vista 1 (sin parámetros): catálogo + "Streaming From The Archive".
   Vista 2 (?id=<serie>):    ficha de la serie con temporadas y episodios.
   Depende de: data.js, config.js, common.js, archive.js, meta.js
   ========================================================== */
(function () {
  "use strict";

  const { $, links, escapeHtml: esc, formatMins, debounce, highlight, progress, store } = Lumina;
  const A = Lumina.archive;
  const ACCENTS = ["yellow", "pink", "cyan", "lime", "purple"];
  const accent = (i) => ACCENTS[i % ACCENTS.length];
  const onAccent = (c) => (c === "pink" || c === "purple" ? "text-white" : "text-comic-ink");
  const textAccent = (c) => "text-comic-" + (c === "purple" ? "pink" : c);
  const PAGE_SIZE = 10;
  const EP_PAGE = 30;

  const isRoot = (t) => t.kind === "series" && !t.seriesId;
  const allSeries = () => DATA.titles.filter(isRoot);
  const isArchive = (t) => t.source === "archive";

  const notice = (html, kind) => {
    const box = $("#archive-notice");
    if (!box) return;
    box.innerHTML = html
      ? '<div class="px-4 py-3 rounded-xl border-2 border-comic-ink shadow-comic-sm font-fredoka text-sm font-bold ' +
        (kind === "error" ? "bg-comic-pink text-white" : "bg-comic-cyan text-comic-ink") + '">' + html + "</div>"
      : "";
  };

  const params = new URLSearchParams(location.search);
  const detailId = params.get("id");

  /* ==========================================================
     VISTA 1: CATÁLOGO
     ========================================================== */
  const state = {
    q: params.get("q") || "",
    genre: params.get("genre") || "all",
    sort: params.get("sort") || "views",
    visible: PAGE_SIZE
  };
  const GENRES = DATA.genres.map((g) => (g.key === "all" ? Object.assign({}, g, { label: "📺 All Series" }) : g));
  if (!GENRES.some((g) => g.key === state.genre)) state.genre = "all";

  const SORTS = [
    { key: "views", label: "Most Watched 🔥" },
    { key: "az", label: "A-Z 🔤" },
    { key: "year", label: "Release Year 📅" },
    { key: "rated", label: "Top Rated ⭐" }
  ];
  const SORT_FNS = {
    views: (a, b) => b.views - a.views,
    az: (a, b) => a.title.localeCompare(b.title),
    year: (a, b) => b.year - a.year || b.views - a.views,
    rated: (a, b) => b.score - a.score || b.views - a.views
  };

  function filtered() {
    const q = state.q.trim().toLowerCase();
    return allSeries()
      .filter((t) => state.genre === "all" || (t.tags || []).indexOf(state.genre) > -1)
      .filter((t) => !q || (t.title + " " + t.genre + " " + t.desc).toLowerCase().indexOf(q) > -1)
      .sort(SORT_FNS[state.sort] || SORT_FNS.views);
  }

  function seriesCard(t, i, q) {
    const c = accent(i), c2 = accent(i + 2);
    return (
      '<div class="bg-comic-dark rounded-xl border-3 border-comic-ink p-3 shadow-comic group hover:-translate-y-2 transition-all flex flex-col justify-between cursor-pointer" data-play="' + esc(t.id) + '" tabindex="0" role="link" aria-label="Open ' + esc(t.title) + '">' +
        '<div class="relative aspect-[2/3] rounded-lg overflow-hidden border-2 border-comic-ink bg-comic-ink mb-2.5">' +
          '<img alt="' + esc(t.title) + '" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" src="' + esc(t.img) + '" loading="lazy">' +
          '<div class="absolute top-2 left-2 bg-comic-yellow text-comic-ink font-bangers text-xs px-2 py-0.5 rounded border border-comic-ink shadow-comic-sm ' + (i % 2 ? "rotate-2" : "-rotate-2") + '">★ ' + Number(t.score).toFixed(1) + (t.imdb ? " IMDb" : " Pop") + "</div>" +
          '<div class="absolute top-2 right-2 bg-comic-' + c2 + " " + onAccent(c2) + ' font-fredoka font-black text-[10px] px-2 py-0.5 rounded border border-comic-ink shadow-comic-sm uppercase">' + esc(t.badge) + "</div>" +
          '<div class="absolute inset-0 bg-comic-ink/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">' +
            '<span class="w-12 h-12 rounded-full bg-comic-' + c + " " + onAccent(c) + ' border-2 border-comic-ink flex items-center justify-center shadow-comic-sm"><span class="material-symbols-outlined text-2xl">play_arrow</span></span>' +
          "</div>" +
        "</div>" +
        '<div><div class="flex items-center gap-1.5 ' + textAccent(c) + ' text-xs font-fredoka font-bold mb-1"><span class="truncate">' + esc(t.genre) + "</span> • <span>" + t.year + "</span></div>" +
        '<h3 class="font-bangers text-lg text-white tracking-wide truncate group-hover:text-comic-' + c + ' transition-colors">' + highlight(t.title, q) + "</h3>" +
        '<p class="font-fredoka text-xs text-gray-300 mt-1 clamp-2">' + esc(t.desc) + "</p></div>" +
        '<div class="pt-3 mt-2 border-t border-comic-panel flex items-center justify-between">' +
          '<span class="text-[11px] font-fredoka ' + textAccent(c2) + ' font-bold truncate pr-2" data-eps="' + esc(t.id) + '">' + (isArchive(t) ? "☁ archive.org" : esc(t.episode || "Series")) + "</span>" +
          Lumina.bookmarkButton(t.id, "text-gray-300 hover:text-comic-yellow transition-colors [&.is-saved]:text-comic-yellow") +
        "</div>" +
      "</div>"
    );
  }

  function syncUrl() {
    const p = new URLSearchParams();
    if (state.q.trim()) p.set("q", state.q.trim());
    if (state.genre !== "all") p.set("genre", state.genre);
    if (state.sort !== "views") p.set("sort", state.sort);
    const qs = p.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
  }

  function renderCatalog() {
    const all = filtered();
    const shown = all.slice(0, state.visible);
    const q = state.q.trim();
    $("#series-grid").innerHTML = shown.map((t, i) => seriesCard(t, i, q)).join("");
    $("#catalog-count").textContent = "Showing " + shown.length + " of " + all.length + " series";
    $("#catalog-total").textContent = "+" + allSeries().length + " TITLES AVAILABLE";
    $("#catalog-empty").classList.toggle("hidden", all.length > 0);
    $("#catalog-empty-q").textContent = q ? "“" + q + "”" : "these filters";

    const remaining = all.length - shown.length;
    $("#btn-load-more").parentElement.classList.toggle("hidden", remaining <= 0);
    $("#load-more-label").textContent = "Load More Series (+" + Math.min(PAGE_SIZE, remaining) + " Titles) 💥";

    $("#sort-buttons").innerHTML = SORTS.map((s) => {
      const on = s.key === state.sort;
      return '<button type="button" data-sort="' + s.key + '" aria-pressed="' + on + '" class="px-3 py-1.5 rounded-lg font-fredoka font-bold text-xs border border-comic-ink shrink-0 ' +
        (on ? "bg-comic-yellow text-comic-ink shadow-comic-sm" : "bg-comic-panel text-white hover:text-comic-yellow") + '">' + s.label + "</button>";
    }).join("");

    const base = "genre-pill px-4 py-2 rounded-xl font-fredoka text-xs border-2 border-comic-ink shadow-comic-sm shrink-0 comic-btn ";
    $("#genre-filters").innerHTML = GENRES.map((g) => {
      const on = g.key === state.genre;
      return '<button type="button" data-genre="' + g.key + '" aria-pressed="' + on + '" class="' + base +
        (on ? "bg-comic-pink text-white font-black -rotate-1" : "bg-comic-panel " + g.hover + " hover:text-comic-ink text-white font-bold transition-colors") + '">' + g.label + "</button>";
    }).join("");

    Lumina.$$("img", $("#series-grid")).forEach(Lumina.fallbackImg);
    syncUrl();
  }

  /* ---------- Hero ---------- */
  function paintHero() {
    const list = allSeries();
    const t = list.filter(isArchive)[0] || list.sort(SORT_FNS.views)[0];
    if (!t) return;
    const badge = (cls, txt) => '<span class="px-3 py-1 rounded-xl ' + cls + ' font-fredoka font-black text-xs uppercase border-2 border-comic-ink shadow-comic-sm">' + esc(txt) + "</span>";
    $("#hero-badges").innerHTML =
      badge("bg-comic-yellow text-comic-ink", t.badge) +
      badge("bg-comic-purple text-comic-yellow", "★ " + Number(t.score).toFixed(1) + (t.imdb ? " IMDb" : " Pop Score")) +
      badge("bg-comic-lime text-comic-ink", t.rating);
    $("#hero-title").textContent = t.title;
    $("#hero-genre").textContent = t.genre;
    $("#hero-desc").textContent = t.desc;
    $("#hero-meta").innerHTML =
      '<span class="font-bold text-comic-yellow">' + t.year + "</span><span class=\"text-comic-pink\">•</span>" +
      '<span class="font-bold text-white">' + esc(t.audio) + "</span>";
    const img = $("#hero-img"); img.src = t.img; img.alt = "Poster of " + t.title; Lumina.fallbackImg(img);
    $("#hero-tag").textContent = isArchive(t) ? "Streaming from archive.org" : "Binge mode";
    $("#btn-hero-watch").href = links.player(t.id);
    $("#btn-hero-stash").dataset.stash = t.id;
    Lumina.syncStashButtons();
  }

  /* ---------- Sección archive.org ---------- */
  function renderArchiveGrid() {
    const list = allSeries().filter(isArchive);
    $("#archive-grid").innerHTML = list.map((t, i) => seriesCard(t, i, "")).join("");
    Lumina.$$("img", $("#archive-grid")).forEach(Lumina.fallbackImg);
    $("#archive-count").textContent = list.length + (list.length === 1 ? " series" : " series") + " • loading…";

    let total = 0, done = 0;
    list.forEach((t) => {
      A.loadSeries(t.id).then((d) => {
        total += d.episodes.length;
        Lumina.$$('[data-eps="' + t.id + '"]').forEach((el) => { el.textContent = "☁ " + d.episodes.length + " episodes"; });
      }).catch((err) => {
        notice("😿 No se pudo leer «" + esc(t.title) + "» desde archive.org (" + esc(err.message) + "). Comprueba que el identificador es público y vuelve a cargar.", "error");
      }).finally(() => {
        if (++done === list.length) $("#archive-count").textContent = list.length + " series • " + total + " episodes";
      });
    });
  }

  function initCatalog() {
    const input = $("#catalog-search-input");
    input.value = state.q;
    input.addEventListener("input", debounce(() => { state.q = input.value; state.visible = PAGE_SIZE; renderCatalog(); }, 150));
    $("#sort-buttons").addEventListener("click", (e) => {
      const b = e.target.closest("[data-sort]"); if (!b) return;
      state.sort = b.dataset.sort; state.visible = PAGE_SIZE; renderCatalog();
    });
    $("#genre-filters").addEventListener("click", (e) => {
      const b = e.target.closest("[data-genre]"); if (!b) return;
      state.genre = b.dataset.genre; state.visible = PAGE_SIZE; renderCatalog();
    });
    $("#btn-load-more").addEventListener("click", () => { state.visible += PAGE_SIZE; renderCatalog(); });
    $("#btn-clear-filters").addEventListener("click", () => {
      state.q = ""; state.genre = "all"; state.sort = "views"; state.visible = PAGE_SIZE; input.value = ""; renderCatalog();
    });
    $("#ticker-count").textContent = "MORE THAN " + allSeries().length + " SERIES READY TO BINGE!";
    paintHero();
    renderArchiveGrid();
    renderCatalog();
    Lumina.on("meta", () => { paintHero(); renderCatalog(); renderArchiveGridCards(); });
  }

  /* Tras llegar metadatos nuevos, repinta las tarjetas sin volver a pedir episodios */
  function renderArchiveGridCards() {
    const list = allSeries().filter(isArchive);
    $("#archive-grid").innerHTML = list.map((t, i) => seriesCard(t, i, "")).join("");
    list.forEach((t) => {
      const d = A.siblings(t.id);
      if (d.length) Lumina.$$('[data-eps="' + t.id + '"]').forEach((el) => { el.textContent = "☁ " + d.length + " episodes"; });
    });
  }

  /* ==========================================================
     VISTA 2: FICHA DE UNA SERIE
     ========================================================== */
  const ds = { season: null, q: "", visible: EP_PAGE, data: null, series: null, start: null };

  function epRow(ep, i) {
    const c = accent(i);
    const r = progress.ratio(ep.id);
    const pct = Math.round(r * 100);
    return (
      '<a href="' + links.player(ep.id) + '" class="group flex items-center gap-4 p-3 rounded-xl bg-comic-dark border-2 border-comic-ink shadow-comic-sm hover:-translate-y-1 transition-all">' +
        '<span class="w-12 h-12 shrink-0 rounded-xl bg-comic-' + c + " " + onAccent(c) + ' border-2 border-comic-ink font-bangers text-xl flex items-center justify-center shadow-comic-sm">' + ep.num + "</span>" +
        '<span class="flex-1 min-w-0"><span class="block font-bangers text-lg text-white tracking-wide truncate group-hover:text-comic-yellow transition-colors">' + highlight(ep.epTitle, ds.q) + "</span>" +
          '<span class="block font-fredoka text-xs text-gray-400 font-semibold">S' + ep.season + " • E" + ep.num + " • " + formatMins(ep.mins) +
            (ep.released ? " • " + esc(ep.released) : "") + (ep.imdbEpisodeId && ep.score ? " • ★ " + Number(ep.score).toFixed(1) : "") + "</span>" +
          (pct > 0 && pct < 97 ? '<span class="block mt-1.5 h-1.5 rounded-full bg-comic-ink overflow-hidden"><span class="block h-full bg-comic-pink" style="width:' + pct + '%"></span></span>' : "") +
        "</span>" +
        '<span class="w-10 h-10 shrink-0 rounded-lg bg-comic-yellow text-comic-ink border-2 border-comic-ink flex items-center justify-center"><span class="material-symbols-outlined">play_arrow</span></span>' +
      "</a>"
    );
  }

  function renderEpisodes() {
    const d = ds.data;
    if (!d) return;
    const q = ds.q.trim().toLowerCase();
    const inSeason = d.episodes.filter((e) => e.season === ds.season);
    const list = inSeason.filter((e) => !q || (e.epTitle + " " + e.num + " " + e.fileTitle).toLowerCase().indexOf(q) > -1);
    const shown = list.slice(0, ds.visible);

    $("#d-seasons").innerHTML = d.seasons.length > 1 ? d.seasons.map((s) => {
      const on = s === ds.season;
      return '<button type="button" data-season="' + s + '" aria-pressed="' + on + '" class="px-4 py-2 rounded-xl font-fredoka text-xs border-2 border-comic-ink shadow-comic-sm shrink-0 comic-btn ' +
        (on ? "bg-comic-pink text-white font-black" : "bg-comic-panel text-white font-bold hover:bg-comic-yellow hover:text-comic-ink") + '">Season ' + s + "</button>";
    }).join("") : "";

    $("#d-episodes").innerHTML = shown.length
      ? shown.map(epRow).join("")
      : '<div class="text-center py-10 font-fredoka text-gray-300"><div class="text-4xl mb-2">🔍</div>No episodes match.</div>';
    $("#d-count").textContent = "Showing " + shown.length + " of " + list.length + " episodes" + (d.seasons.length > 1 ? " • Season " + ds.season : "");
    $("#d-more").hidden = list.length <= shown.length;
  }

  function detailHero(t, ep) {
    const badge = (cls, txt) => '<span class="px-3 py-1 rounded-xl ' + cls + ' font-fredoka font-black text-xs uppercase border-2 border-comic-ink shadow-comic-sm">' + esc(txt) + "</span>";
    const imdb = t.imdb || null;
    const prog = ep && progress.get(ep.id);
    const watchLabel = !ep ? "Watch Now!" : prog && prog.t > 5 ? "Continue S" + ep.season + " E" + ep.num : "Start watching";
    $("#d-hero").innerHTML =
      '<div class="bg-comic-panel border-3 border-comic-ink rounded-2xl p-6 sm:p-8 shadow-comic grid grid-cols-1 md:grid-cols-12 gap-8 items-start">' +
        '<div class="md:col-span-3"><div class="aspect-[2/3] rounded-xl overflow-hidden border-3 border-comic-ink shadow-comic bg-comic-ink">' +
          '<img id="d-poster" alt="Poster of ' + esc(t.title) + '" class="w-full h-full object-cover" src="' + esc(t.img) + '"></div></div>' +
        '<div class="md:col-span-9 flex flex-col gap-4">' +
          '<div class="flex flex-wrap gap-2.5">' +
            badge("bg-comic-yellow text-comic-ink", t.badge) +
            badge("bg-comic-purple text-comic-yellow", "★ " + Number(t.score).toFixed(1) + (imdb ? " IMDb" : " Pop Score")) +
            badge("bg-comic-lime text-comic-ink", t.rating) +
            badge("bg-comic-cyan text-comic-ink", String(t.year)) +
            (imdb && imdb.seasons ? badge("bg-comic-pink text-white", imdb.seasons + " seasons") : "") +
          "</div>" +
          '<h1 class="font-bangers text-4xl sm:text-6xl text-white tracking-wide leading-tight drop-shadow-[3px_3px_0px_#0a0814]">' + esc(t.title) + "</h1>" +
          '<div class="text-comic-cyan font-fredoka font-bold text-sm">' + esc(t.genre) + "</div>" +
          '<p class="font-fredoka text-sm sm:text-base text-gray-200 leading-relaxed max-w-3xl">' + esc(t.desc) + "</p>" +
          (imdb && imdb.actors ? '<p class="font-fredoka text-xs text-gray-400"><span class="text-comic-yellow font-black uppercase">Cast</span> ' + esc(imdb.actors) + "</p>" : "") +
          (imdb && imdb.id ? '<a class="font-fredoka text-xs font-bold text-comic-yellow underline w-fit" target="_blank" rel="noopener" href="https://www.imdb.com/title/' + esc(imdb.id) + '/">View on IMDb ↗</a>' : "") +
          '<div class="flex flex-wrap items-center gap-4 pt-2">' +
            (ep || !isArchive(t)
              ? '<a href="' + links.player(ep ? ep.id : t.id) + '" class="px-6 py-3.5 rounded-xl bg-comic-yellow hover:bg-comic-lime text-comic-ink font-bangers text-xl tracking-wide border-3 border-comic-ink shadow-comic flex items-center gap-2.5 comic-btn"><span class="material-symbols-outlined text-2xl" style="font-variation-settings: \'FILL\' 1;">play_arrow</span> ' + esc(watchLabel) + "</a>"
              : "") +
            '<button type="button" data-stash="' + esc(t.id) + '" class="w-12 h-12 rounded-xl bg-comic-dark hover:bg-comic-cyan hover:text-comic-ink text-white border-3 border-comic-ink shadow-comic flex items-center justify-center comic-btn [&.is-saved]:bg-comic-yellow [&.is-saved]:text-comic-ink"><span class="material-symbols-outlined text-xl">bookmark_add</span></button>' +
          "</div>" +
        "</div>" +
      "</div>";
    Lumina.fallbackImg($("#d-poster"));
    Lumina.syncStashButtons();
  }

  async function showDetail(id) {
    $("#view-catalog").classList.add("hidden");
    const view = $("#view-detail");
    view.classList.remove("hidden"); view.classList.add("flex");

    const t = Lumina.byId(id);
    if (!t || !isRoot(t)) {
      $("#d-crumbs").innerHTML = "";
      $("#d-hero").innerHTML = '<div class="text-center py-16 font-fredoka"><div class="text-6xl mb-3">🕵️</div><h1 class="font-bangers text-4xl text-comic-yellow">Series not found</h1>' +
        '<a href="' + links.series + '" class="inline-block mt-5 px-6 py-3 rounded-xl bg-comic-yellow text-comic-ink font-bangers text-xl border-3 border-comic-ink shadow-comic comic-btn">Browse series</a></div>';
      return;
    }
    ds.series = t;
    document.title = t.title + " - Lumina Toon!";
    $("#d-crumbs").innerHTML =
      '<a class="hover:text-comic-yellow transition-colors" href="' + links.home + '">Home</a>' +
      '<span class="material-symbols-outlined text-base text-gray-500">chevron_right</span>' +
      '<a class="hover:text-comic-yellow transition-colors" href="' + links.series + '">Series &amp; Anime</a>' +
      '<span class="material-symbols-outlined text-base text-gray-500">chevron_right</span>' +
      '<span class="text-comic-yellow truncate">' + esc(t.title) + "</span>";
    detailHero(t, null);

    if (!isArchive(t)) {                         // serie de demostración: un solo capítulo
      ds.data = { seasons: [1], episodes: [{ id: t.id, season: 1, num: 1, epTitle: (t.episode || "Episode 1").replace(/^.*?:\s*/, ""), fileTitle: "", mins: t.mins }] };
      ds.season = 1; renderEpisodes(); return;
    }

    $("#d-episodes").innerHTML = '<div class="text-center py-10 font-fredoka text-gray-300"><div class="text-4xl mb-2 animate-bounce">📼</div>Loading episodes from archive.org…</div>';
    try {
      ds.data = await A.loadSeries(id);
      const start = await A.startEpisodeFor(id);
      ds.season = start ? start.season : ds.data.seasons[0];
      ds.start = start;
      detailHero(Lumina.byId(id), start);
      renderEpisodes();
      if (!ds.data.episodes.length) notice("Este item de archive.org no contiene vídeos reproducibles (mp4 / webm / ogv).", "error");
    } catch (err) {
      $("#d-episodes").innerHTML = '<div class="text-center py-10 font-fredoka"><div class="text-5xl mb-2">🙈</div><p class="font-bold text-white">No pudimos cargar los episodios</p><p class="text-sm text-gray-300 mb-4">' + esc(err.message) + '</p>' +
        '<button id="d-retry" type="button" class="px-5 py-2.5 rounded-xl bg-comic-yellow text-comic-ink font-bangers text-lg border-2 border-comic-ink shadow-comic-sm comic-btn">Try again</button></div>';
      $("#d-retry").addEventListener("click", () => showDetail(id));
    }

    $("#d-ep-search").addEventListener("input", debounce((e) => { ds.q = e.target.value; ds.visible = EP_PAGE; renderEpisodes(); }, 150));
    $("#d-seasons").addEventListener("click", (e) => {
      const b = e.target.closest("[data-season]"); if (!b) return;
      ds.season = Number(b.dataset.season); ds.visible = EP_PAGE; renderEpisodes();
    });
    $("#d-more").addEventListener("click", () => { ds.visible += EP_PAGE; renderEpisodes(); });
    Lumina.on("progress", renderEpisodes);
    Lumina.on("meta", () => { if (ds.series) detailHero(Lumina.byId(ds.series.id), ds.start); });
  }

  /* ---------- Boot ---------- */
  if (detailId) showDetail(detailId); else initCatalog();
})();
