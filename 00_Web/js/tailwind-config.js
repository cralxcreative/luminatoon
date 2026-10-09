/* ==========================================================
   tailwind-config.js
   Must be loaded right AFTER the Tailwind CDN <script>.
   ========================================================== */
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "comic-bg": "#0e0c19",
        "comic-dark": "#161326",
        "comic-panel": "#1f1b36",
        "comic-yellow": "#FFE600",
        "comic-pink": "#FF2E93",
        "comic-cyan": "#00F0FF",
        "comic-purple": "#7928CA",
        "comic-lime": "#A6FF00",
        "comic-orange": "#FF6B00",
        "comic-ink": "#0a0814",
        "primary": "#d0bcff",
        "surface": "#141220"
      },
      fontFamily: {
        "bangers": ["Bangers", "cursive"],
        "fredoka": ["Fredoka", "Rubik", "sans-serif"],
        "rubik": ["Rubik", "sans-serif"],
        "sans": ["Plus Jakarta Sans", "sans-serif"]
      },
      boxShadow: {
        "comic-sm": "3px 3px 0px #0a0814",
        "comic": "5px 5px 0px #0a0814",
        "comic-lg": "8px 8px 0px #0a0814",
        "comic-xl": "12px 12px 0px #0a0814",
        "comic-pink": "5px 5px 0px #FF2E93",
        "comic-cyan": "5px 5px 0px #00F0FF",
        "comic-yellow": "5px 5px 0px #FFE600"
      },
      // "border-3" and "-rotate-4" are used across the markup but
      // are not part of Tailwind's default scale, so we register them.
      borderWidth: { "3": "3px" },
      rotate: { "4": "4deg" }
    }
  }
};
