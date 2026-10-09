/* ==========================================================
   archive.js  -  episodios desde archive.org
   Lumina.archive:
     loadSeries(cfg|id)   -> { cfg, item, episodes, seasons }
     episode(id)          -> episodio ya cargado (síncrono) o null
     resolveEpisode(id)   -> carga la serie y devuelve el episodio
     startEpisodeFor(id)  -> episodio por el que seguir / empezar
     loadMovies()         -> carga los packs de películas (CFG.movies) en DATA.titles
     debug(archiveId)     -> imprime en consola los ficheros detectados
   Usa la API pública https://archive.org/metadata/<id> (con CORS).
   Los vídeos se reproducen desde https://archive.org/download/<id>/<archivo>
   ========================================================== */
(function () {
  "use strict";

  const L = window.Lumina;
  const CFG = window.LUMINA_CONFIG;
  const BASE = "https://archive.org";
  const TTL = 60 * 60 * 1000;                       // caché de metadatos: 1 h
  const mem = { items: {}, series: {}, eps: {} };

  const seriesCfg = (id) => CFG.series.find((s) => s.id === id) || null;
  const imgOf = (aid) => BASE + "/services/img/" + encodeURIComponent(aid);
  const fileUrl = (aid, name) =>
    BASE + "/download/" + encodeURIComponent(aid) + "/" + name.split("/").map(encodeURIComponent).join("/");

  /* ---------- 1. Descargar y filtrar los ficheros del item ---------- */
  const PLAYABLE = /\.(mp4|m4v|webm|ogv)$/i;       // lo que un <video> reproduce

  const parseLength = (v) => {
    if (v == null || v === "") return 0;
    if (/^\d+(\.\d+)?$/.test(String(v))) return parseFloat(v);
    const p = String(v).split(":").map(Number);     // hh:mm:ss
    return p.reduce((acc, n) => acc * 60 + (n || 0), 0);
  };

  function pickVideos(files) {
    const groups = {};
    files.forEach((f) => {
      if (!f || !f.name || !PLAYABLE.test(f.name)) return;
      if (/\.thumbs?\//i.test(f.name)) return;
      const base = f.name.replace(PLAYABLE, "").replace(/\.ia$/i, "");
      (groups[base] = groups[base] || []).push(f);
    });
    const rank = (f) => (/\.(mp4|m4v)$/i.test(f.name) ? 0 : 2) + (f.source === "original" ? 0 : 1);
    return Object.keys(groups).map((k) => groups[k].sort((a, b) => rank(a) - rank(b))[0]);
  }

  async function fetchItem(aid) {
    if (mem.items[aid]) return mem.items[aid];
    const cached = L.store.get("ia:" + aid, null);
    if (cached && Date.now() - cached.at < TTL) return (mem.items[aid] = cached.data);

    const res = await fetch(BASE + "/metadata/" + encodeURIComponent(aid));
    if (!res.ok) throw new Error("archive.org respondió " + res.status);
    const data = await res.json();
    if (!data || !data.files) throw new Error("El item «" + aid + "» no existe o está vacío");

    const md = data.metadata || {};

    /* Miniaturas que archive.org genera por vídeo: <base>.thumbs/<base>_000001.jpg */
    const thumbList = {};
    data.files.forEach((f) => {
      const m = f && f.name && f.name.match(/^(.*)\.thumbs\/.+\.(jpe?g|png)$/i);
      if (m) (thumbList[m[1]] = thumbList[m[1]] || []).push(f.name);
    });
    const thumbs = {};
    Object.keys(thumbList).forEach((k) => {
      const arr = thumbList[k].sort();
      thumbs[k] = arr[Math.min(2, arr.length - 1)];      // un fotograma intermedio (el primero suele ser negro)
    });

    const item = {
      id: aid,
      year: parseInt(String(md.year || md.date || "").slice(0, 4), 10) || 0,
      thumbs: thumbs,
      title: md.title || aid,
      description: Array.isArray(md.description) ? md.description.join(" ") : md.description || "",
      files: pickVideos(data.files).map((f) => ({
        name: f.name, title: f.title || "", length: parseLength(f.length), size: Number(f.size) || 0
      }))
    };
    L.store.set("ia:" + aid, { at: Date.now(), data: item });
    return (mem.items[aid] = item);
  }

  /* ---------- 2. Temporada / nº de episodio a partir de la RUTA y el nombre ----------
     archive.org devuelve rutas como "Season_1/1 lisa saca 2 homero.mp4":
       · la temporada sale de la carpeta (Season_1, Season 2, Temporada 3, S4, "5"...)
       · el nº de episodio sale del nombre del fichero (el número del principio)    */
  const YEAR = (txt, n) => txt.length === 4 && n >= 1950 && n <= 2100;

  function seasonFromDirs(dirs) {
    for (let i = dirs.length - 1; i >= 0; i--) {
      const d = dirs[i].replace(/[_.]+/g, " ").trim();
      const m = d.match(/(?:season|temporada|temp|saison|staffel|stagione)\s*[-#:]?\s*0*(\d{1,2})\b/i) ||
                d.match(/^s\s*0*(\d{1,2})$/i) || d.match(/^0*(\d{1,2})$/);
      if (m) return +m[1];
    }
    return null;
  }

  function parseEp(name, customRegex) {
    const parts = name.split("/");
    const file = parts.pop();
    const folderSeason = seasonFromDirs(parts);
    const clean = file.replace(PLAYABLE, "").replace(/\.ia$/i, "").replace(/[_.]+/g, " ").trim();
    const out = (season, num) => ({ season: folderSeason != null ? folderSeason : (season || 1), num: num });
    let m;
    if (customRegex && (m = clean.match(new RegExp(customRegex, "i")))) return out(1, parseInt(m[1], 10));
    if ((m = clean.match(/\bs(\d{1,2})\s*[ex]\s*(\d{1,4})/i))) return out(+m[1], +m[2]);
    if ((m = clean.match(/\b(\d{1,2})x(\d{2,4})\b/i))) return out(+m[1], +m[2]);
    // "1 lisa saca 2 homero", "01 - Titulo", "Ep 3 Titulo": el número del principio
    if ((m = clean.match(/^(?:(?:episode|episodio|epis[oó]dio|cap[ií]tulo|cap|ep|e)\s*)?[-#:]?\s*0*(\d{1,4})(?=\s|$|[-–:.)])/i)) && !YEAR(m[1].replace(/^0+/, ""), +m[1]))
      return out(1, +m[1]);
    if ((m = clean.match(/\b(?:episode|episodio|epis[oó]dio|cap[ií]tulo|cap|ep)\s*[-#:]?\s*0*(\d{1,4})/i))) return out(1, +m[1]);
    const nums = clean.match(/\d{1,4}/g);
    if (nums) {
      for (let i = nums.length - 1; i >= 0; i--) {
        if (YEAR(nums[i], +nums[i])) continue;                        // parece un año
        return out(1, +nums[i]);
      }
    }
    return out(1, null);
  }

  const prettyName = (name) =>
    name.replace(/^.*\//, "").replace(/\.[a-z0-9]+$/i, "").replace(/\.ia$/i, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();

  /* "1 lisa saca 2 homero" -> "Lisa saca 2 homero" (quita el nº de episodio del principio) */
  function episodeTitle(name) {
    const raw = prettyName(name);
    let t = raw
      .replace(/^s\d{1,2}\s*[ex]\d{1,4}\s*[-–:.)]*\s*/i, "")
      .replace(/^(?:(?:episode|episodio|epis[oó]dio|cap[ií]tulo|cap|ep)\s*)?\d{1,4}\s*[-–:.)]*\s*/i, "")
      .trim();
    if (!t || /^\d+$/.test(raw)) return "";
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  /* ---------- 3. Construir la lista de episodios ---------- */
  function buildEpisodes(cfg, item) {
    const parsed = item.files.map((f) => Object.assign({ f: f }, parseEp(f.name, cfg.episodeRegex)));
    parsed.sort((a, b) => a.f.name.localeCompare(b.f.name, undefined, { numeric: true, sensitivity: "base" }));

    // Los que no traen número reciben uno correlativo
    let max = 0;
    parsed.forEach((p) => { if (p.num != null && p.num > max) max = p.num; });
    parsed.forEach((p) => { if (p.num == null) p.num = ++max; });

    parsed.sort((a, b) => a.season - b.season || a.num - b.num || a.f.name.localeCompare(b.f.name));

    const used = {};
    const eps = parsed.map((p) => {
      let id = cfg.id + "~s" + p.season + "e" + p.num;
      if (used[id]) { used[id] += 1; id += "-" + used[id]; } else used[id] = 1;      // duplicados
      const own = p.f.title && p.f.title !== p.f.name ? p.f.title : episodeTitle(p.f.name);
      const generic = !own;                                   // el fichero no trae título: lo pondrá IMDb/TVmaze
      const fileTitle = own || "Episode " + p.num;
      return {
        id: id, kind: "series", source: "archive", seriesId: cfg.id, season: p.season, num: p.num,
        file: p.f.name, fileTitle: fileTitle, epTitle: fileTitle, generic: generic,
        mins: p.f.length ? Math.max(1, Math.round(p.f.length / 60)) : 24,
        src: fileUrl(item.id, p.f.name)
      };
    });
    return eps;
  }

  function finalizeEpisode(cfg, ep, next) {
    const s = L.byId(cfg.id) || {};
    ep.title = cfg.title + " — " + ep.epTitle;
    ep.genre = s.genre || cfg.genre;
    ep.tags = cfg.tags;
    ep.year = ep.released ? parseInt(String(ep.released).slice(0, 4), 10) || s.year : s.year || cfg.year;
    ep.score = ep.score || s.score || 8;
    ep.badge = "S" + ep.season + " • EP " + ep.num;
    ep.img = s.img || imgOf(cfg.archiveId);
    ep.imdb = s.imdb || null;
    ep.ago = 0; ep.views = 0;
    ep.desc = ep.desc || s.desc || cfg.desc;
    ep.episode = "S" + ep.season + " • EP " + ep.num + ": " + ep.epTitle;
    ep.director = (s.director && s.director !== "—") ? s.director : "Archive.org";
    ep.audio = cfg.audio; ep.rating = s.rating || cfg.rating;
    ep.nextId = next ? next.id : null;
    mem.eps[ep.id] = ep;
  }

  /* ---------- 4. API pública ---------- */
  async function loadSeries(ref) {
    const cfg = typeof ref === "string" ? seriesCfg(ref) : ref;
    if (!cfg) throw new Error("Serie desconocida: " + ref);
    if (mem.series[cfg.id]) return mem.series[cfg.id];

    const item = await fetchItem(cfg.archiveId);
    const episodes = buildEpisodes(cfg, item);

    // Metadatos de IMDb (opcional: si falla, seguimos con lo de archive.org)
    if (L.meta) { try { await L.meta.decorateSeries(cfg); await L.meta.applyEpisodes(cfg, episodes); } catch (e) { /* ignore */ } }

    episodes.forEach((ep, i) => finalizeEpisode(cfg, ep, episodes[i + 1]));
    const seasons = Array.from(new Set(episodes.map((e) => e.season))).sort((a, b) => a - b);
    return (mem.series[cfg.id] = { cfg: cfg, item: item, episodes: episodes, seasons: seasons });
  }

  /* Caché pequeña de episodios vistos, para Continue Watching / Mi Stash */
  const epCache = () => L.store.get("epcache", {});
  function remember(ep) {
    const all = epCache();
    all[ep.id] = Object.assign({}, ep, { at: Date.now() });
    const keys = Object.keys(all).sort((a, b) => all[b].at - all[a].at);
    keys.slice(80).forEach((k) => delete all[k]);
    L.store.set("epcache", all);
  }

  const episode = (id) => mem.eps[id] || epCache()[id] || null;

  async function resolveEpisode(id) {
    if (mem.eps[id]) return mem.eps[id];
    if (String(id).indexOf("mv~") === 0) {                  // película de un pack
      try { await loadMovies(); } catch (e) { /* usamos la caché */ }
      return mem.eps[id] || epCache()[id] || null;
    }
    const sid = String(id).split("~")[0];
    if (!seriesCfg(sid) || id.indexOf("~") < 0) return null;
    try { await loadSeries(sid); } catch (e) { return epCache()[id] || null; }
    return mem.eps[id] || null;
  }

  /* Por qué episodio seguir: el último visto sin terminar o el primero */
  async function startEpisodeFor(sid) {
    const data = await loadSeries(sid);
    const prog = L.progress.all();
    let best = null;
    data.episodes.forEach((e) => { const p = prog[e.id]; if (p && (!best || p.at > best.at)) best = { id: e.id, at: p.at }; });
    return (best && mem.eps[best.id]) || data.episodes[0] || null;
  }

  /* ---------- 5. Películas (packs de archive.org) ---------- */
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "movie";

  /* "The.Movie.2001.1080p.BluRay.mp4" -> { title: "The Movie", year: 2001 } */
  function parseMovieName(name) {
    let t = prettyName(name);
    if (!/\s/.test(t)) t = t.replace(/\./g, " ");
    t = t.replace(/\s+/g, " ").trim();
    let year = 0;
    const m = t.match(/(?:^|[\s(\[])((?:19|20)\d{2})(?=$|[\s)\]])/);
    if (m && m.index > 0) { year = +m[1]; t = t.slice(0, m.index); }
    t = t.replace(/[(\[][^)\]]*[)\]]/g, " ")
      .replace(/\b(2160p|1080p|720p|480p|4k|bluray|brrip|bdrip|webrip|web-dl|dvdrip|hdrip|x264|x265|h264|hevc)\b.*$/i, "")
      .replace(/[-–\s]+$/, "").replace(/\s+/g, " ").trim();
    return { title: t || prettyName(name), year: year };
  }

  function buildMovies(cfg, item) {
    const files = item.files.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
    const used = {};
    return files.map((f, i) => {
      const p = parseMovieName(f.name);
      const base = f.name.replace(PLAYABLE, "").replace(/\.ia$/i, "");
      let id = "mv~" + cfg.id + "~" + slug(base);
      if (used[id]) { used[id] += 1; id += "-" + used[id]; } else used[id] = 1;
      const thumb = item.thumbs && item.thumbs[base];
      return {
        id: id, kind: "movie", source: "archive", movieSet: cfg.id, file: f.name,
        title: p.title, baseTitle: p.title, genre: cfg.genre || "Movie", tags: (cfg.tags || []).slice(),
        mins: f.length ? Math.max(1, Math.round(f.length / 60)) : 90,
        year: p.year || cfg.year || item.year || new Date().getFullYear(),
        score: 8, badge: "NEW", img: thumb ? fileUrl(item.id, thumb) : imgOf(item.id),
        ago: 2 + i, views: 3000 - i, desc: cfg.desc || "Feature film streaming straight from archive.org.",
        director: cfg.director || "Archive.org", audio: cfg.audio || "Original", rating: cfg.rating || "Ages 13+",
        src: fileUrl(item.id, f.name)
      };
    });
  }

  /* Metadatos (IMDb/OMDb/Wikipedia) de las películas aún sin caché: 4 a la vez, sin bloquear la página */
  async function enrichMovies(list) {
    if (!list.length || !L.meta || !L.meta.decorateMovie) return;
    let i = 0, since = 0;
    const worker = async () => {
      while (i < list.length) {
        const m = list[i++];
        try { await L.meta.decorateMovie(m); } catch (e) { /* ignore */ }
        if (++since >= 6) { since = 0; L.emit("meta", { movies: true }); }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    L.emit("meta", { movies: true });
  }

  let moviesPromise = null;
  function loadMovies(force) {
    if (moviesPromise && !force) return moviesPromise;
    moviesPromise = (async () => {
      const all = [], pending = [];
      let failed = false;
      for (const cfg of CFG.movies || []) {
        try {
          const item = await fetchItem(cfg.archiveId);
          const list = buildMovies(cfg, item);
          // Lo que ya esté en caché se aplica al instante; el resto se pide en 2º plano (más abajo)
          list.forEach((m) => { if (!(L.meta && L.meta.decorateMovieCached && L.meta.decorateMovieCached(m))) pending.push(m); });
          list.forEach((m) => {
            mem.eps[m.id] = m;
            if (!DATA.titles.some((t) => t.id === m.id)) DATA.titles.push(m);
          });
          all.push.apply(all, list);
        } catch (e) {
          failed = true;
          console.warn("Película de archive.org:", e);
        }
      }
      if (failed) L.toast("Couldn't load every movie from archive.org");
      L.emit("catalog", { movies: all });
      enrichMovies(pending);
      return all;
    })();
    return moviesPromise;
  }

  async function debug(aid) {
    const item = await fetchItem(aid || CFG.series[0].archiveId);
    console.table(item.files.map((f) => Object.assign({}, f, parseEp(f.name))));
    return item;
  }

  const siblings = (sid) => (mem.series[sid] ? mem.series[sid].episodes : []);

  L.archive = {
    siblings: siblings, loadSeries: loadSeries, episode: episode, resolveEpisode: resolveEpisode, remember: remember,
    startEpisodeFor: startEpisodeFor, seriesCfg: seriesCfg, imgOf: imgOf, fileUrl: fileUrl, debug: debug,
    loadMovies: loadMovies
  };

  /* Arranca la carga de películas cuando todos los scripts ya están listos
     (así meta.js y los listeners de cada página existen ya) */
  if ((CFG.movies || []).length) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => loadMovies());
    else loadMovies();
  }
})();
