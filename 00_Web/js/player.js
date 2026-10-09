/* ==========================================================
   player.js
   Video player page. Reads ?id=<title id>, fills the page from
   DATA, and wires every control: play/seek/volume/speed, PiP,
   theater, fullscreen, keyboard shortcuts, resume position,
   autoplay-next countdown, reactions, stash and share.
   Depends on: images.js, data.js, common.js (window.Lumina)
   ========================================================== */
(async function () {
  "use strict";

  const L = window.Lumina;
  const $ = L.$;
  const esc = L.escapeHtml;

  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  const SKIP = 10;                 // seconds for j / l / double-click
  const IDLE_MS = 2800;            // hide controls after this long
  const NEXT_SECONDS = 5;          // autoplay countdown
  const SAVE_EVERY_MS = 4000;      // progress save throttle
  const RING = 226;                // circumference of the countdown ring

  /* ---------- Elements ---------- */
  const el = {
    root: $("#watch-root"),
    grid: $("#watch-grid"),
    stage: $("#player-stage"),
    video: $("#video"),
    hit: $("#player-hit"),
    bigPlay: $("#big-play"),
    flash: $("#flash"),
    skipL: $("#skip-left"),
    skipR: $("#skip-right"),
    spinner: $("#spinner"),
    hud: $("#hud"),
    controls: $("#controls"),
    seek: $("#seek"),
    seekFill: $("#seek-fill"),
    seekBuf: $("#seek-buffer"),
    seekThumb: $("#seek-thumb"),
    seekTip: $("#seek-tip"),
    btnPlay: $("#btn-play"),
    btnBack: $("#btn-back10"),
    btnFwd: $("#btn-fwd10"),
    btnMute: $("#btn-mute"),
    vol: $("#vol-range"),
    tCur: $("#time-cur"),
    tDur: $("#time-dur"),
    btnAuto: $("#btn-autoplay"),
    btnSpeed: $("#btn-speed"),
    speedMenu: $("#speed-menu"),
    btnPip: $("#btn-pip"),
    btnTheater: $("#btn-theater"),
    btnFs: $("#btn-fs"),
    btnHelp: $("#btn-help"),
    panelErr: $("#panel-error"),
    panelNext: $("#panel-next"),
    ringFg: $("#ring-fg"),
    nextCount: $("#next-count"),
    nextTitle: $("#next-title"),
    btnRetry: $("#btn-retry"),
    btnNextNow: $("#btn-next-now"),
    btnNextCancel: $("#btn-next-cancel"),
    btnReplay: $("#btn-replay"),
    btnStash: $("#btn-stash"),
    stashLabel: $("#stash-label"),
    btnLike: $("#btn-like"),
    btnDislike: $("#btn-dislike"),
    btnShare: $("#btn-share"),
    nextList: $("#next-list")
  };

  const icon = (btn, name, fill) => {
    const i = btn.querySelector(".material-symbols-outlined");
    if (!i) return;
    i.textContent = name;
    i.style.fontVariationSettings = fill ? "'FILL' 1" : "";
  };

  /* ---------- Resolve the title ---------- */
  const params = new URLSearchParams(window.location.search);
  const wantedId = params.get("id") || "";
  let title = L.byId(wantedId);
  // Episodio ("serie~s1e5") o película ("mv~pack~nombre") de archive.org:
  // hay que cargar la serie / el pack primero, aunque haya copia en caché
  if (wantedId.indexOf("~") > -1 && L.archive) {
    title = (await L.archive.resolveEpisode(wantedId)) || title;
  }
  // Pulsaron una serie de archive.org: abrir el episodio por el que seguir
  if (title && title.kind === "series" && title.source === "archive" && !title.seriesId && L.archive) {
    try {
      const ep = await L.archive.startEpisodeFor(title.id);
      if (ep) { window.location.replace(L.links.player(ep.id)); return; }
    } catch (err) { /* archive.org no responde */ }
    title = null;
  }

  if (!title) {
    renderNotFound();
    return;
  }
  if (title.source === "archive" && (title.seriesId || title.kind === "movie") && L.archive) L.archive.remember(title);

  const upNext = pickUpNext(title);
  const nextTitle = upNext[0] || null;

  let idleTimer = null;
  let clickTimer = null;
  let hudTimer = null;
  let countdownTimer = null;
  let lastSave = 0;
  let scrubbing = false;
  let wasPlayingBeforeScrub = false;
  let lastPointerType = "mouse";
  let triedResume = false;

  /* ==========================================================
     Page content
     ========================================================== */
  function renderNotFound() {
    el.root.innerHTML =
      '<div class="flex flex-col items-center text-center gap-4 py-20">' +
      '<div class="text-6xl">🕵️</div>' +
      '<h1 class="font-bangers text-4xl sm:text-5xl text-comic-yellow tracking-wide">Title not found</h1>' +
      '<p class="font-fredoka text-gray-300 max-w-md">We couldn\'t find what you were looking for. It may have been removed, or the link is incomplete.</p>' +
      '<a href="' + L.links.movies + '" class="px-6 py-3 rounded-xl bg-comic-yellow text-comic-ink font-bangers text-xl border-3 border-comic-ink shadow-comic comic-btn">Browse movies</a>' +
      "</div>";
    document.title = "Title not found - Lumina Toon!";
  }

  function pickUpNext(t) {
    if (t.seriesId && L.archive) {                      // siguientes episodios de la misma serie
      const eps = L.archive.siblings(t.seriesId);
      const i = eps.findIndex((e) => e.id === t.id);
      if (i > -1 && i < eps.length - 1) return eps.slice(i + 1);
      if (i > -1) return [];
    }
    const tags = t.tags || [];
    return DATA.titles
      .filter((x) => x.id !== t.id)
      .map((x) => {
        let s = 0;
        if (x.kind === t.kind) s += 3;
        (x.tags || []).forEach((g) => { if (tags.indexOf(g) > -1) s += 2; });
        s += x.score / 10;
        return { x: x, s: s };
      })
      .sort((a, b) => b.s - a.s)
      .slice(0, 8)
      .map((o) => o.x);
  }

  function renderInfo() {
    const isMovie = t_isMovie();
    document.title = title.title + " - Lumina Toon!";

    // Breadcrumbs
    const sectionHref = isMovie ? L.links.movies : L.links.series;
    const parent = title.seriesId ? L.byId(title.seriesId) : null;
    $("#crumbs").innerHTML =
      '<a class="hover:text-comic-yellow transition-colors" href="' + L.links.home + '">Home</a>' +
      '<span class="material-symbols-outlined text-base text-gray-500">chevron_right</span>' +
      '<a class="hover:text-comic-yellow transition-colors" href="' + sectionHref + '">' + (isMovie ? "Movies" : "Series &amp; Anime") + "</a>" +
      '<span class="material-symbols-outlined text-base text-gray-500">chevron_right</span>' +
      (parent
        ? '<a class="hover:text-comic-yellow transition-colors" href="' + L.links.seriesDetail(parent.id) + '">' + esc(parent.title) + "</a>" +
          '<span class="material-symbols-outlined text-base text-gray-500">chevron_right</span>'
        : "") +
      '<span class="text-comic-yellow truncate">' + esc(parent ? title.episode : title.title) + "</span>";

    $("#stage-back").href = parent ? L.links.seriesDetail(parent.id) : sectionHref;
    $("#stage-title").textContent = title.title;
    $("#stage-sub").textContent = isMovie
      ? title.year + " • " + L.formatMins(title.mins)
      : (title.episode || "Series") + " • " + title.year;

    // Badges
    const badge = (cls, text) =>
      '<span class="px-3 py-1 rounded-xl ' + cls + ' font-fredoka font-black text-xs uppercase border-2 border-comic-ink shadow-comic-sm">' + esc(text) + "</span>";
    $("#info-badges").innerHTML =
      badge("bg-comic-yellow text-comic-ink", title.badge) +
      badge("bg-comic-purple text-comic-yellow", "★ " + Number(title.score).toFixed(1) + (title.imdb && title.imdb.rating ? (title.imdb.src === "tvmaze" ? " TVmaze" : " IMDb") : " Pop Score")) +
      badge("bg-comic-lime text-comic-ink", title.rating) +
      badge("bg-comic-cyan text-comic-ink", isMovie ? "Movie" : "Series");

    $("#info-title").textContent = title.title;
    $("#info-genre").textContent = title.genre + " • " + (title.tags || []).join(" • ");
    $("#info-desc").textContent = title.desc;

    const rows = [
      ["Year", String(title.year)],
      ["Runtime", L.formatMins(title.mins)],
      [isMovie ? "Director" : "Studio", title.director],
      ["Audio", title.audio]
    ];
    $("#info-details").innerHTML = rows.map((r) =>
      '<div class="bg-comic-dark border-2 border-comic-ink rounded-xl p-3 shadow-comic-sm">' +
      '<dt class="text-[11px] font-black uppercase tracking-wider text-comic-cyan">' + esc(r[0]) + "</dt>" +
      '<dd class="text-sm font-bold text-white mt-0.5">' + esc(r[1]) + "</dd></div>"
    ).join("");

    el.btnStash.dataset.stash = title.id;
    syncStash();
    syncReactions();
  }

  function t_isMovie() { return title.kind === "movie"; }

  const NEXT_PAGE = 20;
  let nextShown = NEXT_PAGE;

  function movieItem(t) {
    return (
      '<article data-play="' + esc(t.id) + '" tabindex="0" role="link" aria-label="Play ' + esc(t.title) + '" ' +
      'class="comic-card group flex gap-3 p-2 rounded-2xl bg-comic-panel border-3 border-comic-ink shadow-comic-sm cursor-pointer">' +
      '<div class="relative w-36 shrink-0 aspect-video rounded-xl overflow-hidden bg-comic-ink border-2 border-comic-ink">' +
      '<img alt="" class="w-full h-full object-cover" loading="lazy" src="' + esc(t.img) + '">' +
      '<span class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-comic-ink/90 text-[10px] font-fredoka font-black text-white">' + esc(L.formatMins(t.mins)) + "</span>" +
      "</div>" +
      '<div class="min-w-0 flex flex-col justify-center">' +
      '<h3 class="font-bangers text-lg text-white tracking-wide leading-tight group-hover:text-comic-yellow transition-colors line-clamp-2">' + esc(t.title) + "</h3>" +
      '<p class="font-fredoka text-xs text-comic-cyan font-bold truncate">' + esc(t.genre) + "</p>" +
      '<p class="font-fredoka text-xs text-gray-400 font-semibold">★ ' + Number(t.score).toFixed(1) + " • " + t.year + "</p>" +
      "</div></article>"
    );
  }

  function episodeItem(t) {
    const pct = Math.round(L.progress.ratio(t.id) * 100);
    return (
      '<article data-play="' + esc(t.id) + '" tabindex="0" role="link" aria-label="Play episode ' + t.num + ": " + esc(t.epTitle) + '" ' +
      'class="comic-card group flex gap-3 p-2 rounded-2xl bg-comic-panel border-3 border-comic-ink shadow-comic-sm cursor-pointer">' +
      '<div class="relative w-36 shrink-0 aspect-video rounded-xl overflow-hidden bg-comic-ink border-2 border-comic-ink">' +
      '<img alt="" class="w-full h-full object-cover" loading="lazy" src="' + esc(t.img) + '">' +
      '<span class="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-comic-yellow text-comic-ink text-[10px] font-bangers tracking-wide border border-comic-ink">E' + t.num + "</span>" +
      '<span class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-comic-ink/90 text-[10px] font-fredoka font-black text-white">' + esc(L.formatMins(t.mins)) + "</span>" +
      (pct > 0 && pct < 97 ? '<span class="absolute bottom-0 inset-x-0 h-1 bg-comic-ink"><span class="block h-full bg-comic-pink" style="width:' + pct + '%"></span></span>' : "") +
      "</div>" +
      '<div class="min-w-0 flex flex-col justify-center">' +
      '<h3 class="font-bangers text-lg text-white tracking-wide leading-tight group-hover:text-comic-yellow transition-colors line-clamp-2">' + esc(t.epTitle) + "</h3>" +
      '<p class="font-fredoka text-xs text-comic-cyan font-bold truncate">S' + t.season + " • E" + t.num + "</p>" +
      "</div></article>"
    );
  }

  function renderUpNext() {
    const tag = $("#up-next-tag");
    if (!title.seriesId) {
      el.nextList.innerHTML = upNext.map(movieItem).join("");
    } else {
      const total = upNext.length;
      if (tag) tag.textContent = total ? total + (total === 1 ? " episode left" : " episodes left") : "Last episode";
      const shown = upNext.slice(0, nextShown);
      let prevSeason = title.season;
      let html = "";
      shown.forEach((t) => {
        if (t.season !== prevSeason) {
          html += '<div class="font-bangers text-xl text-comic-yellow tracking-wide pt-2">Season ' + t.season + "</div>";
          prevSeason = t.season;
        }
        html += episodeItem(t);
      });
      if (!total) {
        html = '<div class="p-6 text-center bg-comic-panel border-3 border-comic-ink rounded-2xl font-fredoka text-gray-300">' +
          '<div class="text-4xl mb-2">🎉</div><p class="font-bold text-white">That was the last episode</p>' +
          '<a class="inline-block mt-3 px-4 py-2 rounded-xl bg-comic-yellow text-comic-ink font-bangers text-lg border-2 border-comic-ink shadow-comic-sm comic-btn" href="' + L.links.seriesDetail(title.seriesId) + '">All episodes</a></div>';
      } else if (total > shown.length) {
        html += '<button type="button" data-more-next class="px-5 py-3 rounded-xl bg-comic-purple hover:bg-comic-pink text-white font-bangers text-lg tracking-wide border-3 border-comic-ink shadow-comic-sm comic-btn">Show more episodes (' + (total - shown.length) + ")</button>";
      }
      el.nextList.innerHTML = html;
    }
    el.nextList.querySelectorAll("img").forEach(L.fallbackImg);
  }

  /* ==========================================================
     Stash, reactions, share
     ========================================================== */
  function syncStash() {
    const saved = L.stash.has(title.id);
    el.stashLabel.textContent = saved ? "In My Stash!" : "Add to My Stash";
  }

  function reactions() { return L.store.get("reactions", {}); }

  function syncReactions() {
    const r = reactions()[title.id] || "";
    el.btnLike.setAttribute("aria-pressed", r === "like");
    el.btnDislike.setAttribute("aria-pressed", r === "dislike");
  }

  function react(kind) {
    const all = reactions();
    const next = all[title.id] === kind ? "" : kind;
    if (next) all[title.id] = next; else delete all[title.id];
    L.store.set("reactions", all);
    syncReactions();
    L.toast(next === "like" ? "Glad you liked it! 👍" : next === "dislike" ? "Thanks, we'll tune your picks." : "Reaction removed");
  }

  async function share() {
    const url = window.location.href;
    const data = { title: title.title, text: "Watch " + title.title + " on Lumina Toon!", url: url };
    try {
      if (navigator.share) { await navigator.share(data); return; }
      await navigator.clipboard.writeText(url);
      L.toast("Link copied to the clipboard");
    } catch (err) {
      if (err && err.name === "AbortError") return;
      L.toast("Couldn't share. Copy the link from the address bar.");
    }
  }

  /* ==========================================================
     Player core
     ========================================================== */
  const v = el.video;

  function setSource() {
    hidePanels();
    v.src = title.src;
    v.poster = title.img;
    v.load();
  }

  function toggle() {
    if (v.paused || v.ended) {
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    } else {
      v.pause();
    }
  }

  function seekTo(sec) {
    if (!isFinite(v.duration)) return;
    v.currentTime = Math.max(0, Math.min(v.duration, sec));
    paintTime();
  }

  function skip(delta) {
    seekTo(v.currentTime + delta);
    pulse(delta < 0 ? el.skipL : el.skipR);
    hud((delta < 0 ? "-" : "+") + Math.abs(delta) + "s");
  }

  function pulse(node) {
    node.classList.remove("is-playing");
    void node.offsetWidth;            // restart the CSS animation
    node.classList.add("is-playing");
  }

  function hud(text) {
    el.hud.textContent = text;
    el.hud.style.opacity = "1";
    clearTimeout(hudTimer);
    hudTimer = setTimeout(() => { el.hud.style.opacity = "0"; }, 900);
  }

  function paintPlayState() {
    const playing = !v.paused && !v.ended;
    icon(el.btnPlay, playing ? "pause" : "play_arrow", true);
    el.btnPlay.setAttribute("aria-label", playing ? "Pause (k)" : "Play (k)");
    el.bigPlay.classList.toggle("is-gone", playing);
    el.stage.classList.toggle("is-paused", !playing);
    if (playing) wake(); else showControls();
  }

  function paintTime() {
    const d = v.duration;
    const t = v.currentTime || 0;
    el.tCur.textContent = L.formatTime(t);
    el.tDur.textContent = isFinite(d) ? L.formatTime(d) : "0:00";
    const pct = isFinite(d) && d > 0 ? (t / d) * 100 : 0;
    el.seekFill.style.width = pct + "%";
    el.seekThumb.style.left = pct + "%";
    el.seek.setAttribute("aria-valuenow", Math.round(pct));
    el.seek.setAttribute("aria-valuetext", L.formatTime(t) + " of " + (isFinite(d) ? L.formatTime(d) : "0:00"));
  }

  function paintBuffer() {
    const d = v.duration;
    if (!isFinite(d) || !d || !v.buffered.length) return;
    const end = v.buffered.end(v.buffered.length - 1);
    el.seekBuf.style.width = Math.min(100, (end / d) * 100) + "%";
  }

  function paintVolume() {
    const muted = v.muted || v.volume === 0;
    icon(el.btnMute, muted ? "volume_off" : v.volume < 0.5 ? "volume_down" : "volume_up");
    el.vol.value = v.muted ? 0 : v.volume;
  }

  function setVolume(val, announce) {
    v.volume = Math.max(0, Math.min(1, val));
    v.muted = v.volume === 0;
    L.store.set("player", Object.assign(L.store.get("player", {}), { volume: v.volume, muted: v.muted }));
    if (announce) hud("Volume " + Math.round(v.volume * 100) + "%");
  }

  function toggleMute() {
    v.muted = !v.muted;
    if (!v.muted && v.volume === 0) v.volume = 0.5;
    L.store.set("player", Object.assign(L.store.get("player", {}), { volume: v.volume, muted: v.muted }));
    hud(v.muted ? "Muted" : "Volume " + Math.round(v.volume * 100) + "%");
  }

  /* ---------- Resume + progress ---------- */
  function saveProgress(force) {
    const now = Date.now();
    if (!force && now - lastSave < SAVE_EVERY_MS) return;
    lastSave = now;
    if (!isFinite(v.duration) || !v.duration) return;
    // Finished titles reset, so they come back from the start next time
    if (v.currentTime > v.duration - 8) L.progress.remove(title.id);
    else if (v.currentTime > 3) L.progress.set(title.id, v.currentTime, v.duration);
  }

  function resume() {
    if (triedResume) return;
    triedResume = true;
    const p = L.progress.get(title.id);
    const start = parseFloat(params.get("t"));
    if (isFinite(start) && start > 0 && start < v.duration) {
      v.currentTime = start;
    } else if (p && p.t > 5 && p.t < v.duration - 10) {
      v.currentTime = p.t;
      L.toast("Resuming from " + L.formatTime(p.t));
    }
  }

  /* ---------- Speed ---------- */
  function buildSpeedMenu() {
    el.speedMenu.innerHTML = SPEEDS.map((s) =>
      '<button type="button" role="menuitemradio" data-speed="' + s + '" aria-checked="' + (s === v.playbackRate) + '">' +
      "<span>" + (s === 1 ? "Normal" : s + "x") + "</span>" +
      '<span class="material-symbols-outlined text-base">' + (s === v.playbackRate ? "check" : "") + "</span></button>"
    ).join("");
  }

  function setSpeed(s) {
    v.playbackRate = s;
    el.btnSpeed.textContent = s + "x";
    L.store.set("player", Object.assign(L.store.get("player", {}), { speed: s }));
    buildSpeedMenu();
    closeSpeedMenu();
    hud("Speed " + s + "x");
  }

  function stepSpeed(dir) {
    const i = SPEEDS.indexOf(v.playbackRate);
    const next = SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, (i < 0 ? 2 : i) + dir))];
    setSpeed(next);
  }

  function closeSpeedMenu() { el.speedMenu.hidden = true; }

  /* ---------- Picture in picture / theater / fullscreen ---------- */
  function togglePip() {
    if (!document.pictureInPictureEnabled) return L.toast("Picture in picture isn't supported in this browser");
    if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
    else v.requestPictureInPicture().catch(() => L.toast("Couldn't open picture in picture"));
  }

  function toggleTheater(force) {
    const on = typeof force === "boolean" ? force : !el.grid.classList.contains("is-theater");
    el.grid.classList.toggle("is-theater", on);
    el.btnTheater.setAttribute("aria-pressed", on);
    el.btnTheater.classList.toggle("is-on", on);
    L.store.set("player", Object.assign(L.store.get("player", {}), { theater: on }));
  }

  function isFullscreen() {
    return document.fullscreenElement === el.stage || document.webkitFullscreenElement === el.stage;
  }

  function toggleFullscreen() {
    if (isFullscreen()) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else if (el.stage.requestFullscreen) {
      el.stage.requestFullscreen().catch(() => {});
    } else if (el.stage.webkitRequestFullscreen) {
      el.stage.webkitRequestFullscreen();
    } else if (v.webkitEnterFullscreen) {   // iPhone Safari
      v.webkitEnterFullscreen();
    }
  }

  function paintFullscreen() {
    icon(el.btnFs, isFullscreen() ? "fullscreen_exit" : "fullscreen");
  }

  /* ---------- Autoplay next ---------- */
  function autoplayOn() { return L.store.get("player", {}).autoplay !== false; }

  function paintAutoplay() {
    const on = autoplayOn();
    el.btnAuto.setAttribute("aria-pressed", on);
    el.btnAuto.classList.toggle("is-on", on);
    el.btnAuto.title = "Autoplay next: " + (on ? "on" : "off");
  }

  function toggleAutoplay() {
    L.store.set("player", Object.assign(L.store.get("player", {}), { autoplay: !autoplayOn() }));
    paintAutoplay();
    hud("Autoplay " + (autoplayOn() ? "on" : "off"));
  }

  function hidePanels() {
    el.panelErr.hidden = true;
    el.panelNext.hidden = true;
    clearInterval(countdownTimer);
  }

  function goTo(t) { window.location.href = L.links.player(t.id); }

  function onEnded() {
    L.progress.remove(title.id);
    paintPlayState();
    showControls();
    if (!nextTitle) { el.panelNext.hidden = false; el.nextTitle.textContent = "That's a wrap!"; el.nextCount.textContent = "✓"; return; }

    el.nextTitle.textContent = nextTitle.seriesId ? "S" + nextTitle.season + " • E" + nextTitle.num + ": " + nextTitle.epTitle : nextTitle.title;
    el.panelNext.hidden = false;

    if (!autoplayOn()) { el.nextCount.textContent = "▶"; return; }

    let n = NEXT_SECONDS;
    el.nextCount.textContent = n;
    el.ringFg.style.transition = "none";
    el.ringFg.style.strokeDashoffset = "0";
    void el.ringFg.getBoundingClientRect();
    el.ringFg.style.transition = "";
    clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      n -= 1;
      el.nextCount.textContent = Math.max(n, 0);
      el.ringFg.style.strokeDashoffset = String(RING * (1 - n / NEXT_SECONDS));
      if (n <= 0) { clearInterval(countdownTimer); goTo(nextTitle); }
    }, 1000);
  }

  function replay() {
    hidePanels();
    v.currentTime = 0;
    toggle();
  }

  /* ---------- Idle / controls visibility ---------- */
  function showControls() {
    el.stage.classList.remove("is-idle");
    clearTimeout(idleTimer);
  }

  function wake() {
    showControls();
    if (v.paused || !el.speedMenu.hidden || scrubbing) return;
    idleTimer = setTimeout(() => el.stage.classList.add("is-idle"), IDLE_MS);
  }

  /* ---------- Click / double-click on the video ---------- */
  function onHitClick(e) {
    lastPointerType = e.pointerType || lastPointerType;
    if (!el.speedMenu.hidden) { closeSpeedMenu(); return; }
    // On touch, the first tap only reveals the controls
    if (lastPointerType === "touch" && el.stage.classList.contains("is-idle")) { wake(); return; }
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      const wasPaused = v.paused;
      toggle();
      pulseFlash(wasPaused ? "play_arrow" : "pause");
    }, 220);
  }

  function onHitDblClick(e) {
    clearTimeout(clickTimer);
    const r = el.hit.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    if (x < 0.33) skip(-SKIP);
    else if (x > 0.67) skip(SKIP);
    else toggleFullscreen();
  }

  function pulseFlash(name) {
    icon(el.flash, name, true);
    pulse(el.flash);
  }

  /* ---------- Seek bar ---------- */
  function ratioFromEvent(e) {
    const r = el.seek.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  }

  function moveTip(e) {
    const r = el.seek.getBoundingClientRect();
    const ratio = ratioFromEvent(e);
    const w = el.seekTip.offsetWidth / 2;
    const px = Math.max(w, Math.min(r.width - w, ratio * r.width));
    el.seekTip.style.left = px + "px";
    el.seekTip.textContent = L.formatTime(ratio * (v.duration || 0));
  }

  function bindSeek() {
    el.seek.addEventListener("pointermove", moveTip);
    el.seek.addEventListener("pointerdown", (e) => {
      if (!isFinite(v.duration)) return;
      scrubbing = true;
      wasPlayingBeforeScrub = !v.paused;
      el.seek.classList.add("is-scrubbing");
      el.seek.setPointerCapture(e.pointerId);
      v.pause();
      seekTo(ratioFromEvent(e) * v.duration);
      moveTip(e);
    });
    el.seek.addEventListener("pointermove", (e) => {
      if (!scrubbing) return;
      seekTo(ratioFromEvent(e) * v.duration);
    });
    const end = (e) => {
      if (!scrubbing) return;
      scrubbing = false;
      el.seek.classList.remove("is-scrubbing");
      if (e.pointerId !== undefined && el.seek.hasPointerCapture(e.pointerId)) el.seek.releasePointerCapture(e.pointerId);
      if (wasPlayingBeforeScrub) toggle();
      wake();
    };
    el.seek.addEventListener("pointerup", end);
    el.seek.addEventListener("pointercancel", end);
  }

  /* ---------- Keyboard ---------- */
  function showHelp() {
    const rows = [
      ["Space / K", "Play / pause"],
      ["J / ←", "Back " + SKIP + " seconds"],
      ["L / →", "Forward " + SKIP + " seconds"],
      ["↑ / ↓", "Volume up / down"],
      ["M", "Mute"],
      ["F", "Fullscreen"],
      ["T", "Theater mode"],
      ["P", "Picture in picture"],
      ["&lt; / &gt;", "Slower / faster"],
      ["0 – 9", "Jump to 0% – 90%"],
      ["Home / End", "Start / end"],
      ["N", "Next title"],
      ["?", "This help"]
    ];
    L.modal(
      '<div class="p-6 sm:p-8 max-w-md w-full">' +
      '<h2 class="font-bangers text-3xl text-comic-yellow tracking-wide mb-4">Keyboard Shortcuts</h2>' +
      '<dl class="flex flex-col gap-2.5 font-fredoka text-sm">' +
      rows.map((r) =>
        '<div class="flex items-center justify-between gap-4"><dt><span class="kbd">' + r[0] + '</span></dt><dd class="text-gray-200 font-semibold">' + r[1] + "</dd></div>"
      ).join("") +
      "</dl>" +
      '<button type="button" data-close class="mt-6 w-full px-5 py-3 rounded-xl bg-comic-yellow text-comic-ink font-bangers text-xl border-3 border-comic-ink shadow-comic-sm comic-btn">Got it!</button>' +
      "</div>"
    );
  }

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" && e.target.type !== "range") return;
    if (tag === "textarea" || tag === "select" || e.target.isContentEditable) return;
    // Let buttons and links handle their own Space / Enter
    if ((tag === "button" || tag === "a") && (e.key === " " || e.key === "Enter")) return;
    if (document.querySelector(".modal-backdrop, [data-modal]") && e.key !== "?") return;

    const k = e.key;
    let handled = true;
    switch (k) {
      case " ": case "k": case "K": toggle(); pulseFlash(v.paused ? "pause" : "play_arrow"); break;
      case "j": case "J": skip(-SKIP); break;
      case "l": case "L": skip(SKIP); break;
      case "ArrowLeft": skip(-5); break;
      case "ArrowRight": skip(5); break;
      case "ArrowUp": setVolume(v.volume + 0.05, true); break;
      case "ArrowDown": setVolume(v.volume - 0.05, true); break;
      case "m": case "M": toggleMute(); break;
      case "f": case "F": toggleFullscreen(); break;
      case "t": case "T": toggleTheater(); break;
      case "p": case "P": togglePip(); break;
      case "<": case ",": stepSpeed(-1); break;
      case ">": case ".": stepSpeed(1); break;
      case "Home": seekTo(0); break;
      case "End": seekTo((v.duration || 0) - 0.1); break;
      case "n": case "N": if (nextTitle) goTo(nextTitle); break;
      case "?": showHelp(); break;
      case "Escape": closeSpeedMenu(); break;
      default:
        if (/^[0-9]$/.test(k) && isFinite(v.duration)) seekTo((Number(k) / 10) * v.duration);
        else handled = false;
    }
    if (handled) { e.preventDefault(); wake(); }
  }

  /* ==========================================================
     Wiring
     ========================================================== */
  function restorePrefs() {
    const prefs = L.store.get("player", {});
    if (typeof prefs.volume === "number") v.volume = prefs.volume;
    v.muted = !!prefs.muted;
    if (prefs.speed) { v.playbackRate = prefs.speed; el.btnSpeed.textContent = prefs.speed + "x"; }
    if (prefs.theater) toggleTheater(true);
    paintVolume();
    paintAutoplay();
    buildSpeedMenu();
  }

  function bindVideo() {
    v.addEventListener("loadedmetadata", () => { resume(); paintTime(); });
    v.addEventListener("durationchange", paintTime);
    v.addEventListener("timeupdate", () => { paintTime(); saveProgress(false); });
    v.addEventListener("progress", paintBuffer);
    v.addEventListener("play", paintPlayState);
    v.addEventListener("pause", () => { paintPlayState(); saveProgress(true); });
    v.addEventListener("ended", onEnded);
    v.addEventListener("volumechange", paintVolume);
    v.addEventListener("waiting", () => el.spinner.classList.add("is-visible"));
    v.addEventListener("seeking", () => el.spinner.classList.add("is-visible"));
    ["canplay", "playing", "seeked"].forEach((n) =>
      v.addEventListener(n, () => { el.spinner.classList.remove("is-visible"); paintBuffer(); })
    );
    v.addEventListener("error", () => {
      el.spinner.classList.remove("is-visible");
      el.panelErr.hidden = false;
      showControls();
    });
    v.addEventListener("enterpictureinpicture", () => el.btnPip.classList.add("is-on"));
    v.addEventListener("leavepictureinpicture", () => el.btnPip.classList.remove("is-on"));
  }

  function bindControls() {
    el.btnPlay.addEventListener("click", toggle);
    el.bigPlay.addEventListener("click", toggle);
    el.btnBack.addEventListener("click", () => skip(-SKIP));
    el.btnFwd.addEventListener("click", () => skip(SKIP));
    el.btnMute.addEventListener("click", toggleMute);
    el.vol.addEventListener("input", () => setVolume(parseFloat(el.vol.value)));
    el.btnAuto.addEventListener("click", toggleAutoplay);
    el.btnPip.addEventListener("click", togglePip);
    el.btnTheater.addEventListener("click", () => toggleTheater());
    el.btnFs.addEventListener("click", toggleFullscreen);
    el.btnHelp.addEventListener("click", showHelp);

    el.btnSpeed.addEventListener("click", (e) => {
      e.stopPropagation();
      el.speedMenu.hidden = !el.speedMenu.hidden;
      if (!el.speedMenu.hidden) { showControls(); const c = el.speedMenu.querySelector('[aria-checked="true"]'); if (c) c.focus(); }
      else wake();
    });
    el.speedMenu.addEventListener("click", (e) => {
      const b = e.target.closest("[data-speed]");
      if (b) setSpeed(parseFloat(b.dataset.speed));
    });
    document.addEventListener("click", (e) => {
      if (!el.speedMenu.hidden && !e.target.closest("#speed-menu, #btn-speed")) closeSpeedMenu();
    });

    el.hit.addEventListener("pointerdown", (e) => { lastPointerType = e.pointerType; });
    el.hit.addEventListener("click", onHitClick);
    el.hit.addEventListener("dblclick", onHitDblClick);

    ["pointermove", "pointerdown", "touchstart"].forEach((n) =>
      el.stage.addEventListener(n, wake, { passive: true })
    );
    el.stage.addEventListener("pointerleave", () => { if (!v.paused) wake(); });
    el.stage.addEventListener("focusin", wake);

    el.btnRetry.addEventListener("click", () => {
      const t = v.currentTime;
      triedResume = false;
      setSource();
      v.addEventListener("loadedmetadata", () => { if (t) v.currentTime = t; }, { once: true });
      toggle();
    });
    el.btnNextNow.addEventListener("click", () => { if (nextTitle) goTo(nextTitle); });
    el.btnNextCancel.addEventListener("click", hidePanels);
    el.btnReplay.addEventListener("click", replay);

    el.btnStash.addEventListener("click", () => setTimeout(syncStash, 0));
    L.on("stash", syncStash);
    el.btnLike.addEventListener("click", () => react("like"));
    el.btnDislike.addEventListener("click", () => react("dislike"));
    el.btnShare.addEventListener("click", share);
    el.nextList.addEventListener("click", (e) => {
      if (!e.target.closest("[data-more-next]")) return;
      nextShown += NEXT_PAGE;
      renderUpNext();
    });

    document.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", paintFullscreen);
    document.addEventListener("webkitfullscreenchange", paintFullscreen);
    window.addEventListener("pagehide", () => saveProgress(true));
    document.addEventListener("visibilitychange", () => { if (document.hidden) saveProgress(true); });

    if (!document.pictureInPictureEnabled) el.btnPip.hidden = true;
    bindSeek();
  }

  /* ---------- Boot ---------- */
  renderInfo();
  renderUpNext();
  restorePrefs();
  bindVideo();
  bindControls();
  setSource();
  paintPlayState();
  paintTime();
  el.stage.focus({ preventScroll: true });
})();
