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
  const MOVIE_ROWS = [
    ["cosmic-cat-quantum-leap", "Cosmic Cat: Quantum Leap", "Cosmic Adventure", ["action", "comedy"], 92, 2024, 9.8, "4K HDR", "cosmicCat", 6, 9800,
      "The mischievous interstellar cat accidentally fires up the kibble hyperdrive and jumps through 8 animated dimensions at once to save the galaxy from an army of robot vacuums.",
      "Kenji Takahashi", "English & Japanese Atmos"],
    ["cyber-robots-galactic", "Galactic Cyber-Robots", "Sci-Fi", ["action"], 108, 2025, 9.9, "JUST ADDED", "cyberRobots", 2, 9100,
      "A crew of battered repair bots wins a decommissioned starship in a card game and discovers it still has one last jump left.",
      "Mina Okafor", "English 5.1"],
    ["turbo-dragster-return", "Turbo Dragster: The Return", "Racing", ["action", "3d"], 96, 2025, 9.7, "AUDIO 7.1", "turbo", 26, 8700,
      "The inverted-gravity track of the star coliseum reopens for the fastest tournament ever animated in 4K.",
      "Leo Brandt", "English 7.1"],
    ["raccoon-agents", "Raccoon Agents: Donut Mission", "Comedy", ["comedy", "kids"], 84, 2025, 9.4, "4K HDR", "raccoons", 60, 7400,
      "Three raccoons in oversized trench coats plan the cutest heist in the multiverse to recover the golden cosmic donut recipe.",
      "Priya Nair", "English + Subtitles"],
    ["abyssal-lights", "Empire of the Abyssal Lights", "Fantasy", ["fantasy"], 104, 2025, 9.9, "MASTER", "abyssal", 70, 8200,
      "Deep below the glowing trenches, a lantern-fish apprentice discovers the empire's lights are slowly going out.",
      "Hana Mori", "English 4K Master"],
    ["shinobi-fox", "Shinobi Fox: The Dragon Scroll", "Action & Ninjas", ["action", "anime"], 100, 2025, 9.6, "NEW", "fox", 72, 7900,
      "The daring acrobat fox must sneak into the floating temple of ten thousand lanterns to recover the mystic fire scroll before dawn.",
      "Daichi Mori", "English / Japanese"],
    ["cyber-robots-adventure", "Cyber-Robots: The Great Adventure", "Sci-Fi", ["action", "3d"], 112, 2022, 9.9, "MASTERPIECE", "cyberRobots", 900, 9900,
      "Acclaimed worldwide for its groundbreaking animation, universal humor and disco-pop score.",
      "Mina Okafor", "English 5.1"],
    ["cosmic-cat-zero", "Cosmic Cat: Flight Zero", "Space Comedy", ["comedy", "classic"], 98, 2019, 9.8, "FESTIVAL GEM", "cosmicCat", 1400, 9500,
      "The start of a legendary saga. Classic hand-drawn animation with heart and breakneck pacing.",
      "Kenji Takahashi", "English / Japanese"],
    ["lara-grimoire", "Lara and the Secret of the Flying Grimoire", "Magic Fantasy", ["fantasy", "classic"], 115, 2021, 9.7, "2D RETRO", "lara", 1100, 8800,
      "A young apprentice witch and her magic pencil rescue the creatures of a glowing forest in a landmark of traditional animation.",
      "Elena Duarte", "English Remaster"],
    ["eight-arms-coral", "Eight Arms and the Coral City", "Marine Fantasy", ["fantasy", "anime"], 104, 2022, 9.9, "GEM", "abyssal", 1000, 9300,
      "A luminous, poetic undersea odyssey that moved audiences of every age.",
      "Hana Mori", "English 4K Master"],
    ["raccoon-heist", "Raccoons to the Rescue: The Big Heist", "Slapstick Comedy", ["comedy"], 84, 2023, 9.4, "SLAPSTICK", "raccoons", 700, 7000,
      "The squad of furry detectives breaks into the most heavily guarded bakery in the city.",
      "Priya Nair", "English + Subtitles"],
    ["sugar-kingdom", "Sugar Kingdom: Candy War", "3D Animation", ["3d", "kids"], 89, 2024, 9.3, "3D CGI", "sugar", 500, 6400,
      "Gingerbread warriors and gummy bears defend the caramel castle in a visual feast.",
      "Tom Reyes", "English 5.1"],
    ["monsteropolis", "Monsteropolis: Prank Night", "Spooky Adventure", ["fantasy", "kids"], 78, 2023, 9.5, "SPECIAL", "monster", 650, 7100,
      "Three furry friends discover that laughter is scarier than any monster on Halloween.",
      "Ava Lindqvist", "English Ultra"],
    ["multiverse-gp", "Multiverse Grand Prix: Turbo", "Racing & Science", ["action", "3d"], 96, 2024, 9.7, "4K HDR", "turbo", 480, 7800,
      "Interdimensional tracks with curves that defy the laws of gravity.",
      "Leo Brandt", "English + Japanese Dub"],
    ["moonlight-ramen", "Moonlight Ramen Express", "Cozy Anime", ["anime", "fantasy"], 94, 2023, 9.2, "COZY", "lara", 400, 5600,
      "A night train serves ramen to wandering spirits, and the new conductor has exactly one night to learn the recipes.",
      "Yuki Arai", "English / Japanese"],
    ["paper-planes", "Paper Planes Over Neon City", "Anime Movie", ["anime", "action"], 118, 2024, 9.1, "ANIME", "trend5", 380, 6000,
      "Every paper plane folded in the old district carries a wish, and a rooftop courier races to deliver them all.",
      "Yuki Arai", "English / Japanese"],
    ["clay-pirates", "Clay Pirates of Pudding Bay", "Stop-Motion", ["3d", "comedy"], 82, 2022, 9.0, "STOP-MOTION", "top4", 360, 4800,
      "Handmade pirates sculpt their way out of trouble, one thumbprint at a time.",
      "Nora Fisk", "English"],
    ["little-thunder", "Little Thunder: Storm Cub", "Kids Adventure", ["kids", "fantasy"], 75, 2023, 9.0, "FAMILY", "trend3", 300, 5200,
      "A tiny storm cub learns to roar without flooding the village.",
      "Ava Lindqvist", "English"],
    ["inkwell-knights", "Inkwell Knights", "Classic 2D", ["classic", "action"], 101, 2018, 9.3, "CLASSIC", "trend2", 2000, 6600,
      "Knights made of ink defend a living manuscript from the Eraser King.",
      "Elena Duarte", "English Remaster"],
    ["banana-bandits", "Banana Bandits in Space", "Slapstick Comedy", ["comedy"], 80, 2020, 8.9, "LOL", "trend1", 1800, 4300,
      "Two orbiting bandits slip on the same peel for ninety straight minutes.",
      "Tom Reyes", "English"],
    ["lantern-festival", "The Lantern Festival Mystery", "Magic Fantasy", ["fantasy", "anime"], 97, 2022, 9.4, "HD", "top2", 950, 5900,
      "When the festival lanterns start whispering, one curious girl follows the glow to its source.",
      "Hana Mori", "English / Japanese"],
    ["robot-bakery", "Robot Bakery Rumble", "3D Animation", ["3d", "comedy", "kids"], 88, 2025, 9.2, "NEW", "top5", 120, 5000,
      "A bakery run by robots enters a pastry tournament with only a broken oven and a lot of confidence.",
      "Tom Reyes", "English 5.1"],
    ["snowglobe-heroes", "Snowglobe Heroes", "Preschool Fun", ["kids"], 70, 2021, 8.8, "PRESCHOOL", "trend4", 1200, 4100,
      "Tiny heroes inside a snowglobe keep the winter going, one shake at a time.",
      "Ava Lindqvist", "English"],
    ["captain-pixel-movie", "Captain Pixel: The Glitch Rises", "Sci-Fi Comedy", ["action", "comedy"], 105, 2025, 9.6, "PREMIERE", "top1", 10, 8000,
      "Captain Pixel faces the Big Glitch in a feature-length finale that erases the color from every panel.",
      "Kenji Takahashi", "English & Japanese Atmos"],
    ["chibi-cyber-robots", "Chibi Cyber-Robots: The Great Mission", "Family Special", ["kids", "comedy"], 96, 2024, 9.3, "TOON SPECIAL", "continue2", 200, 5400,
      "Laughs and flying bolts as the smallest robots take on the biggest mission.",
      "Priya Nair", "English"],
    ["super-chibi-dragon", "Super Chibi Dragon", "Family Movie", ["kids", "fantasy"], 90, 2024, 9.5, "FAMILY MOVIE", "top2", 250, 6100,
      "A pocket-sized dragon learns that the biggest flames come from the smallest sparks.",
      "Elena Duarte", "English"]
  ];

  /* ---------- Series ----------
     [id, title, genre label, tags, episode minutes, year, score,
      badge, image key, views, synopsis, episode label]          */
  const SERIES_ROWS = [
    ["pixel-multiverse", "Adventures in the Pixel Multiverse", "Original Animated Adventure", ["action", "comedy", "anime"], 24, 2025, 9.8, "THE TOON KING!", "top1", 99000,
      "The cube portals have gone haywire! Join Jax, Sparky and Captain Pixel on a wild race through candy galaxies and cyber nebulas before the Great Glitch erases all color.",
      "S3 • EP 1: Portal Panic"],
    ["cosmic-cat-mystery", "The Cosmic Cat Mystery", "Mystery Comedy", ["comedy", "kids"], 22, 2024, 9.5, "S1 • EP 7", "continue1", 7700,
      "Who keeps stealing the moon's cheese? One very curious cat and a nine-lives timeline.",
      "S1 • EP 7: The 9 Lives of the Big Bang"],
    ["magic-cookie-kingdom", "Magic Cookie Kingdom", "Magic Fantasy", ["fantasy", "kids"], 22, 2024, 9.4, "S2 • EP 4", "continue3", 6800,
      "The royal bakers of the Cookie Kingdom keep trouble at bay with a pinch of magic and a lot of frosting.",
      "S2 • EP 4: Dragon Cake"],
    ["toon-squad", "Toon Squad 2.0", "Comedy • Chibi Action", ["comedy", "action"], 22, 2025, 9.9, "★ 9.9 POP", "trend1", 8900,
      "A mismatched squad of chibi heroes saves the city while arguing about lunch.", "S2 • EP 1: Assemble!"],
    ["fantasy-valley", "Chronicles of Fantasy Valley", "Magic Adventure • Fantasy", ["fantasy", "anime"], 24, 2024, 9.6, "★ 9.6 POP", "trend2", 7500,
      "Every season, the valley's map redraws itself, and a young cartographer must keep up.", "S1 • EP 3: The Moving Map"],
    ["cuddly-monsters", "Cuddly Monsters Academy", "Fun • Creatures", ["kids", "comedy"], 20, 2023, 9.5, "★ 9.5 POP", "trend3", 7300,
      "At Cuddly Monsters Academy, the scariest class is Hugging 101.", "S2 • EP 2: Hug Day"],
    ["sonic-panda", "Super Sonic Panda", "Superpowers • Comedy", ["comedy", "action"], 22, 2024, 9.4, "★ 9.4 POP", "trend4", 6900,
      "Fast for a panda, slow for a hero. Bamboo breaks are mandatory.", "S1 • EP 5: Bamboo Break"],
    ["cloud-hunters", "Cloud Hunters", "Anime Adventure • Fliers", ["anime", "action"], 24, 2025, 9.7, "★ 9.7 POP", "trend5", 8300,
      "Sky pirates chase storm fronts for the rarest weather in the world.", "S1 • EP 9: Eye of the Storm"],
    ["neon-toon-void", "Neon Toon Void", "New Episodes", ["action", "anime"], 24, 2025, 9.2, "NEW EPISODES", "top3", 6200,
      "In the Neon Void, every doorway leads to a different animated style.", "S1 • EP 6: Cel Shading"],
    ["kyoto-ninja-cats", "Kyoto Ninja Cats", "Super Fun", ["comedy", "anime", "action"], 22, 2024, 9.0, "SUPER FUNNY", "top4", 5700,
      "Stealthy cats, noisy bells. The ninja clan of Kyoto has a collar problem.", "S1 • EP 4: Silent Bells"],
    ["submarine-octopus", "The Submarine Octopus", "Classic Toon", ["classic", "kids", "comedy"], 20, 2020, 9.1, "TOON CLASSIC", "top5", 5400,
      "An octopus captain and his tentacle-powered submarine explore the ocean one gadget at a time.", "S3 • EP 8: Eight Arms, Eight Hats"]
  ];

  /* ---------- Build the unified list ---------- */
  const titles = [];

  MOVIE_ROWS.forEach(function (r, i) {
    titles.push({
      id: r[0], kind: "movie", title: r[1], genre: r[2], tags: r[3], mins: r[4],
      year: r[5], score: r[6], badge: r[7], img: window.IMG[r[8]], ago: r[9],
      views: r[10], desc: r[11], director: r[12], audio: r[13],
      rating: r[3].indexOf("kids") > -1 ? "All Audiences" : "Ages 7+",
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

    /* Home page hero slides */
    featured: [
      {
        id: "pixel-multiverse", bg: window.IMG.heroBg,
        issue: "★ LUMINA COMICS #304", stamp: "APPROVED BY THE TOON CODE!",
        sticker: "EXCLUSIVE SEASON PREMIERE!", kicker: "ORIGINAL ANIMATED ADVENTURE",
        pre: "Adventures in the", hi: "Pixel Multiverse",
        badges: ["TOP 1 FAVORITE", "BOOM! NEW S3", "★ 9.8 POP SCORE", "4K HDR TOONCOLOR"],
        synopsis: "The cube portals have gone haywire! Join Jax, Sparky and Captain Pixel on a wild race through candy galaxies and cyber nebulas before the Great Glitch erases all color.",
        play: "PLAY NOW S3:E1", rating: "ALL AUDIENCES (7+)"
      },
      {
        id: "cosmic-cat-quantum-leap", bg: window.IMG.cosmicCat,
        issue: "★ LUMINA MOVIES #12", stamp: "FESTIVAL FAVORITE!",
        sticker: "MOVIE OF THE DAY!", kicker: "COSMIC COMEDY FEATURE",
        pre: "Cosmic Cat:", hi: "Quantum Leap",
        badges: ["TOP PICK", "BOOM! NEW", "★ 9.8 POP SCORE", "4K HDR"],
        synopsis: "One kibble-powered hyperdrive, eight animated dimensions and an army of angry robot vacuums. Nobody said saving the galaxy would be tidy.",
        play: "WATCH THE MOVIE", rating: "ALL AUDIENCES (7+)"
      },
      {
        id: "abyssal-lights", bg: window.IMG.abyssal,
        issue: "★ LUMINA MASTERS #08", stamp: "RESTORED IN 4K!",
        sticker: "DEEP-SEA PREMIERE!", kicker: "MARINE FANTASY EPIC",
        pre: "Empire of the", hi: "Abyssal Lights",
        badges: ["CRITICS' CHOICE", "BOOM! NEW", "★ 9.9 POP SCORE", "MASTER 4K"],
        synopsis: "Deep below the glowing trenches, a lantern-fish apprentice discovers the empire's lights are slowly going out, and she is the only one who noticed.",
        play: "WATCH THE MOVIE", rating: "ALL AUDIENCES (7+)"
      }
    ],

    /* Seed progress (0-1) shown in "Continue Watching" until real progress exists */
    continueSeed: {
      "cosmic-cat-mystery": 0.72,
      "chibi-cyber-robots": 0.45,
      "magic-cookie-kingdom": 0.88
    },

    trendingIds: ["toon-squad", "fantasy-valley", "cuddly-monsters", "sonic-panda", "cloud-hunters"],

    /* Top 10 filter pills (key → label) */
    topFilters: [
      { key: "all", label: "🌈 All Cartoons" },
      { key: "comedy", label: "🧁 Comedy & Slapstick" },
      { key: "anime", label: "⚔️ Anime Shonen & Action" },
      { key: "kids", label: "🎈 Preschool & Babies" }
    ],

    tickerMessages: [
      { tag: "KAPOW! 💥", text: "NEW DIGITAL VOLUME: S3 PIXEL MULTIVERSE WORLD PREMIERE ON LUMINA TOON!" },
      { tag: "ZAP! ⚡", text: "THE COSMIC CAT MOVIE MARATHON STARTS THIS WEEKEND!" },
      { tag: "POW! 🎬", text: "12 NEW MOVIES ADDED THIS WEEK. ROLL THE DICE ON THE MOVIES PAGE!" }
    ],

    notifications: [
      { icon: "new_releases", text: "S3 of Pixel Multiverse just dropped", when: "2h ago", id: "pixel-multiverse" },
      { icon: "casino", text: "Your daily random movie is ready", when: "5h ago", id: "cosmic-cat-quantum-leap" },
      { icon: "star", text: "Cloud Hunters hit a 9.7 Pop Score", when: "Yesterday", id: "cloud-hunters" }
    ]
  };
})();
