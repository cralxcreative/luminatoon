/* ==========================================================
   movies.js  -  movies page
   Renders: random movie roulette, Recently Added, Top Rated and
   the full catalog (search, sort, genre filter, load more).
   Filters are mirrored in the URL (?q=&genre=&sort=).
   ========================================================== */
(function () {
  "use strict";

  const { $, $$, links, escapeHtml, formatMins, timeAgo, debounce, highlight, store, stash, modal, toast } = Lumina;

  const movies = DATA.titles.filter((t) => t.kind === "movie");
  const ACCENTS = ["yellow", "pink", "cyan", "lime", "purple"];
  const accent = (i) => ACCENTS[i % ACCENTS.length];
  const onAccent = (c) => (c === "pink" || c === "purple" ? "text-white" : "text-comic-ink");
  const textAccent = (c) => "text-comic-" + (c === "purple" ? "pink" : c);
  const PAGE_SIZE = 8;

  /* ==========================================================
     RANDOM MOVIE ROULETTE
     ========================================================== */
  const ROLL_TAGS = [
    "100% Surprise",
    "Critical Hit! 🎲",
    "Magic Gem Selected! ✨",
    "Guaranteed Laughs! 🍌",
    "Pure Adrenaline! ⚡",
    "Lucky Draw! 🍀"
  ];

  let currentId = null;
  let rollCount = 1;
  let rolling = false;

  const dayOfYear = () => Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 864e5);

  function paintHero(t, tag, isDaily) {
    currentId = t.id;
    $("#random-movie-title").textContent = t.title;
    $("#random-movie-genre").textContent = "🎬 " + t.genre + " • " + t.badge;
    $("#random-movie-desc").textContent = t.desc;
    $("#random-movie-img").src = t.img;
    $("#random-movie-img").alt = "Poster of " + t.title;
    $("#random-tag-label").textContent = tag;
    $("#random-movie-meta").innerHTML =
      '<span class="text-comic-yellow flex items-center gap-1 font-bold"><span>🎧</span> Audio: ' + escapeHtml(t.audio) + "</span>" +
      '<span class="text-comic-pink">•</span><span class="text-white font-bold">Director: ' + escapeHtml(t.director) + "</span>" +
      '<span class="text-comic-pink">•</span><span class="text-comic-lime font-bold">' + escapeHtml(t.rating) + "</span>";
    $("#random-movie-badges").innerHTML =
      '<span class="bg-comic-pink text-white font-bangers text-xs px-3 py-1 rounded-xl border-2 border-comic-ink shadow-comic-sm -rotate-2 inline-flex items-center gap-1.5"><span>🎲</span> TOON ALGORITHM RANDOM PICK!</span>' +
      '<span class="bg-comic-yellow text-comic-ink font-fredoka font-black text-xs px-2.5 py-1 rounded-xl border-2 border-comic-ink shadow-comic-sm inline-flex items-center gap-1">⭐ ' + t.score + " Pop Score</span>" +
      '<span class="bg-comic-dark text-comic-cyan font-fredoka font-bold text-xs px-3 py-1 rounded-xl border-2 border-comic-ink inline-flex items-center gap-1"><span class="material-symbols-outlined text-sm">schedule</span> ' + formatMins(t.mins) + "</span>" +
      '<span class="bg-comic-purple text-comic-yellow font-fredoka font-bold text-xs px-2.5 py-1 rounded-xl border-2 border-comic-ink">YEAR ' + t.year + "</span>" +
      '<span class="bg-comic-lime text-comic-ink font-fredoka font-black text-xs px-2.5 py-1 rounded-xl border-2 border-comic-ink">' + (isDaily ? "MOVIE OF THE DAY!" : "YOUR ROLL!") + "</span>";
    $("#btn-watch-random").href = links.player(t.id);
    const bookmark = $("#btn-random-baul");
    bookmark.dataset.stash = t.id;
    Lumina.syncStashButtons();
  }

  function pickRandom() {
    let next;
    do { next = movies[Math.floor(Math.random() * movies.length)]; }
    while (movies.length > 1 && next.id === currentId);
    return next;
  }

  function rollDice() {
    if (rolling) return;
    rolling = true;
    const btn = $("#btn-dice-random");
    const icon = $("span.material-symbols-outlined", btn);
    btn.disabled = true;
    icon.classList.add("dice-rolling");
    $("#random-tag-label").textContent = "Rolling...";

    let n = 0;
    const shuffle = setInterval(() => {
      const t = movies[Math.floor(Math.random() * movies.length)];
      $("#random-movie-img").src = t.img;
      $("#random-movie-title").textContent = t.title;
      if (++n >= 8) {
        clearInterval(shuffle);
        rollCount += 1;
        const final = pickRandom();
        const tag = "Roll #" + rollCount + " • " + ROLL_TAGS[Math.floor(Math.random() * ROLL_TAGS.length)];
        paintHero(final, tag, false);
        icon.classList.remove("dice-rolling");
        btn.disabled = false;
        rolling = false;
      }
    }, 80);
  }

  function initRoulette() {
    paintHero(movies[dayOfYear() % movies.length], "Roll #1 • 100% Surprise", true);
    $("#btn-dice-random").addEventListener("click", rollDice);
    document.addEventListener("keydown", (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if ((e.key === "r" || e.key === "R") && !e.ctrlKey && !e.metaKey && tag !== "input" && tag !== "textarea") rollDice();
    });
  }

  /* ==========================================================
     RECENTLY ADDED
     ========================================================== */
  function recentCard(t, i) {
    const c = accent(i);
    const c2 = accent(i + 1);
    const label = t.ago < 24 ? "JUST ADDED!" : "NEW RELEASE";
    const chip = t.ago < 12 ? "TODAY" : t.ago < 48 ? "YESTERDAY" : t.badge;
    const rot = i % 2 ? "rotate-2" : "-rotate-2";
    return (
      '<div class="bg-comic-dark rounded-xl border-2 border-comic-ink p-2.5 shadow-comic group hover:-translate-y-2 transition-all flex flex-col justify-between cursor-pointer" data-play="' + t.id + '" tabindex="0" role="link" aria-label="Play ' + escapeHtml(t.title) + '">' +
        '<div class="relative aspect-[2/3] rounded-lg overflow-hidden border border-comic-ink bg-comic-ink mb-2">' +
          '<img alt="' + escapeHtml(t.title) + '" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" src="' + t.img + '" loading="lazy">' +
          '<div class="absolute top-1.5 left-1.5 bg-comic-' + c + " " + onAccent(c) + " font-bangers text-[10px] px-1.5 py-0.5 rounded border border-comic-ink shadow-comic-sm " + rot + '">' + label + "</div>" +
          '<div class="absolute top-1.5 right-1.5 bg-comic-' + c2 + " " + onAccent(c2) + ' font-fredoka font-black text-[9px] px-1.5 py-0.5 rounded border border-comic-ink uppercase">' + escapeHtml(chip) + "</div>" +
          '<div class="absolute bottom-1.5 left-1.5 bg-comic-yellow text-comic-ink font-bangers text-[10px] px-1.5 py-0.5 rounded border border-comic-ink">★ ' + t.score + " Pop</div>" +
        "</div>" +
        '<div><div class="' + textAccent(c) + ' text-[11px] font-fredoka font-bold">' + escapeHtml(t.genre) + " • " + formatMins(t.mins) + "</div>" +
        '<h3 class="font-bangers text-base text-white tracking-wide truncate group-hover:text-comic-yellow transition-colors">' + escapeHtml(t.title) + "</h3>" +
        '<span class="text-[10px] font-fredoka text-gray-300 block mt-0.5">Added ' + timeAgo(t.ago) + "</span></div>" +
        '<div class="pt-2 mt-2 border-t border-comic-panel flex items-center justify-between">' +
          '<span class="text-[10px] font-fredoka font-bold ' + textAccent(c2) + ' truncate pr-2">' + escapeHtml(t.audio) + "</span>" +
          '<span class="w-7 h-7 shrink-0 rounded-lg bg-comic-' + c + " " + onAccent(c) + ' border border-comic-ink flex items-center justify-center"><span class="material-symbols-outlined text-base">play_arrow</span></span>' +
        "</div>" +
      "</div>"
    );
  }

  function renderRecent() {
    const list = movies.slice().sort((a, b) => a.ago - b.ago).slice(0, 5);
    $("#recent-grid").innerHTML = list.map(recentCard).join("");
    const week = movies.filter((t) => t.ago <= 168).length;
    $("#recent-count").innerHTML = '<span class="material-symbols-outlined text-sm">new_releases</span> +' + week + " This Week";
  }

  /* ==========================================================
     TOP RATED
     ========================================================== */
  function topCard(t, i) {
    const c = accent(i);
    const medals = ["🥇", "🥈", "🥉", "⭐"];
    const vote = Math.min(99, Math.round(t.score * 10));
    return (
      '<div class="bg-comic-dark rounded-xl border-3 border-comic-ink p-4 shadow-comic flex flex-col justify-between group hover:-translate-y-2 transition-all relative overflow-hidden cursor-pointer" data-play="' + t.id + '" tabindex="0" role="link" aria-label="Play ' + escapeHtml(t.title) + '">' +
        '<div class="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-comic-' + c + '/10 pointer-events-none blur-lg"></div>' +
        '<div class="relative aspect-[2/3] rounded-lg overflow-hidden border-2 border-comic-ink mb-3 bg-comic-ink">' +
          '<img alt="' + escapeHtml(t.title) + '" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" src="' + t.img + '" loading="lazy">' +
          '<div class="absolute top-2 left-2 bg-comic-' + c + " " + onAccent(c) + ' font-bangers text-xs px-2.5 py-1 rounded border-2 border-comic-ink shadow-comic-sm -rotate-3">' + medals[i] + " ALL-TIME #" + (i + 1) + "</div>" +
          '<div class="absolute top-2 right-2 bg-comic-yellow text-comic-ink font-fredoka font-black text-[10px] px-2 py-0.5 rounded border border-comic-ink shadow-comic-sm">★ ' + t.score + " SCORE</div>" +
          '<div class="absolute bottom-2 left-2 bg-comic-dark/95 ' + textAccent(c) + ' border border-comic-ink font-fredoka font-bold text-[10px] px-2 py-0.5 rounded">Audience vote: ' + vote + "%</div>" +
        "</div>" +
        '<div><div class="flex items-center gap-1.5 mb-1"><span class="bg-comic-purple text-white text-[10px] font-fredoka font-bold px-2 py-0.5 rounded border border-comic-ink uppercase">' + escapeHtml(t.badge) + "</span></div>" +
        '<h3 class="font-bangers text-xl text-white tracking-wide group-hover:text-comic-yellow transition-colors">' + escapeHtml(t.title) + "</h3>" +
        '<p class="font-fredoka text-xs text-gray-300 mt-1 clamp-2">' + escapeHtml(t.desc) + "</p></div>" +
        '<div class="pt-3 mt-3 border-t border-comic-panel flex items-center justify-between">' +
          '<span class="text-[11px] font-fredoka font-bold ' + textAccent(c) + ' flex items-center gap-1"><span class="material-symbols-outlined text-sm">thumb_up</span> ' + vote + "% Recommended</span>" +
          '<a href="' + links.player(t.id) + '" class="px-3 py-1 bg-comic-' + c + " " + onAccent(c) + ' font-fredoka font-black text-xs rounded-lg border-2 border-comic-ink shadow-comic-sm comic-btn">Play</a>' +
        "</div>" +
      "</div>"
    );
  }

  function renderTopRated() {
    const list = movies.slice().sort((a, b) => b.score - a.score || b.views - a.views).slice(0, 4);
    $("#top-grid").innerHTML = list.map(topCard).join("");
  }

  /* ==========================================================
     CATALOG
     ========================================================== */
  const params = new URLSearchParams(location.search);
  const state = {
    q: params.get("q") || "",
    genre: params.get("genre") || "all",
    sort: params.get("sort") || "views",
    visible: PAGE_SIZE
  };
  if (!DATA.genres.some((g) => g.key === state.genre)) state.genre = "all";

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
    return movies
      .filter((t) => state.genre === "all" || t.tags.indexOf(state.genre) > -1)
      .filter((t) => !q || (t.title + " " + t.genre + " " + t.director + " " + t.desc).toLowerCase().indexOf(q) > -1)
      .sort(SORT_FNS[state.sort] || SORT_FNS.views);
  }

  function catalogCard(t, i, q) {
    const c = accent(i);
    const c2 = accent(i + 2);
    return (
      '<div class="bg-comic-dark rounded-xl border-3 border-comic-ink p-3 shadow-comic group hover:-translate-y-2 transition-all flex flex-col justify-between cursor-pointer" data-play="' + t.id + '" tabindex="0" role="link" aria-label="Play ' + escapeHtml(t.title) + '">' +
        '<div class="relative aspect-[2/3] rounded-lg overflow-hidden border-2 border-comic-ink bg-comic-ink mb-2.5">' +
          '<img alt="' + escapeHtml(t.title) + '" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" src="' + t.img + '" loading="lazy">' +
          '<div class="absolute top-2 left-2 bg-comic-yellow text-comic-ink font-bangers text-xs px-2 py-0.5 rounded border border-comic-ink shadow-comic-sm ' + (i % 2 ? "rotate-2" : "-rotate-2") + '">★ ' + t.score + " Pop</div>" +
          '<div class="absolute top-2 right-2 bg-comic-' + c2 + " " + onAccent(c2) + ' font-fredoka font-black text-[10px] px-2 py-0.5 rounded border border-comic-ink shadow-comic-sm uppercase">' + escapeHtml(t.badge) + "</div>" +
          '<div class="absolute inset-0 bg-comic-ink/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">' +
            '<span class="w-12 h-12 rounded-full bg-comic-' + c + " " + onAccent(c) + ' border-2 border-comic-ink flex items-center justify-center shadow-comic-sm"><span class="material-symbols-outlined text-2xl">play_arrow</span></span>' +
          "</div>" +
        "</div>" +
        '<div><div class="flex items-center gap-1.5 ' + textAccent(c) + ' text-xs font-fredoka font-bold mb-1"><span class="truncate">' + escapeHtml(t.genre) + "</span> • <span>" + formatMins(t.mins) + "</span></div>" +
        '<h3 class="font-bangers text-lg text-white tracking-wide truncate group-hover:text-comic-' + c + ' transition-colors">' + highlight(t.title, q) + "</h3>" +
        '<p class="font-fredoka text-xs text-gray-300 mt-1 clamp-2">' + escapeHtml(t.desc) + "</p></div>" +
        '<div class="pt-3 mt-2 border-t border-comic-panel flex items-center justify-between">' +
          '<span class="text-[11px] font-fredoka ' + textAccent(c2) + ' font-bold truncate pr-2">' + escapeHtml(t.audio) + "</span>" +
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

    $("#full-movies-catalog").innerHTML = shown.map((t, i) => catalogCard(t, i, q)).join("");
    $("#catalog-count").textContent = "Showing " + shown.length + " of " + all.length + " movies";
    $("#catalog-total").textContent = "+" + movies.length + " TITLES AVAILABLE";

    const empty = $("#catalog-empty");
    empty.classList.toggle("hidden", all.length > 0);
    $("#catalog-empty-q").textContent = q ? "“" + q + "”" : "these filters";

    const remaining = all.length - shown.length;
    const more = $("#btn-load-more");
    more.parentElement.classList.toggle("hidden", remaining <= 0);
    $("#load-more-label").textContent = "Load More Movies (+" + Math.min(PAGE_SIZE, remaining) + " Titles) 💥";

    renderSortButtons();
    renderGenrePills();
    syncUrl();
  }

  function renderSortButtons() {
    $("#sort-buttons").innerHTML = SORTS.map((s) => {
      const on = s.key === state.sort;
      return '<button type="button" data-sort="' + s.key + '" aria-pressed="' + on + '" class="px-3 py-1.5 rounded-lg font-fredoka font-bold text-xs border border-comic-ink shrink-0 ' +
        (on ? "bg-comic-yellow text-comic-ink shadow-comic-sm" : "bg-comic-panel text-white hover:text-comic-yellow") + '">' + s.label + "</button>";
    }).join("");
  }

  function renderGenrePills() {
    const base = "genre-pill px-4 py-2 rounded-xl font-fredoka text-xs border-2 border-comic-ink shadow-comic-sm shrink-0 comic-btn ";
    $("#all-genre-filters").innerHTML = DATA.genres.map((g) => {
      const on = g.key === state.genre;
      return '<button type="button" data-genre="' + g.key + '" aria-pressed="' + on + '" class="' + base +
        (on ? "bg-comic-pink text-white font-black -rotate-1" : "bg-comic-panel " + g.hover + " hover:text-comic-ink text-white font-bold transition-colors") + '">' + g.label + "</button>";
    }).join("");
  }

  function initCatalog() {
    const input = $("#catalog-search-input");
    input.value = state.q;

    input.addEventListener("input", debounce(() => {
      state.q = input.value;
      state.visible = PAGE_SIZE;
      renderCatalog();
    }, 150));

    $("#sort-buttons").addEventListener("click", (e) => {
      const b = e.target.closest("[data-sort]");
      if (!b) return;
      state.sort = b.dataset.sort;
      state.visible = PAGE_SIZE;
      renderCatalog();
    });

    $("#all-genre-filters").addEventListener("click", (e) => {
      const b = e.target.closest("[data-genre]");
      if (!b) return;
      state.genre = b.dataset.genre;
      state.visible = PAGE_SIZE;
      renderCatalog();
    });

    $("#btn-load-more").addEventListener("click", () => {
      state.visible += PAGE_SIZE;
      renderCatalog();
    });

    $("#btn-clear-filters").addEventListener("click", () => {
      state.q = ""; state.genre = "all"; state.sort = "views"; state.visible = PAGE_SIZE;
      input.value = "";
      renderCatalog();
    });

    renderCatalog();
  }

  /* ==========================================================
     CINEMA CLUB MODAL
     ========================================================== */
  function initClub() {
    const btn = $("#btn-club");
    if (store.get("club", "")) $("#club-label").textContent = "You're in the Club! 🎟️";

    btn.addEventListener("click", () => {
      const saved = store.get("club", "");
      modal(
        '<div class="flex items-center gap-3 mb-3"><div class="w-12 h-12 rounded-xl bg-comic-yellow border-2 border-comic-ink flex items-center justify-center text-2xl shadow-comic-sm -rotate-3">🎟️</div>' +
        '<h3 class="font-bangers text-3xl text-comic-yellow tracking-wide">Cinema Club</h3></div>' +
        '<p class="font-fredoka text-sm text-gray-300 mb-4">Get early access to weekly premieres and vote for the next classics we restore in 4K.</p>' +
        '<label class="font-fredoka font-bold text-xs text-comic-cyan uppercase" for="club-email">Email</label>' +
        '<input id="club-email" type="email" autocomplete="email" placeholder="you@example.com" value="' + escapeHtml(saved) + '" class="w-full mt-1 mb-2 px-4 py-3 bg-comic-ink rounded-xl border-3 border-comic-ink font-fredoka text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-comic-yellow">' +
        '<p id="club-error" class="font-fredoka text-xs text-comic-pink font-bold mb-3 hidden">Enter a valid email address, like name@example.com.</p>' +
        '<div class="flex gap-3 justify-end mt-4">' +
          '<button data-close type="button" class="px-4 py-2 rounded-xl bg-comic-dark text-white font-fredoka font-bold text-sm border-2 border-comic-ink shadow-comic-sm comic-btn">Not now</button>' +
          '<button id="club-join" type="button" class="px-5 py-2 rounded-xl bg-comic-yellow text-comic-ink font-bangers text-lg tracking-wide border-2 border-comic-ink shadow-comic-sm comic-btn">Join the Club</button>' +
        "</div>",
        (box, close) => {
          const email = $("#club-email", box);
          const submit = () => {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
              $("#club-error", box).classList.remove("hidden");
              email.focus();
              return;
            }
            store.set("club", email.value.trim());
            $("#club-label").textContent = "You're in the Club! 🎟️";
            close();
            toast("Welcome to the Cinema Club! 🎉");
          };
          $("#club-join", box).addEventListener("click", submit);
          email.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
        }
      );
    });
  }

  /* ---------- Boot ---------- */
  $("#ticker-count").textContent = "MORE THAN " + movies.length + " ANIMATED MOVIES READY TO DISCOVER AT RANDOM!";
  initRoulette();
  renderRecent();
  renderTopRated();
  initCatalog();
  initClub();
})();
