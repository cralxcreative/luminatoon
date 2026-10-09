/* ==========================================================
   archive.js  -  episodios desde archive.org
   Lumina.archive:
     loadSeries(cfg|id)   -> { cfg, item, episodes, seasons }
     episode(id)          -> episodio ya cargado (síncrono) o null
     resolveEpisode(id)   -> carga la serie y devuelve el episodio
     startEpisodeFor(id)  -> episodio por el que seguir / empezar
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
    const item = {
      id: aid,
      title: md.title || aid,
      description: Array.isArray(md.description) ? md.description.join(" ") : md.description || "",
      files: pickVideos(data.files).map((f) => ({
        name: f.name, title: f.title || "", length: parseLength(f.length), size: Number(f.size) || 0
      }))
    };
    L.store.set("ia:" + aid, { at: Date.now(), data: item });
    return (mem.items[aid] = item);
  }

  /* ---------- 2. Temporada / nº de episodio a partir del nombre ---------- */
  function parseEp(name, customRegex) {
    const clean = name.replace(/\.[a-z0-9]+$/i, "").replace(/[_.]+/g, " ");
    let m;
    if (customRegex) {
      m = clean.match(new RegExp(customRegex, "i"));
      if (m) return { season: 1, num: parseInt(m[1], 10) };
    }
    if ((m = clean.match(/\bs(\d{1,2})\s*[ex]\s*(\d{1,4})/i))) return { season: +m[1], num: +m[2] };
    if ((m = clean.match(/\b(\d{1,2})x(\d{2,4})\b/i))) return { season: +m[1], num: +m[2] };
    if ((m = clean.match(/(?:episode|episodio|epis[oó]dio|cap[ií]tulo|cap|ep|e)\s*[-#:]?\s*(\d{1,4})/i)))
      return { season: 1, num: +m[1] };
    const nums = clean.match(/\d{1,4}/g);
    if (nums) {
      for (let i = nums.length - 1; i >= 0; i--) {
        const n = +nums[i];
        if (nums[i].length === 4 && n >= 1950 && n <= 2100) continue;   // parece un año
        return { season: 1, num: n };
      }
    }
    return { season: 1, num: null };
  }

  const prettyName = (name) =>
    name.replace(/^.*\//, "").replace(/\.[a-z0-9]+$/i, "").replace(/\.ia$/i, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();

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
      const fileTitle = (p.f.title && p.f.title !== p.f.name ? p.f.title : prettyName(p.f.name));
      return {
        id: id, kind: "series", source: "archive", seriesId: cfg.id, season: p.season, num: p.num,
        file: p.f.name, fileTitle: fileTitle, epTitle: fileTitle,
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
    all[ep.id] = {
      id: ep.id, kind: "series", source: "archive", seriesId: ep.seriesId, season: ep.season, num: ep.num,
      title: ep.title, epTitle: ep.epTitle, genre: ep.genre, tags: ep.tags, mins: ep.mins, year: ep.year, score: ep.score,
      badge: ep.badge, img: ep.img, ago: 0, views: 0, desc: ep.desc, episode: ep.episode, director: ep.director,
      audio: ep.audio, rating: ep.rating, src: ep.src, nextId: ep.nextId, at: Date.now()
    };
    const keys = Object.keys(all).sort((a, b) => all[b].at - all[a].at);
    keys.slice(80).forEach((k) => delete all[k]);
    L.store.set("epcache", all);
  }

  const episode = (id) => mem.eps[id] || epCache()[id] || null;

  async function resolveEpisode(id) {
    if (mem.eps[id]) return mem.eps[id];
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

  async function debug(aid) {
    const item = await fetchItem(aid || CFG.series[0].archiveId);
    console.table(item.files.map((f) => Object.assign({}, f, parseEp(f.name))));
    return item;
  }

  const siblings = (sid) => (mem.series[sid] ? mem.series[sid].episodes : []);

  L.archive = {
    siblings: siblings, loadSeries: loadSeries, episode: episode, resolveEpisode: resolveEpisode, remember: remember,
    startEpisodeFor: startEpisodeFor, seriesCfg: seriesCfg, imgOf: imgOf, fileUrl: fileUrl, debug: debug
  };
})();
