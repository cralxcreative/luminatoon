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

  /* ---------- Serie ---------- */
  const lsKey = (id) => "meta:" + id;

  async function getSeries(cfg, opts) {
    opts = opts || {};
    const cached = L.store.get(lsKey(cfg.id), null);
    if (cached && Date.now() - cached.at < TTL && !opts.force) return cached.data;

    let data = null;
    const db = await getDb();
    if (db && !opts.force) {
      try {
        const snap = await db.collection("catalog").doc(cfg.id).get();
        if (snap.exists) data = snap.data();
      } catch (e) { /* sin permisos o sin red */ }
    }

    if (!data) {
      const j = await omdb(cfg.imdbId ? { i: cfg.imdbId, plot: "full" } : { t: cfg.title, type: "series", plot: "full" });
      if (j) {
        data = shapeSeries(j);
        if (db) saveCloud(db, cfg.id, data);
      }
    }
    if (data) L.store.set(lsKey(cfg.id), { at: Date.now(), data: data });
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
    if (!meta.imdbID) return null;
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
    t.imdb = { id: meta.imdbID, rating: meta.imdbRating, votes: meta.imdbVotes, seasons: meta.totalSeasons, actors: meta.actors };
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
        e.epTitle = m.t; e.released = m.r; if (m.s) e.score = m.s; e.imdbEpisodeId = m.i;
      });
    }
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

  L.meta = { getSeries: getSeries, getSeason: getSeason, decorateSeries: decorateSeries, applyEpisodes: applyEpisodes, applyCached: applyCached };
})();
