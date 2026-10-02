# Hardcore: web radio (prototype)

Live: https://blakelapierre.github.io/hardcore-radio/

A static "web radio" site that plays YouTube videos through the **official YouTube IFrame Player API**, with display-ad placeholders placed around the player.

```
index.html        page layout: player, Now Playing, controls, queue, notes, about, ad slots
styles.css        dark theme + responsive layout (desktop / tablet / mobile)
app.js            player logic (IFrame API, queue, shuffle, auto-advance, volume)
playlist.js       ← STATION CONFIG: name, tagline, tracks/playlist, track notes, about text
track-meta.js     generated titles/channels (from YouTube oEmbed), see below
tools/fetch_titles.py   build step that regenerates track-meta.js
privacy.html      privacy policy placeholder (cookies, Google ads, YouTube embeds)
ads.txt           ads.txt placeholder
favicon.svg
screenshots/      test screenshots
```

## Run locally
```bash
cd /workspace/web-radio
python3 -m http.server 8080   # then open http://localhost:8080
```
Serve it over http(s), not `file://`. The IFrame API needs a real origin.

## Change the playlist
Edit `playlist.js`:

- **List of video IDs** (default): set `source.type: "videos"` and put one entry per track in `tracks`:
  ```js
  tracks: [
    { id: "dnhqZcG0tew", notes: "Why this track is on the station…" },
    { id: "XXXXXXXXXXX", title: "Optional override", channel: "Optional", notes: "…" },
  ]
  ```
  You control the order, and every track gets its own note.
- **A regular YouTube playlist**: set `source.type: "playlist"` and `source.playlistId: "PL…"`. The player loads it with `loadPlaylist({ listType: "playlist", list })`, and the queue mirrors `player.getPlaylist()`. You can add notes per video in `playlistNotes`.
  Don't use auto-generated Mix lists (`RD…`). They change from viewer to viewer and can't be relied on.
- `source.loop` (default `true`) loops the station. With one track, that track repeats.

After you change the track IDs, refresh the titles:
```bash
python3 tools/fetch_titles.py     # writes track-meta.js via https://www.youtube.com/oembed
```
If this step is skipped or fails, the site reads the title and channel from `player.getVideoData()` at runtime. Videos whose owners disabled embedding (errors 101/150) are skipped automatically when more than one track is configured.

## Change the station name / logo
In `playlist.js` → `station`: `name`, `tagline`, `logoText` (badge letters), or `logoImage` (e.g. `assets/logo.png`). The `about` array holds the About-the-station paragraphs. The current tagline and About text are placeholders marked `EDITABLE`. The page `<title>` and the static header text in `index.html`/`privacy.html` also say "Hardcore", and so do the footer and the logo initials ("HC"). Update those too, for SEO and for visitors without JS.

Set `privacyEnhancedMode: true` to embed from `youtube-nocookie.com`.

## Ad slots
Each slot in `index.html` is a `<div class="ad-slot …">` placeholder holding a commented AdSense `<ins>` template:

| Location | Desktop | Mobile (≤760px) |
|---|---|---|
| Top leaderboard | 728×90 | 320×50 |
| Sidebar | 300×250 | 300×250 (stacks below the content) |
| Below the queue | 728×90 | 300×250 |

To go live after AdSense approval:
1. Uncomment the `adsbygoogle.js` script in `<head>` and replace `ca-pub-XXXXXXXXXXXXXXXX`.
2. In each slot, uncomment the `<ins>` block, set your publisher ID and `data-ad-slot` IDs, and remove the `<span class="ad-label">` placeholder text. You can keep a small "Advertisement" label if you like.
3. Put your real line in `ads.txt` (see the comment in that file).
4. Fill in `privacy.html` (date and contact). Use a Google-certified CMP for EEA/UK visitors.

**Rules to keep (YouTube ToS):** ads go *around* the player, never on top of it. Don't hide, shrink below 200×200, overlay, or audio-only the player, and don't block or skip YouTube's own ads. The player area is a 16:9 box with nothing positioned over it.

**AdSense approval tip:** sites made mostly of embeds tend to be rejected. Write real track notes and About text, and add more original pages (show notes, blog, artist features) before you apply.

## Deploy
It's plain static files with no build step (apart from the optional `fetch_titles.py`).
- **GitHub Pages (current host):** repo `blakelapierre/hardcore-radio`, Pages builds from branch `main`, folder `/` (root). To update the site, commit and `git push origin main`, and Pages redeploys within a minute or two. Because this is a project site, it lives at `/hardcore-radio/`, so `ads.txt` is NOT at the domain root there. AdSense needs `https://yourdomain/ads.txt`, so add a custom domain (Settings → Pages → Custom domain, plus a `CNAME` file) before you apply. A `.nojekyll` file is included so files are served as-is.
- **Netlify / Cloudflare Pages:** drag and drop the folder, or connect the repo with no build command and the output dir set to `/` (root). You can add `python3 tools/fetch_titles.py` as the build command to refresh titles on every deploy.
- Use HTTPS and a custom domain. AdSense needs a domain you own, and `ads.txt` has to be at `https://yourdomain/ads.txt`.
