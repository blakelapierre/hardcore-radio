# Hardcore: web radio (prototype)

Live: https://hardcoreradio.website/ (custom domain via `CNAME`; also reachable at https://blakelapierre.github.io/hardcore-radio/)

A static "web radio" site that plays YouTube videos through the **official YouTube IFrame Player API**, with display-ad placeholders placed around the player.

```
index.html        page layout: player, Now Playing, controls, queue, notes, about, ad slots
styles.css        dark theme + responsive layout (desktop / tablet / mobile)
app.js            player logic (IFrame API, queue, shuffle, auto-advance, volume)
ratings.js        thumbs up/down ratings (Firebase, loaded only when configured)
firebase-config.js  ← paste your Firebase web config here (placeholders = ratings hidden)
firestore.rules   Firestore security rules for ratings
firebase.json     Firebase CLI config (rules deploy + local emulators)
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
- `source.loop` (default `true`) starts the list again after the last track, so the station plays nonstop. Set it to `false` to stop after the last track. Tracks auto-advance either way.

After you change the track IDs, refresh the titles:
```bash
python3 tools/fetch_titles.py     # writes track-meta.js via https://www.youtube.com/oembed
```
If this step is skipped or fails, the site reads the title and channel from `player.getVideoData()` at runtime. Videos whose owners disabled embedding (errors 101/150) are skipped automatically when more than one track is configured.

## Change the station name / logo
In `playlist.js` → `station`: `name`, `tagline`, `logoText` (badge letters), or `logoImage` (e.g. `assets/logo.png`). The `about` array holds the About-the-station paragraphs. The current tagline and About text are placeholders marked `EDITABLE`. The page `<title>` and the static header text in `index.html`/`privacy.html` also say "Hardcore", and so do the footer and the logo initials ("HC"). Update those too, for SEO and for visitors without JS.

Set `privacyEnhancedMode: true` to embed from `youtube-nocookie.com`.

## Track ratings (Firebase)
Visitors can give each track a thumbs up or down. The Now Playing panel shows the up/down counts and "% liked · N votes", and the queue shows a 👍 % badge for each rated track. Clicking your current vote again removes it.

How it works: `ratings.js` loads the Firebase modular SDK (v12.19.0) from `www.gstatic.com`. There's no build step. The visitor is signed in with **Anonymous Auth** the first time they vote. Votes are stored at `tracks/{videoId}/votes/{uid}` as `{ value: 1 | -1, updatedAt }`, and each vote change runs in a transaction that also updates the counter doc `tracks/{videoId}` `{ up, down }`. `firestore.rules` allows public reads. It only allows a signed-in user to write **their own** vote doc, with value 1 or -1, and only if the counters change by exactly that vote in the same write. Nobody can set counters directly or delete them.
While `firebase-config.js` still holds the `YOUR_…` placeholders, the rating UI stays hidden, the SDK is never downloaded, and nothing is logged.
Limitation: with anonymous auth, "one vote per visitor" really means one vote per browser. Someone who clears their storage or uses a private window gets a new ID. For stronger protection, add Firebase App Check (reCAPTCHA Enterprise) later.

### Steps for Blake (about 10 minutes)
1. **Create a project:** go to https://console.firebase.google.com and click **Create a project** (e.g. `hardcore-radio`). Google Analytics is optional; you can turn it off.
2. **Add a web app:** Project Overview → **Add app** → **Web** (`</>`). Use the nickname `hardcore-radio-web` and do **not** tick Firebase Hosting. Click **Register app**.
3. **Paste the config:** copy the `firebaseConfig` values it shows (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`) into `firebase-config.js`, replacing the `YOUR_…` placeholders. These values are not secret; the security rules protect the data. (You can find them again later under Project settings ⚙ → General → Your apps.)
4. **Enable Anonymous auth:** Build → **Authentication** → **Get started** → **Sign-in method** tab → **Anonymous** → Enable → Save.
5. **Create Firestore:** Build → **Firestore Database** → **Create database** → Standard edition, location e.g. `nam5 (United States)` (this can't be changed later) → **Start in production mode** → Create.
6. **Publish the rules:** Firestore Database → **Rules** tab → replace everything with the contents of `firestore.rules` → **Publish**.
   Or use the CLI: `npx firebase-tools login`, then `npx firebase-tools deploy --only firestore:rules --project <your-project-id>` from this folder.
7. **Add authorized domains:** Authentication → **Settings** tab → **Authorized domains** → **Add domain** → add `hardcoreradio.website` and `blakelapierre.github.io`. (`localhost` is there by default.)
8. **Optional (recommended): restrict the API key.** Google Cloud console → APIs & Services → Credentials → open the "Browser key (auto created by Firebase)" → Application restrictions: **Websites** → add `https://hardcoreradio.website/*`, `https://blakelapierre.github.io/*`, `http://localhost:8080/*`.
9. Commit and push `firebase-config.js`. Within a minute or two GitHub Pages redeploys and the thumbs appear under Now Playing.

### Testing locally with the emulator
Requires Java 21+.
```bash
npx firebase-tools emulators:start --only auth,firestore --project demo-hardcore   # uses firestore.rules
python3 -m http.server 8080
# open http://localhost:8080/?emulator=1   (?emulator=1 only works on localhost; it uses a demo project)
```

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

## Track note sources
The notes in `playlist.js` are original paraphrase. They quote at most a few words of lyrics, and the political themes are described as the artists' message, not as the station's claims.
- **The Seventh Seal (Steve Grant):** SkyMinds, "Steve Grant – The Seventh Seal" (credits, and filming at the Million Mask March outside the White House on 5 Nov 2013): https://www.skyminds.net/steve-grant-seventh-seal/ · Wikipedia, "Million Mask March": https://en.wikipedia.org/wiki/Million_Mask_March · the video itself (lyrics and themes).
- **The 2nd Ammendment (Poison Pen feat. Immortal Technique):** the YouTube "Provided to YouTube by K7 Records" description (The Money Shot, ℗ 2009 Gold Dust Media, writers L. Herron / F. Coronel / T. Underdue) · AllMusic Poison Pen bio and The Money Shot credits: https://www.allmusic.com/artist/poison-pen-mn0000355277 · Artisan News (2007, Stronghold and Bed-Stuy): https://artisannewsservice.com/poison-pen-set-to-release-debut/ · OneTwoOneTwo (2007 press bio): https://www.onetwoonetwo.com/immortal-technique-presentspoison-pen-pick-your-poison/ · Genius lyrics: https://genius.com/Poison-pen-2nd-amendment-lyrics · Wikipedia, "Immortal Technique" · album reviews: RapManiacZ and Lyrics First (2009).
- **For The Love Of Money and Talk About It (Dr. Dre, *Compton*):**
  - The YouTube "Provided to YouTube by Universal Music Group" description (℗ 2015 Aftermath/Interscope, producer Cardiak, writer credits).
  - The lyric video text on DrDreVEVO, used for screening.
  - Genius pages for "For the Love of Money" (lyrics, samples, credits): https://genius.com/Dr-dre-for-the-love-of-money-lyrics
  - Wikipedia, "Compton (album)": release dates, origin in the Straight Outta Compton film, debut at No. 2 with 295,000 units.
- **Raps Of The Titans (The Goondox):**
  - The Snowgoons YouTube description (guest list, video credits).
  - Reel Wolf Productions video page (group line-up, beat, chorus and title credits): https://www.reelwolf.com/the-goondox-raps-of-the-titans-pmdsean-strangeswollen-memberssnowgoonsjus-allah-more.html
  - AllMusic song credits.
  - Lyrks lyrics page, used for screening (album Welcome to the Goondox, 2012).
- **Annihilation of the Evil Machine (K-Rino):**
  - The TCC YouTube description (fan-made video; track 2, disc 1, 2010).
  - Genius lyrics and credits (producer 5-7 Red, released Aug 23, 2010): https://genius.com/K-rino-annihilation-of-the-evil-machine-lyrics
  - Last.fm bio and album page (29 tracks, about two hours).
  - Apple Music listing (℗ 2010 Black Book International/SoSouth).
  - Murder Dog interview (South Park Coalition history, comic-book plans): https://murderdog.com/k-rino/

**Lyric screening (Oct 2026):** none of the six tracks contains Holocaust denial, antisemitic conspiracy claims or mass-shooting hoax claims. Heads-up for ad suitability: the Dr. Dre and Goondox tracks have heavy profanity, and "Raps Of The Titans" includes homophobic and ableist slurs in some guest verses. Google can limit or block ads on pages with that kind of content.
