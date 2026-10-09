/* ==========================================================
   config.js  -  ajustes del catálogo de archive.org + metadatos
   Se carga justo después de data.js (antes de common.js).
   Registra las series de archive.org dentro de DATA.titles para
   que aparezcan en buscador, "Mi Stash", Home y series.html.
   ========================================================== */
(function () {
  "use strict";

  const CONFIG = {
    /* Clave gratuita de OMDb (datos de IMDb): https://www.omdbapi.com/apikey.aspx
       Déjala vacía y la web funciona igual, solo sin metadatos de IMDb. */
    omdbKey: "",

    /* Series cuyos episodios están en archive.org.
       Para añadir otra: copia el bloque y cambia id / archiveId / title.
       - id:        slug propio (se usa en la URL: series.html?id=shinchan)
       - archiveId: identificador del item en archive.org
       - title:     título para buscar en IMDb (si falla, pon imdbId: "tt1234567")
       - episodeRegex (opcional): regex con 1 grupo para sacar el nº de episodio
         del nombre de archivo si el formato es raro.                         */
    series: [
      {
        id: "shinchan",
        archiveId: "shinchan_episodes-13092026-0930",
        title: "Crayon Shin-chan",
        imdbId: "",
        year: 1992,
        genre: "Comedia • Anime",
        tags: ["comedy", "anime"],
        rating: "Ages 13+",
        audio: "Original / Doblaje",
        desc: "Las travesuras diarias de Shinnosuke Nohara, un niño de cinco años con muy poca vergüenza.",
        episodeRegex: null
      },
      {
        id: "simpsons",
        archiveId: "simpson_episodes-07102026-0710",
        title: "The Simpsons",
        imdbId: "tt0096697",
        year: 1989,
        genre: "Comedia • Animación",
        tags: ["comedy", "classic"],
        rating: "Ages 13+",
        audio: "Original / Doblaje",
        desc: "Homer, Marge, Bart, Lisa y Maggie viven el día a día de Springfield, la familia más famosa de la animación.",
        episodeRegex: null
      }
    ],

    /* Packs de películas de archive.org: cada vídeo del item pasa a ser una
       película del catálogo (aparecen en movies.html, buscador, Home, etc.).
       - archiveId: identificador del item en archive.org
       - genre / tags / rating / audio / director / desc: valores por defecto
         para todas las películas del pack (opcionales). Con clave OMDb se
         sustituyen por los datos reales de IMDb de cada película.            */
    movies: [
      {
        id: "pack1",
        archiveId: "movies-11092026-0728",
        genre: "Movie",
        tags: [],
        rating: "Ages 13+",
        audio: "Original / Doblaje",
        director: "Archive.org",
        desc: ""
      }
    ]
  };

  window.LUMINA_CONFIG = CONFIG;

  const ia = (id) => "https://archive.org/services/img/" + encodeURIComponent(id);

  /* Registrar cada serie de archive.org como título del catálogo */
  CONFIG.series.forEach(function (s) {
    if (DATA.titles.some((t) => t.id === s.id)) return;
    DATA.titles.unshift({
      id: s.id, kind: "series", source: "archive", archiveId: s.archiveId,
      title: s.title, genre: s.genre, tags: s.tags, mins: 24, year: s.year,
      score: 9.0, badge: "NEW", img: ia(s.archiveId), ago: 1, views: 100000,
      desc: s.desc, episode: "Todos los episodios", director: "—",
      audio: s.audio, rating: s.rating, src: ""
    });
  });

  /* Que salga en Trending de la Home */
  CONFIG.series.forEach(function (s) {
    if (DATA.trendingIds.indexOf(s.id) === -1) DATA.trendingIds.unshift(s.id);
  });
})();
