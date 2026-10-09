/* ==========================================================
   firebase.js  -  login con Google + sincronización en Firestore
   Carga diferida (defer) DESPUÉS de common.js. La web funciona igual
   sin Firebase: si falla, todo sigue en localStorage.

   Firestore:
     users/{uid}     -> { stash, progress, reactions, hiddenSeed, updatedAt }
     catalog/{serie} -> metadatos de IMDb cacheados (los escribe meta.js)
   ========================================================== */
(function () {
  "use strict";

  const L = window.Lumina;
  const Cloud = (window.LuminaCloud = window.LuminaCloud || {});
  if (!Cloud.dbPromise) Cloud.dbPromise = new Promise((res) => { Cloud._resolveDb = res; });

  const KEYS = ["stash", "progress", "reactions", "hiddenSeed"];
  const EMPTY = { stash: [], progress: {}, reactions: {}, hiddenSeed: [] };
  const $ = (s) => document.querySelector(s);

  if (typeof firebase === "undefined" || !window.FIREBASE_CONFIG) {
    Cloud._resolveDb(null);
    document.addEventListener("click", (e) => {
      if (e.target.closest("#btn-login, #menu-login, [data-login]")) {
        e.preventDefault();
        L.toast("No se pudo cargar Firebase. Revisa tu conexión.");
      }
    });
    return;
  }

  firebase.initializeApp(window.FIREBASE_CONFIG);
  const auth = firebase.auth();
  const db = firebase.firestore();
  Cloud.auth = auth; Cloud.db = db;
  Cloud._resolveDb(db);

  let uid = null;
  let unsub = null;
  let firstSnapshot = true;
  let applying = false;
  let pushTimer = null;
  let progressOnly = true;

  /* ---------- Login / logout ---------- */
  async function signIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await auth.signInWithPopup(provider);
    } catch (e) {
      if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") {
        return auth.signInWithRedirect(provider);
      }
      if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") return;
      if (e.code === "auth/unauthorized-domain") {
        L.toast("Dominio no autorizado: añádelo en Firebase → Authentication → Settings", { duration: 6000 });
      } else if (e.code === "auth/operation-not-allowed") {
        L.toast("Activa el proveedor Google en Firebase → Authentication", { duration: 6000 });
      } else {
        L.toast("No se pudo iniciar sesión con Google");
        console.error(e);
      }
    }
  }
  const signOut = () => auth.signOut().then(() => L.toast("Sesión cerrada"));
  Cloud.signIn = signIn; Cloud.signOut = signOut;

  document.addEventListener("click", (e) => {
    if (e.target.closest("#btn-login, #menu-login, [data-login]")) { e.preventDefault(); signIn(); }
    else if (e.target.closest("#menu-logout")) { e.preventDefault(); signOut(); }
  });

  /* ---------- UI ---------- */
  function paintAuth(user) {
    L.user = user || null;
    const login = $("#btn-login"), mLogin = $("#menu-login"), mOut = $("#menu-logout"), info = $("#auth-info");
    if (login) login.classList.toggle("hidden", !!user);
    if (login && !user) login.classList.add("flex");
    if (mLogin) mLogin.classList.toggle("hidden", !!user);
    if (mOut) mOut.classList.toggle("hidden", !user);
    if (info) {
      info.classList.toggle("hidden", !user);
      info.innerHTML = user
        ? '<div class="font-fredoka text-sm font-bold text-white truncate">' + L.escapeHtml(user.displayName || "Toon fan") + "</div>" +
          '<div class="font-fredoka text-[11px] text-comic-cyan truncate">' + L.escapeHtml(user.email || "") + "</div>" +
          '<div class="font-fredoka text-[10px] text-comic-lime font-bold mt-1">☁ Favoritos sincronizados</div>'
        : "";
    }
    const img = document.querySelector("#btn-profile img");
    if (img && user && user.photoURL) { img.referrerPolicy = "no-referrer"; img.src = user.photoURL; }
    L.emit("auth", { user: user || null });
  }

  /* ---------- Sincronización ---------- */
  const read = (k) => L.store.get(k, EMPTY[k]);
  const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const uniq = (a) => Array.from(new Set(a));

  function mergeProgress(local, remote, remoteUpdated) {
    const out = {};
    uniq(Object.keys(local).concat(Object.keys(remote))).forEach((id) => {
      const l = local[id], r = remote[id];
      if (l && r) out[id] = l.at >= r.at ? l : r;
      else if (r) out[id] = r;
      else if (l && l.at > (remoteUpdated || 0)) out[id] = l;      // lo borró otro dispositivo
    });
    return out;
  }

  function applyRemote(remote, first) {
    applying = true;
    try {
      const next = {
        stash: first ? uniq(read("stash").concat(remote.stash || [])) : (remote.stash || []),
        reactions: first ? Object.assign({}, remote.reactions || {}, read("reactions")) : (remote.reactions || {}),
        hiddenSeed: first ? uniq(read("hiddenSeed").concat(remote.hiddenSeed || [])) : (remote.hiddenSeed || []),
        progress: mergeProgress(read("progress"), remote.progress || {}, remote.updatedAt)
      };
      let stashChanged = false, progressChanged = false;
      KEYS.forEach((k) => {
        if (sameJson(read(k), next[k])) return;
        L.store.set(k, next[k]);
        if (k === "stash") stashChanged = true;
        if (k === "progress" || k === "hiddenSeed") progressChanged = true;
      });
      if (stashChanged) L.emit("stash", {});
      if (progressChanged) L.emit("progress", {});
    } finally { applying = false; }
  }

  function push() {
    if (!uid) return Promise.resolve();
    const data = { updatedAt: Date.now() };
    KEYS.forEach((k) => { data[k] = read(k); });
    return db.collection("users").doc(uid).set(JSON.parse(JSON.stringify(data))).catch((e) => console.warn("Firestore push:", e.code || e));
  }

  /* Los cambios de "progress" se agrupan cada 15 s; el resto, casi al instante */
  function schedule(key) {
    if (key !== "progress") progressOnly = false;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { progressOnly = true; push(); }, progressOnly ? 15000 : 1500);
  }
  function flush() { if (uid && pushTimer) { clearTimeout(pushTimer); pushTimer = null; push(); } }

  const origSet = L.store.set.bind(L.store);
  L.store.set = function (key, value) {
    origSet(key, value);
    if (!applying && uid && KEYS.indexOf(key) > -1) schedule(key);
  };
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => { if (document.hidden) flush(); });

  function startSync(user) {
    stopSync();
    uid = user.uid;
    firstSnapshot = true;
    unsub = db.collection("users").doc(uid).onSnapshot((snap) => {
      if (snap.metadata.hasPendingWrites) return;                    // eco de nuestra propia escritura
      if (!snap.exists) { firstSnapshot = false; push(); return; }
      const first = firstSnapshot;
      firstSnapshot = false;
      applyRemote(snap.data(), first);
      if (first) { push(); L.toast("☁ Favoritos sincronizados con tu cuenta"); }
    }, (err) => {
      console.warn("Firestore listener:", err.code || err);
      if (err.code === "permission-denied") L.toast("Firestore: revisa las reglas de seguridad", { duration: 5000 });
    });
  }

  function stopSync() {
    if (unsub) { unsub(); unsub = null; }
    clearTimeout(pushTimer); pushTimer = null;
    uid = null;
  }

  auth.getRedirectResult().catch(() => {});
  auth.onAuthStateChanged((user) => {
    if (user) startSync(user); else stopSync();
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => paintAuth(user));
    else paintAuth(user);
  });
})();
