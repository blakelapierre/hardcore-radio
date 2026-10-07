/* Hardcore (web radio) — player logic.
 * Uses ONLY the official YouTube IFrame Player API. The player stays visible at 16:9;
 * nothing is drawn on top of it, and YouTube's own ads/controls are left untouched.
 */
(function () {
  "use strict";

  var CFG = window.STATION_CONFIG || {};
  var META = window.TRACK_META || {};
  var ART = window.STATION_ARTISTS || {};
  var ARTISTS = ART.artists || {};           // slug -> {name, bio}
  var TRACK_ARTISTS = ART.tracks || {};      // video ID -> [slugs], main artist first
  var SRC = CFG.source || { type: "videos" };
  var MODE = SRC.type === "playlist" && SRC.playlistId ? "playlist" : "videos";
  var LOOP = SRC.loop !== false;

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    play: $("btn-play"), next: $("btn-next"), prev: $("btn-prev"), random: $("btn-random"), randomState: $("random-state"),
    volume: $("volume"), queue: $("queue"), notes: $("track-notes"), about: $("about"),
    title: $("np-title"), channel: $("np-channel"), thumb: $("np-thumb"),
    bar: $("progress-bar"), cur: $("t-cur"), dur: $("t-dur"), onAir: $("on-air"),
    onAirLabel: $("on-air-label"), fallback: $("player-fallback"),
    nowNote: $("now-note"), nowArtists: $("now-artists"), notesCount: $("notes-count"),
    artistsPanel: $("artists-panel"), artistList: $("artist-list"), artistsCount: $("artists-count"),
    artistsClear: $("artists-clear"), artistCol: $("artist-col"), artistsSlot: $("artists-slot"),
    nowArtistsCard: $("now-artists-card"), nowArtistsList: $("now-artists-list"), nowArtistsSlot: $("now-artists-slot"),
    sideCol: document.querySelector(".side-col"),
  };
  var selectedArtist = null; // slug whose tracks are highlighted in the queue

  // ---------- Track model ----------
  // tracks: [{id, title, channel, channelUrl, notes}]
  var tracks = MODE === "videos"
    ? (CFG.tracks || []).filter(function (t) { return t && t.id; }).map(function (t) {
        var m = META[t.id] || {};
        return { id: t.id, title: t.title || m.title || "", channel: t.channel || m.channel || "",
                 channelUrl: t.channelUrl || m.channelUrl || "", notes: t.notes || "" };
      })
    : []; // filled from player.getPlaylist() in playlist mode

  var order = tracks.map(function (_, i) { return i; }); // sequential play order (indices into tracks)
  var pos = 0;               // position within `order`
  var player = null, ready = false, playing = false;

  // ---------- Random mode ----------
  // Each "cycle" plays every track once in random order. The next cycle never starts with the
  // track that just played, so the same track never plays twice in a row. Prev walks back
  // through the real play history; Next after Prev walks forward through it again.
  var RANDOM_KEY = "hc-random";
  var randomOn = false;
  try { randomOn = localStorage.getItem(RANDOM_KEY) === "1"; } catch (_) {}
  var hist = [], hpos = -1;  // play history (track indices); hist[hpos] is the current track
  var upcoming = [];         // planned next tracks: [{i: trackIndex, c: cycleNumber}]
  var curCycle = 0;          // cycle the current track belongs to
  var HIST_MAX = 500;
  function rnd() { return Math.random(); }
  function shuffledAll(list, avoidFirst) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; }
    if (a.length > 1 && a[0] === avoidFirst) { var k = 1 + Math.floor(rnd() * (a.length - 1)); var y = a[0]; a[0] = a[k]; a[k] = y; }
    return a;
  }
  function isRandom() { return randomOn && MODE === "videos" && tracks.length > 0; }
  // Keep one full future cycle queued after the current one, so "Up next" shows the real order.
  function refill() {
    var all = tracks.map(function (_, i) { return i; });
    while (!upcoming.some(function (e) { return e.c > curCycle; })) {
      var last = upcoming.length ? upcoming[upcoming.length - 1] : { i: hist[hpos], c: curCycle };
      shuffledAll(all, last.i).forEach(function (i) { upcoming.push({ i: i, c: last.c + 1 }); });
    }
  }
  function startRandom(fromIdx) {
    curCycle = 0; hist = [fromIdx]; hpos = 0;
    var rest = tracks.map(function (_, i) { return i; }).filter(function (i) { return i !== fromIdx; });
    upcoming = shuffledAll(rest).map(function (i) { return { i: i, c: 0 }; });
    refill();
  }
  function pushHist(i) {
    hist = hist.slice(0, hpos + 1); hist.push(i);
    if (hist.length > HIST_MAX) hist.shift();
    hpos = hist.length - 1;
  }
  // Play a track chosen by the user (queue or artist click) while in random mode: it counts as
  // played in the current cycle; the rest of the cycle keeps its order; the next cycle is redrawn.
  function randomJumpTo(i) {
    pushHist(i);
    upcoming = upcoming.filter(function (e) { return e.c === curCycle && e.i !== i; });
    refill();
  }
  function curIdx() { return isRandom() ? hist[hpos] : order[pos]; }

  function current() { return tracks[curIdx()]; }
  function thumbUrl(id) { return "https://i.ytimg.com/vi/" + encodeURIComponent(id) + "/mqdefault.jpg"; }
  function fmt(s) { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
  function text(node, s) { node.textContent = s; }

  // ---------- Station branding ----------
  function renderStation() {
    var st = CFG.station || {};
    var name = st.name || "Web Radio";
    document.title = name;
    text($("station-name"), name);
    document.querySelectorAll(".station-name-ref").forEach(function (n) { text(n, name); });
    text($("station-tagline"), st.tagline || "");
    var logo = $("station-logo");
    if (st.logoImage) {
      logo.textContent = "";
      var img = document.createElement("img"); img.src = st.logoImage; img.alt = "";
      logo.appendChild(img);
    } else {
      text(logo, st.logoText || name.slice(0, 3).toUpperCase());
    }
    text($("year"), new Date().getFullYear());
    el.about.textContent = "";
    (CFG.about || []).forEach(function (p) {
      var para = document.createElement("p"); para.textContent = p; el.about.appendChild(para);
    });
  }

  // ---------- Rendering ----------
  function renderNowPlaying() {
    var t = current();
    if (!t) { text(el.title, MODE === "playlist" ? "Loading playlist…" : "No tracks configured"); return; }
    text(el.title, t.title || "Loading title…");
    text(el.channel, t.channel || "");
    if (t.channelUrl) el.channel.href = t.channelUrl; else el.channel.removeAttribute("href");
    el.thumb.src = thumbUrl(t.id);
    if (t.title) document.title = t.title + " · " + ((CFG.station || {}).name || "Web Radio");
  }

  function renderQueue() {
    el.queue.textContent = "";
    el.queue.scrollTop = 0; // current track is always first
    var qc = document.getElementById("queue-count");
    if (qc) qc.textContent = tracks.length > 1 ? tracks.length + " tracks" + (isRandom() ? " · random" : "") : "";
    if (!tracks.length) {
      var li0 = document.createElement("li"); li0.className = "queue-empty";
      li0.textContent = MODE === "playlist" ? "Loading playlist…" : "No tracks in playlist.js yet.";
      el.queue.appendChild(li0); return;
    }
    // Show the current track first, then what's actually up next.
    // Sequential: the list order (wrapping if looping). Random: forward history, then the planned cycles.
    var n = order.length;
    var MAX_SHOWN = 50; // keep long YouTube playlists readable
    var rows = [];      // [{i: trackIndex, q: click target}]
    if (isRandom()) {
      rows.push({ i: hist[hpos], q: "cur" });
      for (var h = hpos + 1; h < hist.length; h++) rows.push({ i: hist[h], q: "h" + h });
      upcoming.forEach(function (e, j) { rows.push({ i: e.i, q: "u" + j, cycleStart: j > 0 && e.c !== upcoming[j - 1].c }); });
    } else {
      for (var k0 = 0; k0 < n; k0++) {
        if (!LOOP && pos + k0 >= n) break;
        var p0 = (pos + k0) % n;
        rows.push({ i: order[p0], q: "p" + p0 });
      }
    }
    for (var k = 0; k < Math.min(rows.length, MAX_SHOWN); k++) {
      var row = rows[k];
      var t = tracks[row.i];
      var li = document.createElement("li");
      if (k === 0) li.className = "current";
      if (selectedArtist && artistsOf(t.id).indexOf(selectedArtist) !== -1) li.classList.add("artist-match");
      if (row.cycleStart) li.classList.add("cycle-start");
      var b = document.createElement("button"); b.type = "button"; b.dataset.q = row.q; b.dataset.id = t.id;
      b.setAttribute("aria-label", "Play " + (t.title || t.id));
      var num = document.createElement("span"); num.className = "q-num"; num.textContent = k === 0 ? "▶" : String(k);
      var img = document.createElement("img"); img.src = thumbUrl(t.id); img.alt = ""; img.loading = "lazy";
      var tx = document.createElement("span"); tx.className = "q-text";
      var ti = document.createElement("span"); ti.className = "q-title"; ti.textContent = t.title || ("Track " + (row.i + 1));
      var su = document.createElement("span"); su.className = "q-sub";
      su.textContent = k === 0 ? "Now playing" + (t.channel ? " · " + t.channel : "")
                               : (t.channel || "") + (n === 1 ? "" : "");
      tx.appendChild(ti); tx.appendChild(su);
      b.appendChild(num); b.appendChild(img); b.appendChild(tx); li.appendChild(b);
      el.queue.appendChild(li);
    }
    if (n === 1 && LOOP) {
      var li1 = document.createElement("li"); li1.className = "queue-empty";
      li1.textContent = "Single-track station: this track loops.";
      el.queue.appendChild(li1);
    }
  }

  function noteFor(t) { return (t && (t.notes || (CFG.playlistNotes || {})[t.id])) || ""; }
  function artistsOf(id) { return (TRACK_ARTISTS[id] || []).filter(function (s) { return ARTISTS[s]; }); }
  function artistNames(id) { return artistsOf(id).map(function (s) { return ARTISTS[s].name; }); }

  // The current track's note, shown directly under the player.
  function renderNowNote() {
    if (!el.nowNote) return;
    var t = current();
    var names = t ? artistNames(t.id) : [];
    text(el.nowArtists, names.length ? (names.length > 1 ? "Artists: " : "Artist: ") + names.join(", ") : "");
    el.nowArtists.hidden = !names.length;
    text(el.nowNote, t ? (noteFor(t) || "Notes for this track are coming soon.") : "");
  }

  // ---------- Artists panel ----------
  // Tracks per artist, in station order (indices into tracks).
  function artistTrackIdx(slug) {
    var out = [];
    tracks.forEach(function (t, i) { if (artistsOf(t.id).indexOf(slug) !== -1) out.push(i); });
    return out;
  }
  function sortKey(name) { return name.replace(/^the\s+/i, "").toLowerCase(); }
  function sortedArtistSlugs() {
    var slugs = Object.keys(ARTISTS).filter(function (s) { return artistTrackIdx(s).length; });
    slugs.sort(function (a, b) {
      var d = artistTrackIdx(b).length - artistTrackIdx(a).length;
      if (d) return d;
      return sortKey(ARTISTS[a].name) < sortKey(ARTISTS[b].name) ? -1 : 1;
    });
    return slugs;
  }
  function countLabel(n) { return n + (n === 1 ? " track" : " tracks"); }
  var openArtist = null; // slug whose bio is expanded (accordion: one at a time)
  function buildArtists() {
    if (!el.artistList) return;
    el.artistList.textContent = "";
    var slugs = sortedArtistSlugs();
    text(el.artistsCount, slugs.length ? String(slugs.length) : "");
    if (!slugs.length) { el.artistCol.hidden = true; return; }
    slugs.forEach(function (slug) {
      var a = ARTISTS[slug], n = artistTrackIdx(slug).length;
      var li = document.createElement("li"); li.className = "artist-item"; li.dataset.artist = slug;
      var b = document.createElement("button"); b.type = "button"; b.className = "artist"; b.dataset.toggle = slug;
      b.id = "artist-btn-" + slug;
      b.setAttribute("aria-expanded", "false"); b.setAttribute("aria-controls", "artist-detail-" + slug);
      b.setAttribute("aria-label", a.name + ", " + countLabel(n) + ". Show bio");
      var nm = document.createElement("span"); nm.className = "artist-name"; nm.textContent = a.name;
      var ct = document.createElement("span"); ct.className = "artist-count"; ct.textContent = "· " + n;
      ct.setAttribute("aria-hidden", "true");
      b.appendChild(nm); b.appendChild(ct);
      var d = document.createElement("div"); d.className = "artist-detail"; d.id = "artist-detail-" + slug; d.hidden = true;
      d.setAttribute("role", "region"); d.setAttribute("aria-labelledby", b.id);
      var bio = document.createElement("p"); bio.className = "artist-bio"; bio.textContent = a.bio || "";
      var acts = document.createElement("div"); acts.className = "artist-actions";
      var play = document.createElement("button"); play.type = "button"; play.className = "artist-act"; play.dataset.play = slug;
      play.textContent = "▶ Play"; play.setAttribute("aria-label", "Play " + a.name + (n > 1 ? " (next of " + n + " tracks)" : ""));
      var hl = document.createElement("button"); hl.type = "button"; hl.className = "artist-act"; hl.dataset.highlight = slug;
      hl.textContent = "Highlight tracks"; hl.setAttribute("aria-pressed", "false");
      acts.appendChild(play); acts.appendChild(hl);
      d.appendChild(bio); d.appendChild(acts);
      li.appendChild(b); li.appendChild(d); el.artistList.appendChild(li);
    });
  }
  function toggleArtist(slug) {
    openArtist = openArtist === slug ? null : slug;
    el.artistList.querySelectorAll("li.artist-item").forEach(function (li) {
      var s = li.dataset.artist, on = s === openArtist;
      li.classList.toggle("open", on);
      li.querySelector("button.artist").setAttribute("aria-expanded", String(on));
      li.querySelector(".artist-detail").hidden = !on;
    });
  }
  function renderArtists() {
    if (el.artistList) {
      var t = current(), live = t ? artistsOf(t.id) : [];
      el.artistList.querySelectorAll("li.artist-item").forEach(function (li) {
        var s = li.dataset.artist;
        li.classList.toggle("now-on", live.indexOf(s) !== -1);
        li.classList.toggle("selected", s === selectedArtist);
        var hl = li.querySelector("button[data-highlight]");
        hl.setAttribute("aria-pressed", String(s === selectedArtist));
        hl.textContent = s === selectedArtist ? "Highlighting" : "Highlight tracks";
      });
      el.artistsClear.hidden = !selectedArtist;
    }
    renderNowArtists();
  }
  // Sidebar card: every artist on the current track, with count and full bio.
  function renderNowArtists() {
    if (!el.nowArtistsList) return;
    var t = current(), slugs = t ? artistsOf(t.id) : [];
    el.nowArtistsCard.hidden = !slugs.length;
    el.nowArtistsList.textContent = "";
    slugs.forEach(function (slug, k) {
      var a = ARTISTS[slug], n = artistTrackIdx(slug).length;
      var art = document.createElement("article"); art.className = "na-item";
      var h = document.createElement("h3"); h.className = "na-name"; h.textContent = a.name;
      var meta = document.createElement("span"); meta.className = "na-meta";
      meta.textContent = (k === 0 ? "Main artist" : "Featured") + " · " + countLabel(n);
      var p = document.createElement("p"); p.className = "na-bio"; p.textContent = a.bio || "";
      art.appendChild(h); art.appendChild(meta); art.appendChild(p); el.nowArtistsList.appendChild(art);
    });
  }
  function highlightArtist(slug) {
    selectedArtist = selectedArtist === slug ? null : slug;
    renderQueue(); renderArtists();
  }
  // Play an artist: highlight their tracks and play their next upcoming one.
  function playArtist(slug) {
    var idx = artistTrackIdx(slug);
    if (!idx.length) return;
    selectedArtist = slug;
    var cur = curIdx(), curIsTheirs = idx.indexOf(cur) !== -1;
    if (isRandom()) {
      var e = upcoming.filter(function (x) { return idx.indexOf(x.i) !== -1 && x.i !== cur; })[0];
      if (!e) { renderAll(); return; }
      randomJumpTo(e.i); loadCurrent(); return;
    }
    var n = order.length, target = null;
    for (var k = curIsTheirs ? 1 : 0; k <= n; k++) {
      var p = (pos + k) % n;
      if (idx.indexOf(order[p]) !== -1) { target = p; break; }
    }
    if (target === null || (target === pos && curIsTheirs)) { renderAll(); return; }
    playAt(target);
  }
  // Wide screens: artists in the left column, always open. Narrower: collapsible, below the player.
  var wideMq = window.matchMedia ? window.matchMedia("(min-width: 1200px)") : null;
  var userOpened = false;
  function placeArtists() {
    if (!el.artistsPanel) return;
    var wide = wideMq ? wideMq.matches : true;
    var home = wide ? el.artistCol : el.artistsSlot;
    if (el.artistsPanel.parentNode !== home) home.appendChild(el.artistsPanel);
    el.artistCol.classList.toggle("is-empty", !wide);
    el.artistsPanel.open = wide ? true : userOpened;
    placeNowArtists();
  }
  // The "On this track" card lives in the right sidebar when there is one (>= 1000px);
  // on single-column layouts it sits right under the track note.
  var sideMq = window.matchMedia ? window.matchMedia("(min-width: 1000px)") : null;
  function placeNowArtists() {
    if (!el.nowArtistsCard) return;
    var side = sideMq ? sideMq.matches : true;
    if (side) {
      var ad = el.sideCol.querySelector(".ad-slot");
      if (el.nowArtistsCard.previousElementSibling !== ad) ad.insertAdjacentElement("afterend", el.nowArtistsCard);
    } else if (el.nowArtistsCard.parentNode !== el.nowArtistsSlot) {
      el.nowArtistsSlot.appendChild(el.nowArtistsCard);
    }
  }

  function renderNotes() {
    el.notes.textContent = "";
    var list = MODE === "videos" ? tracks : tracks.filter(function (t) { return (CFG.playlistNotes || {})[t.id]; });
    if (!list.length) { var p0 = document.createElement("p"); p0.textContent = "Track notes coming soon."; el.notes.appendChild(p0); return; }
    var cur = current();
    list.forEach(function (t) {
      var a = document.createElement("article");
      if (cur && cur.id === t.id) a.className = "current";
      var h = document.createElement("h3"); h.textContent = (t.title || t.id) + (t.channel ? " — " + t.channel : "");
      var p = document.createElement("p"); p.textContent = t.notes || (CFG.playlistNotes || {})[t.id] || "Notes coming soon.";
      a.appendChild(h); a.appendChild(p); el.notes.appendChild(a);
    });
    if (el.notesCount) text(el.notesCount, list.length > 1 ? String(list.length) : "");
  }

  // Publish state for optional add-ons (ratings.js): current video ID + queue IDs.
  function notify() {
    var t = current();
    window.RadioState = { current: t ? t.id : null, ids: tracks.map(function (x) { return x.id; }) };
    try { document.dispatchEvent(new CustomEvent("radio:tracks", { detail: window.RadioState })); } catch (_) {}
  }

  function renderAll() { renderNowPlaying(); renderNowNote(); renderQueue(); renderNotes(); renderArtists(); notify(); }

  function setPlaying(on) {
    playing = on;
    el.play.classList.toggle("playing", on);
    el.play.setAttribute("aria-label", on ? "Pause" : "Play");
    el.play.title = on ? "Pause" : "Play";
    el.onAir.classList.toggle("live", on);
    text(el.onAirLabel, on ? "On air" : "Paused");
  }

  // ---------- Playback (videos mode manages its own queue) ----------
  function loadCurrent(autoplay) {
    renderAll();
    if (!ready || !current()) return;
    var id = current().id;
    if (autoplay === false) player.cueVideoById(id); else player.loadVideoById(id);
  }
  function playAt(p, autoplay) {
    if (!tracks.length) return;
    if (isRandom()) { randomJumpTo(order[(p + order.length) % order.length]); loadCurrent(autoplay); return; }
    pos = (p + order.length) % order.length;
    if (MODE === "playlist") { renderAll(); if (ready) player.playVideoAt(order[pos]); return; }
    loadCurrent(autoplay);
  }

  function next() {
    if (MODE === "playlist") { if (ready) player.nextVideo(); return; }
    if (!tracks.length) return;
    if (isRandom()) {
      if (hpos < hist.length - 1) { hpos++; }          // walking forward again after Prev
      else {
        refill();
        var e = upcoming.shift();
        curCycle = e.c; pushHist(e.i);
        refill();
      }
      loadCurrent(); return;
    }
    if (pos + 1 >= order.length && !LOOP) { if (ready) player.stopVideo(); return; }
    playAt(pos + 1);
  }
  function prev() {
    if (MODE === "playlist") { if (ready) player.previousVideo(); return; }
    // Like most players: restart the track if we're more than 3s in.
    if (ready && player.getCurrentTime && player.getCurrentTime() > 3) { player.seekTo(0, true); return; }
    if (isRandom()) {
      if (hpos > 0) { hpos--; loadCurrent(); } else if (ready) player.seekTo(0, true);
      return;
    }
    playAt(pos - 1);
  }
  function renderRandomBtn() {
    el.random.setAttribute("aria-pressed", String(randomOn));
    text(el.randomState, randomOn ? "On" : "Off");
    el.random.setAttribute("aria-label", "Random playback " + (randomOn ? "on" : "off"));
  }
  function toggleRandom() {
    var cur = curIdx();
    randomOn = !randomOn;
    try { localStorage.setItem(RANDOM_KEY, randomOn ? "1" : "0"); } catch (_) {}
    renderRandomBtn();
    if (MODE === "playlist") { if (ready) player.setShuffle(randomOn); syncPlaylist(); return; }
    if (randomOn) startRandom(cur); else pos = cur; // back to list order from the current track
    renderQueue(); notify();
  }
  function togglePlay() {
    if (!ready) return;
    if (playing) player.pauseVideo(); else player.playVideo();
  }

  // ---------- Playlist mode: mirror the YouTube playlist into our UI ----------
  function syncPlaylist() {
    if (MODE !== "playlist" || !ready) return;
    var ids = player.getPlaylist() || [];
    if (!ids.length) return;
    var known = {}; tracks.forEach(function (t) { known[t.id] = t; });
    tracks = ids.map(function (id) {
      var m = META[id] || {};
      return known[id] || { id: id, title: m.title || "", channel: m.channel || "", channelUrl: m.channelUrl || "",
                            notes: (CFG.playlistNotes || {})[id] || "" };
    });
    order = tracks.map(function (_, i) { return i; });
    var idx = player.getPlaylistIndex();
    pos = idx >= 0 ? idx : 0;
    buildArtists();
    renderAll();
  }

  // Fill in title/channel from the player when config + oEmbed didn't provide them.
  function absorbVideoData() {
    if (!ready || !player.getVideoData) return;
    var d = player.getVideoData() || {};
    if (!d.video_id) return;
    var t = tracks.filter(function (x) { return x.id === d.video_id; })[0];
    if (!t) return;
    var changed = false;
    if (!t.title && d.title) { t.title = d.title; changed = true; }
    if (!t.channel && d.author) { t.channel = d.author; changed = true; }
    if (changed) renderAll();
  }

  // ---------- YouTube IFrame API ----------
  function onReady() {
    ready = true;
    el.fallback.hidden = true;
    var saved = null; try { saved = localStorage.getItem("wr-volume"); } catch (_) {}
    var v = parseInt(saved || el.volume.value, 10);
    el.volume.value = v; player.setVolume(v);
    if (MODE === "playlist") {
      player.loadPlaylist({ list: SRC.playlistId, listType: "playlist", index: 0 });
      player.setLoop(LOOP);
      if (randomOn) player.setShuffle(true);
    } else if (tracks.length) {
      player.cueVideoById(current().id); // browsers block unmuted autoplay; user presses play
    }
  }

  function onStateChange(e) {
    var S = YT.PlayerState;
    if (e.data === S.PLAYING) { setPlaying(true); absorbVideoData(); }
    else if (e.data === S.PAUSED || e.data === S.CUED) { setPlaying(false); absorbVideoData(); }
    if (MODE === "playlist" && (e.data === S.PLAYING || e.data === S.CUED || e.data === S.BUFFERING)) syncPlaylist();
    if (e.data === S.ENDED) {
      setPlaying(false);
      if (MODE === "videos") next(); // auto-advance (loops a single-track station)
    }
  }

  function onError(e) {
    // 2 bad ID, 5 HTML5 error, 100 not found/private, 101/150 embedding disabled by owner.
    console.warn("YouTube player error", e.data, current() && current().id);
    var t = current();
    if (t && !t.title) { t.title = "Unavailable video (" + t.id + ")"; renderNowPlaying(); }
    if (tracks.length > 1) setTimeout(next, 1500);
  }

  window.onYouTubeIframeAPIReady = function () {
    var vars = { playsinline: 1, rel: 0, modestbranding: 1 };
    if (/^https?:/.test(location.protocol)) vars.origin = location.origin;
    if (MODE === "playlist") { vars.listType = "playlist"; vars.list = SRC.playlistId; }
    var opts = {
      width: "100%", height: "100%", playerVars: vars,
      events: { onReady: onReady, onStateChange: onStateChange, onError: onError },
    };
    if (MODE === "videos" && tracks.length) opts.videoId = current().id;
    if (CFG.privacyEnhancedMode) opts.host = "https://www.youtube-nocookie.com";
    player = new YT.Player("yt-player", opts);
  };

  function loadApi() {
    var s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = function () { el.fallback.hidden = false; text(el.fallback, "Couldn't reach YouTube. Check your connection or content blocker."); };
    document.head.appendChild(s);
    setTimeout(function () { if (!ready) el.fallback.hidden = false; }, 8000);
  }

  // ---------- Progress ----------
  setInterval(function () {
    if (!ready || !player.getDuration) return;
    var d = player.getDuration() || 0, c = player.getCurrentTime() || 0;
    el.bar.style.width = d ? (100 * c / d).toFixed(2) + "%" : "0";
    text(el.cur, fmt(c)); text(el.dur, fmt(d));
  }, 500);

  // ---------- Wire up UI ----------
  el.play.addEventListener("click", togglePlay);
  el.next.addEventListener("click", next);
  el.prev.addEventListener("click", prev);
  el.random.addEventListener("click", toggleRandom);
  el.volume.addEventListener("input", function () {
    var v = parseInt(el.volume.value, 10);
    try { localStorage.setItem("wr-volume", v); } catch (_) {}
    if (!ready) return;
    player.setVolume(v);
    if (v > 0 && player.isMuted()) player.unMute();
  });
  el.queue.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-q]");
    if (!b) return;
    var q = b.dataset.q, kind = q.charAt(0), num = parseInt(q.slice(1), 10);
    if (q === "cur") { loadCurrent(); return; }
    if (kind === "h") { hpos = num; loadCurrent(); return; }                  // forward history (random)
    if (kind === "u") { var e2 = upcoming[num]; if (e2) { randomJumpTo(e2.i); loadCurrent(); } return; } // planned (random)
    if (kind === "p") playAt(num);                                            // list order
  });
  if (el.artistList) {
    el.artistList.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.toggle) toggleArtist(b.dataset.toggle);
      else if (b.dataset.play) playArtist(b.dataset.play);
      else if (b.dataset.highlight) highlightArtist(b.dataset.highlight);
    });
    el.artistsClear.addEventListener("click", function () { selectedArtist = null; renderQueue(); renderArtists(); });
    el.artistsPanel.addEventListener("toggle", function () {
      if (!(wideMq && wideMq.matches)) userOpened = el.artistsPanel.open;
      else if (!el.artistsPanel.open) el.artistsPanel.open = true; // stays open in the left column
    });
    [wideMq, sideMq].forEach(function (mq) {
      if (mq) (mq.addEventListener ? mq.addEventListener("change", placeArtists) : mq.addListener(placeArtists));
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.target.matches("input, textarea") || e.metaKey || e.ctrlKey) return;
    if (e.key === " " && e.target === document.body) { e.preventDefault(); togglePlay(); }
    else if (e.key === "n") next();
    else if (e.key === "p") prev();
    else if (e.key === "r" && !e.target.closest("button, a, summary")) toggleRandom();
  });

  renderStation();
  buildArtists();
  placeArtists();
  renderRandomBtn();
  // Random start: with random on, the station starts on a random track.
  if (isRandom()) startRandom(Math.floor(rnd() * tracks.length));
  setPlaying(false); text(el.onAirLabel, "Off air");
  renderAll();
  loadApi();
})();
