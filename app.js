/* Hardcore (web radio) — player logic.
 * Uses ONLY the official YouTube IFrame Player API. The player stays visible at 16:9;
 * nothing is drawn on top of it, and YouTube's own ads/controls are left untouched.
 */
(function () {
  "use strict";

  var CFG = window.STATION_CONFIG || {};
  var META = window.TRACK_META || {};
  var SRC = CFG.source || { type: "videos" };
  var MODE = SRC.type === "playlist" && SRC.playlistId ? "playlist" : "videos";
  var LOOP = SRC.loop !== false;

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    play: $("btn-play"), next: $("btn-next"), prev: $("btn-prev"), shuffle: $("btn-shuffle"),
    volume: $("volume"), queue: $("queue"), notes: $("track-notes"), about: $("about"),
    title: $("np-title"), channel: $("np-channel"), thumb: $("np-thumb"),
    bar: $("progress-bar"), cur: $("t-cur"), dur: $("t-dur"), onAir: $("on-air"),
    onAirLabel: $("on-air-label"), fallback: $("player-fallback"),
  };

  // ---------- Track model ----------
  // tracks: [{id, title, channel, channelUrl, notes}]
  var tracks = MODE === "videos"
    ? (CFG.tracks || []).filter(function (t) { return t && t.id; }).map(function (t) {
        var m = META[t.id] || {};
        return { id: t.id, title: t.title || m.title || "", channel: t.channel || m.channel || "",
                 channelUrl: t.channelUrl || m.channelUrl || "", notes: t.notes || "" };
      })
    : []; // filled from player.getPlaylist() in playlist mode

  var order = tracks.map(function (_, i) { return i; }); // play order (indices into tracks)
  var pos = 0;               // position within `order`
  var shuffleOn = false;
  var player = null, ready = false, playing = false;

  function current() { return tracks[order[pos]]; }
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
    if (qc) qc.textContent = tracks.length > 1 ? tracks.length + " tracks" + (shuffleOn ? " · shuffled" : "") : "";
    if (!tracks.length) {
      var li0 = document.createElement("li"); li0.className = "queue-empty";
      li0.textContent = MODE === "playlist" ? "Loading playlist…" : "No tracks in playlist.js yet.";
      el.queue.appendChild(li0); return;
    }
    // Show the current track first, then what's up next (wrapping around if looping).
    var n = order.length;
    var MAX_SHOWN = 50; // keep long YouTube playlists readable
    for (var k = 0; k < Math.min(n, MAX_SHOWN); k++) {
      var p = (pos + k) % n;
      if (!LOOP && pos + k >= n) break;
      var t = tracks[order[p]];
      var li = document.createElement("li");
      if (k === 0) li.className = "current";
      var b = document.createElement("button"); b.type = "button"; b.dataset.pos = p; b.dataset.id = t.id;
      b.setAttribute("aria-label", "Play " + (t.title || t.id));
      var num = document.createElement("span"); num.className = "q-num"; num.textContent = k === 0 ? "▶" : String(k);
      var img = document.createElement("img"); img.src = thumbUrl(t.id); img.alt = ""; img.loading = "lazy";
      var tx = document.createElement("span"); tx.className = "q-text";
      var ti = document.createElement("span"); ti.className = "q-title"; ti.textContent = t.title || ("Track " + (order[p] + 1));
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
    // Keep the current track's note in view inside the scrollable notes box.
    var curNote = el.notes.querySelector("article.current");
    if (curNote) el.notes.scrollTop += curNote.getBoundingClientRect().top - el.notes.getBoundingClientRect().top;
  }

  // Publish state for optional add-ons (ratings.js): current video ID + queue IDs.
  function notify() {
    var t = current();
    window.RadioState = { current: t ? t.id : null, ids: tracks.map(function (x) { return x.id; }) };
    try { document.dispatchEvent(new CustomEvent("radio:tracks", { detail: window.RadioState })); } catch (_) {}
  }

  function renderAll() { renderNowPlaying(); renderQueue(); renderNotes(); notify(); }

  function setPlaying(on) {
    playing = on;
    el.play.classList.toggle("playing", on);
    el.play.setAttribute("aria-label", on ? "Pause" : "Play");
    el.play.title = on ? "Pause" : "Play";
    el.onAir.classList.toggle("live", on);
    text(el.onAirLabel, on ? "On air" : "Paused");
  }

  // ---------- Playback (videos mode manages its own queue) ----------
  function playAt(p, autoplay) {
    if (!tracks.length) return;
    pos = (p + order.length) % order.length;
    renderAll();
    if (!ready) return;
    if (MODE === "playlist") { player.playVideoAt(order[pos]); return; }
    var id = current().id;
    if (autoplay === false) player.cueVideoById(id); else player.loadVideoById(id);
  }

  function next() {
    if (MODE === "playlist") { if (ready) player.nextVideo(); return; }
    if (pos + 1 >= order.length && !LOOP) { if (ready) player.stopVideo(); return; }
    playAt(pos + 1);
  }
  function prev() {
    if (MODE === "playlist") { if (ready) player.previousVideo(); return; }
    // Like most players: restart the track if we're more than 3s in.
    if (ready && player.getCurrentTime && player.getCurrentTime() > 3) { player.seekTo(0, true); return; }
    playAt(pos - 1);
  }
  function toggleShuffle() {
    shuffleOn = !shuffleOn;
    el.shuffle.setAttribute("aria-pressed", String(shuffleOn));
    if (MODE === "playlist") { if (ready) player.setShuffle(shuffleOn); syncPlaylist(); return; }
    var curIdx = order[pos];
    var rest = tracks.map(function (_, i) { return i; }).filter(function (i) { return i !== curIdx; });
    if (shuffleOn) for (var i = rest.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = rest[i]; rest[i] = rest[j]; rest[j] = x; }
    order = [curIdx].concat(rest); pos = 0;
    if (!shuffleOn) { order = tracks.map(function (_, i) { return i; }); pos = curIdx; }
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
  el.shuffle.addEventListener("click", toggleShuffle);
  el.volume.addEventListener("input", function () {
    var v = parseInt(el.volume.value, 10);
    try { localStorage.setItem("wr-volume", v); } catch (_) {}
    if (!ready) return;
    player.setVolume(v);
    if (v > 0 && player.isMuted()) player.unMute();
  });
  el.queue.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-pos]");
    if (b) playAt(parseInt(b.dataset.pos, 10));
  });
  document.addEventListener("keydown", function (e) {
    if (e.target.matches("input, textarea") || e.metaKey || e.ctrlKey) return;
    if (e.key === " " && e.target === document.body) { e.preventDefault(); togglePlay(); }
    else if (e.key === "n") next();
    else if (e.key === "p") prev();
  });

  renderStation();
  setPlaying(false); text(el.onAirLabel, "Off air");
  renderAll();
  loadApi();
})();
