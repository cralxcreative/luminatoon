/* ==========================================================
   data.js
   The whole catalog lives here. Pages never hard-code titles:
   they render from this file, so adding a movie = adding a row.

   To use your own videos, set `src` on any title, e.g.
     { id: "...", src: "assets/videos/my-movie.mp4", ... }
   Titles without `src` fall back to the demo clips below.
   ========================================================== */
(function () {
  const VIDEO_BASE = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/";
  const DEMO_VIDEOS = [
    "BigBuckBunny.mp4",
    "ElephantsDream.mp4",
    "Sintel.mp4",
    "TearsOfSteel.mp4",
    "ForBiggerFun.mp4",
    "ForBiggerJoyrides.mp4"
  ];

  /* ---------- Movies ----------
     [id, title, genre label, tags, minutes, year, score,
      badge, image key, hours since added, views, synopsis,
      director, audio]                                         */
  const MOVIE_ROWS = [];   // sin relleno: las películas llegan de archive.org (config.js)

  /* ---------- Series ----------
     [id, title, genre label, tags, episode minutes, year, score,
      badge, image key, views, synopsis, episode label]          */
  const SERIES_ROWS = [];   // sin relleno: las series llegan de archive.org (config.js)

  /* ---------- Build the unified list ---------- */
  const titles = [];

  MOVIE_ROWS.forEach(function (r, i) {
    titles.push({
      id: r[0], kind: "movie", title: r[1], genre: r[2], tags: r[3], mins: r[4],
      year: r[5], score: r[6], badge: r[7], img: window.IMG[r[8]], ago: r[9],
      views: r[10], desc: r[11], director: r[12], audio: r[13],
      rating: "Ages 7+",
      src: VIDEO_BASE + DEMO_VIDEOS[i % DEMO_VIDEOS.length]
    });
  });

  SERIES_ROWS.forEach(function (r, i) {
    titles.push({
      id: r[0], kind: "series", title: r[1], genre: r[2], tags: r[3], mins: r[4],
      year: r[5], score: r[6], badge: r[7], img: window.IMG[r[8]], ago: 48 + i * 30,
      views: r[9], desc: r[10], episode: r[11], director: "Lumina Studios",
      audio: "English & Japanese", rating: "Ages 7+",
      src: VIDEO_BASE + DEMO_VIDEOS[(i + 2) % DEMO_VIDEOS.length]
    });
  });

  window.DATA = {
    titles: titles,

    /* Genre filters used by the movie catalog (key → label) */
    genres: [
      { key: "all", label: "🍿 All Movies", hover: "hover:bg-comic-cyan" },
      { key: "action", label: "💥 Adventure & Action", hover: "hover:bg-comic-cyan" },
      { key: "comedy", label: "🍌 Slapstick Comedy", hover: "hover:bg-comic-yellow" },
      { key: "fantasy", label: "🧙‍♂️ Magic Fantasy", hover: "hover:bg-comic-lime" },
      { key: "anime", label: "🎌 Anime Movie", hover: "hover:bg-comic-pink" },
      { key: "3d", label: "🤖 3D & Stop-Motion", hover: "hover:bg-comic-cyan" },
      { key: "classic", label: "✏️ 2D Classics", hover: "hover:bg-comic-yellow" }
    ],

    /* Hero de la Home: lo construye index.js con las series/películas de archive.org */
    featured: [],

    /* Progreso de ejemplo para "Continue Watching": ya no hay relleno */
    continueSeed: {},

    /* Ids extra para Trending (config.js añade aquí las series de archive.org) */
    trendingIds: [],

    /* Top 10 filter pills (key → label) */
    topFilters: [
      { key: "all", label: "🌈 All Cartoons" },
      { key: "comedy", label: "🧁 Comedy & Slapstick" },
      { key: "anime", label: "⚔️ Anime Shonen & Action" }
    ],

    tickerMessages: [
      { tag: "NOW STREAMING 📺", text: "SERIES AND MOVIES STRAIGHT FROM ARCHIVE.ORG, ZERO ADS!" },
      { tag: "POW! 🎬", text: "ROLL THE DICE ON THE MOVIES PAGE FOR A RANDOM PICK!" },
      { tag: "YAY! ⭐", text: "SAVE FAVORITES TO MY STASH AND PICK UP WHERE YOU LEFT OFF!" }
    ],

    notifications: []
  };
})();
