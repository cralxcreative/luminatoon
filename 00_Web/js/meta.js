/* ==========================================================
   meta.js  -  metadatos de IMDb (vía OMDb) con caché en 3 capas
   1) localStorage (30 días)  2) Firestore  catalog/<serieId>
   3) OMDb API (datos de IMDb) -> y se guarda en Firestore.
   IMDb no tiene API pública gratuita ni permite scraping desde el
   navegador (CORS + términos de uso); OMDb sirve los mismos datos
   por imdbID. Clave gratis: https://www.omdbapi.com/apikey.aspx
   ========================================================== */
(function () {
  "use strict";

  const L = window.Lumina;
  const CFG = window.LUMINA_CONFIG;
  const TTL = 30 * 24 * 3600 * 1000;
  const OMDB = "https://www.omdbapi.com/";

  /* Promesa que firebase.js resuelve con la instancia de Firestore (o null) */
  window.LuminaCloud = window.LuminaCloud || {};
  if (!window.LuminaCloud.dbPromise) {
    window.LuminaCloud.dbPromise = new Promise((res) => { window.LuminaCloud._resolveDb = res; });
  }
  const getDb = () =>
    window.FIREBASE_CONFIG
      ? Promise.race([window.LuminaCloud.dbPromise, new Promise((r) => setTimeout(() => r(null), 4000))])
      : Promise.resolve(null);

  const clean = (v) => (v && v !== "N/A" ? v : "");
  const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };

  async function omdb(params) {
    if (!CFG.omdbKey) return null;
    const qs = new URLSearchParams(Object.assign({ apikey: CFG.omdbKey }, params));
    const res = await fetch(OMDB + "?" + qs.toString());
    if (!res.ok) return null;
    const j = await res.json();
    return j && j.Response === "True" ? j : null;
  }

  function shapeSeries(j) {
    return {
      imdbID: j.imdbID, title: j.Title, year: parseInt(j.Year, 10) || 0, rated: clean(j.Rated),
      runtime: clean(j.Runtime), genre: clean(j.Genre), writer: clean(j.Writer), actors: clean(j.Actors),
      plot: clean(j.Plot), language: clean(j.Language), country: clean(j.Country),
      poster: /^https?:/.test(j.Poster || "") ? j.Poster : "", imdbRating: num(j.imdbRating),
      imdbVotes: clean(j.imdbVotes), totalSeasons: parseInt(j.totalSeasons, 10) || 0, seasons: {}
    };
  }

  /* ---------- TVmaze (sin clave, con CORS) ----------
     Se usa cuando no hay clave de OMDb o OMDb no encuentra la serie.
     Trae portada, sinopsis, año, géneros, reparto, valoración y los títulos/fechas
     de todos los episodios de una sola vez. */
  const TVM = "https://api.tvmaze.com";
  const stripHtml = (h) => String(h || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  async function tvmazeShow(cfg) {
    const embed = "embed[]=episodes&embed[]=cast";
    let show = null;
    try {
      if (cfg.imdbId) {
        const r = await fetch(TVM + "/lookup/shows?imdb=" + encodeURIComponent(cfg.imdbId));
        if (r.ok) {
          const s0 = await r.json();
          if (s0 && s0.id) { const r2 = await fetch(TVM + "/shows/" + s0.id + "?" + embed); if (r2.ok) show = await r2.json(); }
        }
      }
      if (!show) {
        const r = await fetch(TVM + "/singlesearch/shows?q=" + encodeURIComponent(cfg.title) + "&" + embed);
        if (r.ok) show = await r.json();
      }
    } catch (e) { return null; }
    return show && show.id ? show : null;
  }

  function shapeTvmaze(s) {
    const emb = s._embedded || {};
    const seasons = {};
    (emb.episodes || []).filter((e) => e.number != null).forEach((e) => {
      const k = String(e.season);
      (seasons[k] = seasons[k] || {})[e.number] = { t: e.name || "", r: e.airdate || "", s: num(e.rating && e.rating.average), i: "" };
    });
    const keys = Object.keys(seasons).map(Number);
    const mins = s.averageRuntime || s.runtime || 0;
    return {
      src: "tvmaze", tvmazeId: s.id, imdbID: (s.externals && s.externals.imdb) || "", title: s.name,
      year: parseInt(String(s.premiered || "").slice(0, 4), 10) || 0, rated: "", runtime: mins ? mins + " min" : "",
      genre: (s.genres || []).join(", "), writer: "",
      actors: (emb.cast || []).slice(0, 6).map((c) => c.person && c.person.name).filter(Boolean).join(", "),
      plot: stripHtml(s.summary), language: s.language || "", country: "",
      poster: s.image ? (s.image.original || s.image.medium || "") : "",
      imdbRating: num(s.rating && s.rating.average), imdbVotes: "",
      totalSeasons: keys.length ? Math.max.apply(null, keys) : 0, seasons: seasons
    };
  }

  /* ---------- Serie ---------- */
  const lsKey = (id) => "meta:" + id;

  /* Datos de TVmaze cacheados dejan de valer en cuanto hay clave de OMDb (IMDb real) */
  const stale = (d) => !!(d && d.src === "tvmaze" && CFG.omdbKey);

  async function getSeries(cfg, opts) {
    opts = opts || {};
    const cached = L.store.get(lsKey(cfg.id), null);
    if (cached && Date.now() - cached.at < TTL && !opts.force && !stale(cached.data)) return cached.data;

    let data = null, fromCloud = false;
    const db = await getDb();
    if (db && !opts.force) {
      try {
        const snap = await db.collection("catalog").doc(cfg.id).get();
        if (snap.exists && !stale(snap.data())) { data = snap.data(); fromCloud = true; }
      } catch (e) { /* sin permisos o sin red */ }
    }

    if (!data) {
      const j = await omdb(cfg.imdbId ? { i: cfg.imdbId, plot: "full" } : { t: cfg.title, type: "series", plot: "full" });
      if (j) data = shapeSeries(j);
    }
    if (!data) {
      const tv = await tvmazeShow(cfg);
      if (tv) data = shapeTvmaze(tv);
    }
    if (data) {
      L.store.set(lsKey(cfg.id), { at: Date.now(), data: data });
      if (db && !fromCloud) saveCloud(db, cfg.id, data);
    }
    return data;
  }

  /* Solo escribe si las reglas lo permiten (ver reglas de Firestore) */
  function saveCloud(db, id, data) {
    const doc = Object.assign({}, data, { updatedAt: Date.now() });
    db.collection("catalog").doc(id).set(doc).catch(() => { /* sin permiso: no pasa nada */ });
  }

  /* ---------- Temporada ---------- */
  async function getSeason(cfg, meta, season) {
    const key = String(season);
    if (meta.seasons && meta.seasons[key]) return meta.seasons[key];
    if (meta.src === "tvmaze" || !meta.imdbID) return null;      // TVmaze ya trae todas las temporadas
    const j = await omdb({ i: meta.imdbID, Season: key });
    if (!j || !j.Episodes) return null;
    const map = {};
    j.Episodes.forEach((e) => {
      map[e.Episode] = { t: e.Title, r: clean(e.Released), s: num(e.imdbRating), i: e.imdbID };
    });
    meta.seasons = meta.seasons || {};
    meta.seasons[key] = map;
    L.store.set(lsKey(cfg.id), { at: Date.now(), data: meta });
    const db = await getDb();
    if (db) saveCloud(db, cfg.id, meta);
    return map;
  }

  /* ---------- Aplicar a la UI ---------- */
  function paintSeries(cfg, meta) {
    const t = L.byId(cfg.id);
    if (!t || !meta) return t;
    if (meta.plot) t.desc = meta.plot;
    if (meta.year) t.year = meta.year;
    if (meta.imdbRating) t.score = meta.imdbRating;
    if (meta.poster) t.img = meta.poster;
    if (meta.genre) t.genre = meta.genre.split(",").join(" •");
    if (meta.rated) t.rating = meta.rated;
    if (meta.writer) t.director = meta.writer.split(",")[0];
    if (meta.language) t.audio = meta.language;
    if (meta.runtime) { const m = parseInt(meta.runtime, 10); if (m) t.mins = m; }
    t.imdb = { src: meta.src || "imdb", id: meta.imdbID, rating: meta.imdbRating, votes: meta.imdbVotes, seasons: meta.totalSeasons, actors: meta.actors };
    return t;
  }

  async function decorateSeries(cfg) {
    const meta = await getSeries(cfg);
    return paintSeries(cfg, meta);
  }

  /* Poner el título real de IMDb a cada episodio, si la numeración cuadra */
  async function applyEpisodes(cfg, episodes) {
    const meta = await getSeries(cfg);
    if (!meta || !meta.imdbID) return;
    const bySeason = {};
    episodes.forEach((e) => { (bySeason[e.season] = bySeason[e.season] || []).push(e); });

    for (const s of Object.keys(bySeason)) {
      const map = await getSeason(cfg, meta, s);
      if (!map) continue;
      const list = bySeason[s];
      const matched = list.filter((e) => map[e.num]);
      if (matched.length < list.length * 0.7) continue;           // numeración distinta: no mezclar
      matched.forEach((e) => {
        const m = map[e.num];
        if (e.generic && m.t) e.epTitle = m.t;                   // el fichero no traía título
        else if (m.t && m.t.toLowerCase() !== String(e.epTitle).toLowerCase()) e.origTitle = m.t;   // título original
        e.released = m.r; if (m.s) e.score = m.s; e.imdbEpisodeId = m.i || "tvm";
      });
    }
  }

  /* ---------- Película suelta (packs de archive.org) ----------
     Solo caché local (30 días): una petición a OMDb por película, una única vez. */
  const mvKey = (m) => "meta:movie:" + m.id;

  function tagsFromGenre(genre) {
    const g = String(genre || "").toLowerCase(), out = [];
    if (/action|adventure/.test(g)) out.push("action");
    if (/comedy/.test(g)) out.push("comedy");
    if (/fantasy|sci-fi/.test(g)) out.push("fantasy");
    if (/animation/.test(g) && /anime/.test(g)) out.push("anime");
    return out;
  }

  /* Sin clave de OMDb: sugerencias públicas de IMDb (id, año, póster, reparto) + sinopsis de Wikipedia.
     La nota de IMDb y el género/director solo los da OMDb. Si algo falla, se devuelve null (sin caché). */
  const near = (a, b) => !a || !b || Math.abs(a - b) <= 1;

  async function imdbSuggest(m) {
    const q = String(m.baseTitle || m.title).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "");
    if (!q) return { none: true };
    const res = await fetch("https://v2.sg.media-imdb.com/suggestion/" + encodeURIComponent(q.charAt(0)) + "/" + encodeURIComponent(q) + ".json");
    if (!res.ok) return null;
    const j = await res.json();
    const hit = (j.d || []).find((x) => /^tt/.test(x.id || "") && /movie|tvMovie/i.test(x.qid || "") && near(m.year, x.y));
    if (!hit) return { none: true };
    return { src: "free", title: hit.l, year: hit.y || 0, imdbID: hit.id, actors: hit.s || "", poster: hit.i && hit.i.imageUrl ? hit.i.imageUrl : "" };
  }

  async function wikiPlot(title, year) {
    try {
      const qs = new URLSearchParams({ action: "query", generator: "search", gsrlimit: "1", gsrsearch: title + (year ? " " + year : "") + " film",
        prop: "extracts", exintro: "1", explaintext: "1", exsentences: "3", format: "json", origin: "*" });
      const res = await fetch("https://en.wikipedia.org/w/api.php?" + qs.toString());
      if (!res.ok) return "";
      const j = await res.json();
      const page = j.query && Object.values(j.query.pages || {})[0];
      if (!page || !page.extract) return "";
      return page.title.toLowerCase().indexOf(String(title).toLowerCase().slice(0, 12)) > -1 ? page.extract.trim() : "";
    } catch (e) { return ""; }
  }

  async function freeMovie(m) {
    let d = null;
    try { d = await imdbSuggest(m); } catch (e) { return null; }
    if (d && !d.none) d.plot = await wikiPlot(d.title, d.year);
    return d;
  }

  function paintMovie(m, d) {
    if (!d || d.none) return m;
    if (d.title && d.title.toLowerCase() !== String(m.title).toLowerCase()) m.origTitle = d.title;   // el título del fichero se respeta
    if (d.plot) m.desc = d.plot;
    if (d.year) m.year = d.year;
    if (d.imdbRating) m.score = d.imdbRating;
    if (d.poster) m.img = d.poster;
    if (d.genre) { m.genre = d.genre.split(",").join(" •"); const t = tagsFromGenre(d.genre); if (t.length) m.tags = t; }
    if (d.rated) m.rating = d.rated;
    if (d.director) m.director = d.director;
    if (d.language) m.audio = d.language;
    if (d.runtime) { const mins = parseInt(d.runtime, 10); if (mins) m.mins = mins; }
    if (d.imdbID) m.imdb = { src: "imdb", id: d.imdbID, rating: d.imdbRating || 0, actors: d.actors || "" };
    return m;
  }

  /* Síncrono: aplica lo que ya esté en caché y dice si la película está "completa" */
  function decorateMovieCached(m) {
    const c = L.store.get(mvKey(m), null);
    const ok = c && c.data && Date.now() - c.at < TTL && !(c.data.src === "free" && CFG.omdbKey);
    if (ok) paintMovie(m, c.data);
    return !!ok;
  }

  async function decorateMovie(m) {
    let d = null;
    const cached = L.store.get(mvKey(m), null);
    const staleFree = cached && cached.data && cached.data.src === "free" && CFG.omdbKey;   // ahora hay clave: pedir a OMDb
    if (cached && Date.now() - cached.at < TTL && !staleFree) d = cached.data;
    else {
      const j = CFG.omdbKey ? await omdb(Object.assign({ t: m.baseTitle || m.title, type: "movie", plot: "full" }, m.year ? { y: m.year } : {})) : null;
      if (j) {
        d = {
          title: j.Title, year: parseInt(j.Year, 10) || 0, rated: clean(j.Rated), runtime: clean(j.Runtime),
          genre: clean(j.Genre), director: clean(j.Director), plot: clean(j.Plot), language: clean(j.Language),
          actors: clean(j.Actors), poster: /^https?:/.test(j.Poster || "") ? j.Poster : "", imdbRating: num(j.imdbRating), imdbID: j.imdbID
        };
      } else d = await freeMovie(m);
      if (d) L.store.set(mvKey(m), { at: Date.now(), data: d });
    }
    return paintMovie(m, d);
  }

  /* Al cargar: pintar lo que ya esté en caché (síncrono) y refrescar en 2º plano */
  function applyCached() {
    CFG.series.forEach((cfg) => {
      const c = L.store.get(lsKey(cfg.id), null);
      if (c && c.data) paintSeries(cfg, c.data);
    });
  }
  applyCached();
  CFG.series.forEach((cfg) => { getSeries(cfg).then((m) => { if (m) { paintSeries(cfg, m); L.emit("meta", { id: cfg.id }); } }).catch(() => {}); });

  L.meta = { getSeries: getSeries, getSeason: getSeason, decorateSeries: decorateSeries, applyEpisodes: applyEpisodes, applyCached: applyCached, decorateMovie: decorateMovie, decorateMovieCached: decorateMovieCached };
})();
