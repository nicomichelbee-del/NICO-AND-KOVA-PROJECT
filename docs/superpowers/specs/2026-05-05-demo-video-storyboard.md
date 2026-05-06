# KickrIQ — 40-Second Demo Video Runbook

**Goal:** Polished product film hitting the 9 signature features. Lands on the landing page + YouTube + IG Reels.

**Format:** 40s, 1920×1080, 60fps, no voiceover, royalty-free music, beat-synced cuts, elegant text overlays.

**Vibe:** Chill house / polished SaaS — Linear / Stripe / Apple launch energy. Smooth even groove, no dramatic drop. End card settles in on a satisfying chord at 0:34.

**Music file:** `assets/music/rediskasound-chill-house-background-music-462432.mp3` (2:57 total, 256kbps). You'll trim a 40-second segment from a strong section of the track and fade out cleanly at 0:40.

> **The order of work — do these in this exact order:**
> 1. Pick the music track first. Everything cuts to it.
> 2. Set up seed data + clean test athlete account.
> 3. Record beats 2–9 in OBS, one at a time.
> 4. Drop into CapCut, line up to the beat, add text overlays, export.

---

## Beat-by-beat shot list (40s)

| # | Time | Feature | What you record | On-screen text |
|---|------|---------|-----------------|----------------|
| 1 | 0:00–0:02 | **Cold open** | Black screen → KickrIQ logo punch-in (use logo asset) | `your shot at college soccer` |
| 2 | 0:02–0:06 | **Position picker** | Drag the player marker across the pitch — fast confident motion | `drag your position` |
| 3 | 0:06–0:11 | **Schools matcher** | Schools page loads, Reach/Target/Safety cards stagger in | `matched to 1,800+ programs` |
| 4 | 0:11–0:16 | **Coach email gen** | Click "Generate" → email types itself out, stats auto-fill | `personalized emails in seconds` |
| 5 | 0:16–0:21 | **Video Rater** | Paste a YouTube URL → rating reveals (aim for 8.5–9.0 score) | `your highlight, rated by AI` |
| 6 | 0:21–0:25 | **Tracker** | Slow scroll past Tracker rows with green "responded" badges | `every coach, tracked` |
| 7 | 0:25–0:29 | **Beeko chat** | Pre-typed question → reply streams in fast | `your AI counselor, 24/7` |
| 8 | 0:29–0:32 | **Camps + Roster Intel** | Camp cards, then quick cut to a roster spot opening notification | `ID camps. open spots.` |
| 9 | 0:32–0:34 | **Coach portal** | Cut to the coach dashboard viewing your athlete profile | `and coaches see you` |
| 10 | 0:34–0:40 | **End card** | Logo lock-up + URL + tagline. Hold for 6s while the music fades out gently | `KickrIQ` / `your shot at college soccer` / `kickriq.com` |

Beat 10 is where the music fades. Land the logo on the cleanest beat marker near 0:34. Music fades to silence over the last 2 seconds — calm confidence, not a slammed ending.

---

## Recording runbook (do once per beat)

**Browser setup (do this once before any recording):**
- Fresh Chrome profile, no extensions, no bookmarks bar
- Browser zoom 110%
- Window size: maximized at 1920×1080
- Login to your polished test athlete account
- Open all the pages you'll record in separate tabs in order, so you can flip through quickly without URL bar visible

**Test athlete seed data (so the screens look aspirational):**
- Name: pick a real-sounding name (e.g., "Alex Rivera")
- Position: Center Mid
- Stats: 24 goals, 12 assists, season just finished
- GPA: 3.9
- Grad year: 2027
- Top reach school: UNC or Stanford
- Highlight URL: pick a real high-quality YouTube highlight reel
- Bio + photo filled in completely

**Beat-by-beat capture instructions:**

| Beat | Page/URL | Setup before recording | Action to perform | Recording length |
|------|----------|------------------------|-------------------|------------------|
| 2 | `/onboarding/profile` (or wherever PitchPositionPicker lives) | Page loaded, scroll position on the picker | Drag the position marker once — Center Mid → Striker → back to Center Mid. Smooth, confident. | 5s (trim to 4s) |
| 3 | `/dashboard/schools` | Refresh page, ready to capture initial load animation | Hit refresh, let cards stagger in | 6s (trim to 5s) |
| 4 | `/dashboard/emails` | Form pre-filled, school selected | Click "Generate Email" — capture the streaming/typing | 6s (trim to 5s) |
| 5 | `/dashboard/video-rater` | URL field empty, score area empty | Paste a YouTube URL → click rate → wait for score reveal | 6s (trim to 5s) |
| 6 | `/dashboard/tracker` | Tracker has 5+ rows visible, mix of "responded" and "sent" | Slow scroll past the rows | 5s (trim to 4s) |
| 7 | `/dashboard/chat` (Beeko) | Question pre-typed in input: "what do I say to a D2 coach?" | Hit send → capture streaming reply | 5s (trim to 4s) |
| 8 | `/dashboard/camps` then `/dashboard/roster-intel` | Camps page loaded with cards visible; roster intel ready in second tab | Quick scroll camps → Cmd/Ctrl+Tab to roster intel → land on an open-spot row | 5s (trim to 3s) |
| 9 | `/coach` (CoachDashboard) | Coach dashboard open, viewing a list of athletes including your test athlete | Hover or click on the test athlete row, profile preview pops | 4s (trim to 2s) |

**General recording rules:**
- Record more than you need — always 1–2s of buffer at the start and end of each clip
- Don't move the cursor unless you have to. Stillness > jitter.
- If you screw up, do it again. Recording is cheap.
- Keep the cursor out of the way of important UI

---

## OBS Studio setup

1. **Settings → Output:**
   - Output Mode: Advanced
   - Recording Format: `mp4`
   - Encoder: NVIDIA NVENC H.264 (or x264 if no GPU)
   - Rate Control: CQP, CQ Level: 18 (high quality)
2. **Settings → Video:**
   - Base (Canvas) Resolution: 1920×1080
   - Output (Scaled) Resolution: 1920×1080
   - Common FPS Values: 60
3. **Sources:**
   - Add "Display Capture" — pick the screen with your browser
   - Crop to just the browser window if needed (Edit → Transform → Edit Transform)
4. **Hotkey:** bind Start/Stop Recording to F9 so you don't have to click.

---

## CapCut Desktop workflow (chill-house version)

1. **Import everything:** drop all clips + `assets/music/rediskasound-chill-house-background-music-462432.mp3` into the media bin.
2. **Drop the music on track 1 first.** Everything else cuts to it.
3. **Trim the music:** the track is 2:57. Scrub through and find a strong 40s segment — usually the second loop (around 0:30–1:10 of the original) is the most developed. Trim out everything else.
4. **Beat-detect the music:** right-click the audio → Beat → auto-mark. CapCut places markers at every downbeat. House music is typically 120–124 BPM, so beats land every ~0.5s.
5. **Lay clips on track 2** in order, snapping each cut to a beat marker. Don't cut on every beat — let some clips ride 4–8 beats. Cuts should breathe.
6. **Trim each clip** to its target length (see table above).
7. **Add text overlays on track 3:**
   - Font: medium-weight sans-serif (Inter Medium, Söhne, or system default sans). **Avoid** the heavy display fonts — they fight the chill vibe.
   - Size: ~80pt for one line, ~60pt for two
   - Lowercase
   - Color: white with very subtle drop shadow, OR a soft off-white (#F5F5F0)
   - Animation: simple **Fade in / Fade out** (~0.3s each). Skip Typewriter and Pop — too try-hard.
   - Each text overlay appears ~0.3s after the cut and exits ~0.3s before the next.
8. **Color grade:** light, clean. Add **slight contrast** bump and a tiny saturation lift (5–10%). **Avoid** the heavy Cinematic/Bold filters — keep the UI looking like the real product.
9. **Slow zoom on every clip:** keyframe the scale from 100% → 105% across each clip's duration. Subtle, ambient movement that elevates the whole thing.
10. **End card (beat 10):** logo + tagline + URL on a soft off-white background (or deep navy). Hold for 6s. Audio fades to silence over the last 2s using the music track's volume keyframes.
11. **Export:** 1920×1080, 60fps, "High" bitrate. Save as `kickriq-demo-40s-1080p.mp4`.

---

## Music

**File:** `assets/music/rediskasound-chill-house-background-music-462432.mp3`

- Source: Pixabay Music (royalty-free, no attribution required, commercial OK)
- Length: 2:57, 256kbps
- Genre: Chill house — even groove, no dramatic drop
- Approach: trim a strong 40s segment from the track's developed middle (typically 0:30–1:10 of the original). Use volume keyframes to fade out cleanly over the last 2 seconds of the edit.

---

## Deliverables

- `kickriq-demo-40s-1080p.mp4` — main, embedded on landing page (autoplay-muted, looping)
- `kickriq-demo-40s-vertical-9x16.mp4` — cropped for IG Reels / TikTok (re-export from CapCut at 1080×1920)
- `kickriq-demo-thumbnail.jpg` — 1280×720 still grab from beat 4 or 5

---

## Total estimated time

- Music selection: 10 min
- Recording all 8 clips: 20 min
- CapCut edit (first pass): 35 min
- Polish + export: 15 min
- **~80 min total for v1**
