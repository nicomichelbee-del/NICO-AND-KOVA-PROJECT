import puppeteer from 'puppeteer'
import sharp from 'sharp'

export interface VideoFrame {
  timestamp: number
  data: string // base64 JPEG
}

export interface FrameGrid {
  data: string // base64 JPEG of the composite grid
  firstTimestamp: number
  lastTimestamp: number
  cellCount: number
}

export interface VideoAnalysisData {
  frames: VideoFrame[]    // raw frames — used for the UI filmstrip and for the user to click into
  grids: FrameGrid[]      // grid composites — sent to Claude Vision instead of individual frames
  duration: number
  title: string
}

// Grid layout — 4 cols × 3 rows = 12 frames per grid image.
// Each cell is 320x180; final grid is 1280x540 → ~922 input tokens per grid
// at Anthropic's roughly width*height/750 image-token formula. With 48 frames
// (4 grids), that's ~3,700 image tokens per request — well under the 30k
// tokens/min rate limit even when the hedge-guard retry fires. Each tile has
// the timestamp baked in as a yellow overlay in the top-left corner so the
// model can ground its observations to specific moments.
const GRID_COLS = 4
const GRID_ROWS = 3
const FRAMES_PER_GRID = GRID_COLS * GRID_ROWS
const CELL_W = 320
const CELL_H = 180

function fmtTimestamp(seconds: number): string {
  const mm = Math.floor(seconds / 60)
  const ss = Math.floor(seconds % 60)
  return `${mm}:${String(ss).padStart(2, '0')}`
}

async function composeFrameGrids(frames: VideoFrame[]): Promise<FrameGrid[]> {
  if (frames.length === 0) return []

  try {
    const grids: FrameGrid[] = []
    for (let chunkStart = 0; chunkStart < frames.length; chunkStart += FRAMES_PER_GRID) {
      const chunk = frames.slice(chunkStart, chunkStart + FRAMES_PER_GRID)

      // Build each tile: resize the frame to CELL_W × CELL_H and overlay a
      // timestamp badge in the top-left so the AI knows which moment is which.
      const tiles = await Promise.all(chunk.map(async (f) => {
        const tsLabel = fmtTimestamp(f.timestamp)
        const labelW = 60
        const labelH = 22
        const overlay = Buffer.from(
          `<svg width="${CELL_W}" height="${CELL_H}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${labelW}" height="${labelH}" fill="black" fill-opacity="0.78"/><text x="6" y="16" font-family="monospace" font-size="14" fill="#eab308" font-weight="bold">${tsLabel}</text></svg>`,
        )
        return sharp(Buffer.from(f.data, 'base64'))
          .resize(CELL_W, CELL_H, { fit: 'cover' })
          .composite([{ input: overlay, top: 0, left: 0 }])
          .jpeg({ quality: 85 })
          .toBuffer()
      }))

      const gridW = CELL_W * GRID_COLS
      const gridH = CELL_H * GRID_ROWS
      const composites = tiles.map((tile, i) => ({
        input: tile,
        top: Math.floor(i / GRID_COLS) * CELL_H,
        left: (i % GRID_COLS) * CELL_W,
      }))

      const buf = await sharp({
        create: { width: gridW, height: gridH, channels: 3, background: { r: 12, g: 14, b: 22 } },
      })
        .composite(composites)
        .jpeg({ quality: 80 })
        .toBuffer()

      grids.push({
        data: buf.toString('base64'),
        firstTimestamp: chunk[0].timestamp,
        lastTimestamp: chunk[chunk.length - 1].timestamp,
        cellCount: chunk.length,
      })
    }
    console.log(`[videoAnalyzer] composed ${grids.length} grid(s) from ${frames.length} frames`)
    return grids
  } catch (e) {
    console.error('[videoAnalyzer] composeFrameGrids failed:', e)
    throw new Error(`Grid composition failed: ${e instanceof Error ? e.message : String(e)}`)
  }
}

function calculateTimestamps(duration: number): number[] {
  const safe = isFinite(duration) && duration > 0 ? duration : 180
  const ts = new Set<number>()
  // Always include the opening sequence (title card / intro / first clip).
  ts.add(0)
  ts.add(3)
  ts.add(8)

  // Sampling stride — one frame every 4 seconds by default. Highlight clips
  // are typically 3–6 seconds long, so a 4s stride lands inside almost every
  // clip. Widens proportionally for longer videos so we never exceed
  // MAX_FRAMES.
  const FRAME_INTERVAL_SEC = 4
  // 48 frames captured raw, then composited into 4 grid images for the AI.
  // Token math: 4 grids at 1280x540 ≈ 3,700 image tokens — well under the
  // 30k tokens/min rate limit even with the divergence retry doubling spend.
  const MAX_FRAMES = 48

  let stride = FRAME_INTERVAL_SEC
  // If a long video would blow past MAX_FRAMES, widen the stride proportionally.
  const projected = Math.floor(safe / stride)
  if (projected > MAX_FRAMES - 5) {
    stride = Math.ceil(safe / (MAX_FRAMES - 5))
  }
  for (let t = stride; t < safe - 4; t += stride) {
    ts.add(Math.floor(t))
  }

  // Always grab the final seconds — many highlight videos save big plays for the end.
  ts.add(Math.max(0, Math.floor(safe) - 4))
  return [...ts].sort((a, b) => a - b).slice(0, MAX_FRAMES)
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

export async function captureYouTubeFrames(url: string): Promise<VideoAnalysisData> {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--mute-audio',
      '--autoplay-policy=no-user-gesture-required',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
    ],
  })

  try {
    const page = await browser.newPage()
    // 1280x720 viewport. Raw frames are NOT sent to the AI anymore — they're
    // downsized into 320x180 cells inside grid composites — so the AI's input
    // token budget is decoupled from capture resolution. Capturing at 720p
    // makes the source frames crisp enough to (a) downscale cleanly into
    // grid tiles, (b) look good in the UI filmstrip, and (c) ensure the
    // YouTube video element renders large enough to actually screenshot.
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 })

    // tsx/esbuild injects __name(fn, "name") helpers into compiled code. When we
    // pass a function to page.evaluate(), puppeteer stringifies it via toString(),
    // and those __name() calls leak into the browser context where __name is
    // undefined. Polyfill it before any evaluate runs. Use the string form so
    // this initializer itself can't be affected by the same transform.
    await page.evaluateOnNewDocument('globalThis.__name = function(t){return t;};')

    // Bypass YouTube consent dialog
    await page.setCookie(
      { name: 'CONSENT',  value: 'YES+42',    domain: '.youtube.com', path: '/' },
      { name: 'SOCS',     value: 'CAISNQgDEitib3FfaWRlbnRpdHlmcm9udGVuZHVpX3YyX2RlZmF1bHRfY29uc2VudA..', domain: '.youtube.com', path: '/' },
    )

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForSelector('video', { timeout: 15000 })

    // Dismiss any remaining overlay/consent dialogs
    await page.evaluate(() => {
      document.querySelectorAll<HTMLElement>('button, tp-yt-paper-button').forEach(btn => {
        const text = btn.textContent?.trim() ?? ''
        if (text === 'Accept all' || text === 'Reject all' || btn.getAttribute('aria-label') === 'Accept all') {
          btn.click()
        }
      })
    })
    await sleep(800)

    // Skip ad if present
    try {
      await page.waitForSelector('.ytp-skip-ad-button, .ytp-ad-skip-button', { timeout: 3000 })
      await page.click('.ytp-skip-ad-button, .ytp-ad-skip-button')
      await sleep(500)
    } catch { /* no ad */ }

    const title = await page.title().then(t => t.replace(/ ?[-–|]? ?YouTube$/, '').trim())

    // Start playback briefly to warm up the video buffer
    await page.evaluate(() => {
      const v = document.querySelector('video') as HTMLVideoElement
      if (v) { v.muted = true; void v.play() }
    })
    await sleep(2500)

    // Get duration
    let duration = 0
    for (let i = 0; i < 12; i++) {
      duration = await page.evaluate(() => (document.querySelector('video') as HTMLVideoElement)?.duration ?? 0)
      if (isFinite(duration) && duration > 0) break
      await sleep(500)
    }

    // Hide player overlay UI so screenshots show only the video
    await page.evaluate(() => {
      const hide = (sel: string) => document.querySelectorAll<HTMLElement>(sel).forEach(el => { el.style.opacity = '0' })
      hide('.ytp-chrome-top')
      hide('.ytp-chrome-bottom')
      hide('.ytp-gradient-top')
      hide('.ytp-gradient-bottom')
      hide('.ytp-pause-overlay')
    })

    const timestamps = calculateTimestamps(duration)
    const frames: VideoFrame[] = []

    for (const ts of timestamps) {
      await page.evaluate((t) => {
        const v = document.querySelector('video') as HTMLVideoElement
        if (v) { v.currentTime = t; v.pause() }
      }, ts)

      await sleep(500) // let the frame decode — tight window because we take up to 80 frames

      const videoEl = await page.$('video')
      if (videoEl) {
        const buf = await videoEl.screenshot({ type: 'jpeg', quality: 80 })
        frames.push({ timestamp: ts, data: Buffer.isBuffer(buf) ? buf.toString('base64') : String(buf) })
      }
    }

    const grids = await composeFrameGrids(frames)
    return { frames, grids, duration, title }
  } finally {
    await browser.close()
  }
}
