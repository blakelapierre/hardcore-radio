/* Hardcore: per-track thumbs up/down ratings (Firebase Firestore + Anonymous Auth).
 * ES module, no build step. Loads the Firebase SDK from gstatic ONLY when firebase-config.js
 * holds a real config. With placeholders it does nothing (UI stays hidden, no console noise).
 * Talks to app.js via window.RadioState and the "radio:tracks" event.
 */
const SDK = "https://www.gstatic.com/firebasejs/12.19.0";
const ID_RE = /^[A-Za-z0-9_-]{11}$/;

function isConfigured(c) {
  return !!(c && c.apiKey && c.projectId && c.appId &&
    ![c.apiKey, c.projectId, c.appId].some((v) => /YOUR_|PLACEHOLDER/i.test(String(v))));
}

// Local testing against the Firebase emulators: http://localhost:8080/?emulator=1
const params = new URLSearchParams(location.search);
const EMU = params.has("emulator") && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const cfg = EMU ? { apiKey: "demo-key", projectId: "demo-hardcore", appId: "demo-app", authDomain: "localhost" }
                : window.FIREBASE_CONFIG;

if (isConfigured(cfg)) init().catch((e) => { hideUi(); console.info("Ratings unavailable:", e && e.code || e); });

function hideUi() { const r = document.getElementById("rating"); if (r) r.hidden = true; }

async function init() {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-auth.js`), import(`${SDK}/firebase-firestore.js`),
  ]);
  const app = initializeApp(cfg);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  if (EMU) {
    A.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    F.connectFirestoreEmulator(db, "127.0.0.1", 8081);
  }

  const ui = {
    root: document.getElementById("rating"),
    up: document.getElementById("rate-up"), down: document.getElementById("rate-down"),
    upN: document.getElementById("rate-up-n"), downN: document.getElementById("rate-down-n"),
    summary: document.getElementById("rate-summary"),
  };
  const counts = new Map();   // videoId -> {up, down}
  let currentId = null, myVote = 0, unsubTrack = null, unsubVote = null, busy = false;
  let user = auth.currentUser;

  const trackRef = (id) => F.doc(db, "tracks", id);
  const voteRef = (id, uid) => F.doc(db, "tracks", id, "votes", uid);

  function summaryText(c) {
    const total = (c.up || 0) + (c.down || 0);
    if (!total) return "No ratings yet. Be the first.";
    return `${Math.round((100 * c.up) / total)}% liked · ${total} vote${total === 1 ? "" : "s"}`;
  }
  function renderCurrent() {
    const c = counts.get(currentId) || { up: 0, down: 0 };
    ui.upN.textContent = c.up || 0;
    ui.downN.textContent = c.down || 0;
    ui.summary.textContent = summaryText(c);
    ui.up.setAttribute("aria-pressed", String(myVote === 1));
    ui.down.setAttribute("aria-pressed", String(myVote === -1));
    ui.up.disabled = ui.down.disabled = busy || !currentId;
  }
  function renderQueueBadges() {
    document.querySelectorAll("#queue button[data-id]").forEach((b) => {
      const c = counts.get(b.dataset.id);
      let badge = b.querySelector(".q-rating");
      const total = c ? c.up + c.down : 0;
      if (!total) { if (badge) badge.remove(); return; }
      if (!badge) { badge = document.createElement("span"); badge.className = "q-rating"; b.appendChild(badge); }
      badge.textContent = `👍 ${Math.round((100 * c.up) / total)}%`;
      badge.title = `${c.up} up · ${c.down} down`;
    });
  }

  function watchCurrent(id) {
    if (id === currentId) return;
    currentId = id; myVote = 0;
    if (unsubTrack) unsubTrack();
    unsubTrack = F.onSnapshot(trackRef(id), (s) => {
      const d = s.data() || {};
      counts.set(id, { up: d.up || 0, down: d.down || 0 });
      renderCurrent(); renderQueueBadges();
    }, () => hideUi());
    watchMyVote();
    renderCurrent();
  }
  function watchMyVote() {
    if (unsubVote) { unsubVote(); unsubVote = null; }
    if (!user || !currentId) { myVote = 0; renderCurrent(); return; }
    const id = currentId;
    unsubVote = F.onSnapshot(voteRef(id, user.uid), (s) => {
      if (id !== currentId) return;
      myVote = s.exists() ? s.data().value : 0; renderCurrent();
    }, () => {});
  }

  // Aggregates for the queue (one query per 30 IDs, refetched when the queue changes).
  let lastIds = "";
  async function loadQueueCounts(ids) {
    ids = [...new Set(ids.filter((x) => ID_RE.test(x)))].slice(0, 60);
    const key = ids.join(",");
    if (key === lastIds) { renderQueueBadges(); return; }
    lastIds = key;
    for (let i = 0; i < ids.length; i += 30) {
      const chunk = ids.slice(i, i + 30);
      try {
        const snap = await F.getDocs(F.query(F.collection(db, "tracks"), F.where(F.documentId(), "in", chunk)));
        snap.forEach((d) => counts.set(d.id, { up: d.data().up || 0, down: d.data().down || 0 }));
      } catch (_) { /* non-critical */ }
    }
    renderQueueBadges();
  }

  async function vote(value) {
    if (!currentId || busy) return;
    busy = true; renderCurrent();
    const id = currentId;
    try {
      if (!user) user = (await A.signInAnonymously(auth)).user;
      await F.runTransaction(db, async (tx) => {
        const [t, v] = await Promise.all([tx.get(trackRef(id)), tx.get(voteRef(id, user.uid))]);
        const c = t.exists() ? t.data() : { up: 0, down: 0 };
        const old = v.exists() ? v.data().value : 0;
        const next = old === value ? 0 : value;           // clicking your current vote removes it
        const up = (c.up || 0) + (next === 1) - (old === 1);
        const down = (c.down || 0) + (next === -1) - (old === -1);
        tx.set(trackRef(id), { up, down });
        if (next) tx.set(voteRef(id, user.uid), { value: next, updatedAt: F.serverTimestamp() });
        else tx.delete(voteRef(id, user.uid));
      });
    } catch (e) {
      console.info("Vote not saved:", e && e.code || e);
      ui.summary.textContent = "Couldn't save your vote. Try again.";
    } finally {
      busy = false; renderCurrent();
    }
  }

  ui.up.addEventListener("click", () => vote(1));
  ui.down.addEventListener("click", () => vote(-1));
  A.onAuthStateChanged(auth, (u) => { user = u; watchMyVote(); });

  function onTracks(state) {
    if (!state) return;
    if (state.current && ID_RE.test(state.current)) watchCurrent(state.current);
    loadQueueCounts(state.ids || []);
  }
  document.addEventListener("radio:tracks", (e) => onTracks(e.detail));
  ui.root.hidden = false;
  onTracks(window.RadioState);

  // Test hook (emulator only).
  if (EMU) window.__ratings = { vote, auth, db, F, A, counts: () => counts.get(currentId), myVote: () => myVote };
}
