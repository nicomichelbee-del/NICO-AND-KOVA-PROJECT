import puppeteer from 'puppeteer'

export interface VideoFrame {
  timestamp: number
  data: string // base64 JPEG
}

export interface VideoAnalysisData {
  frames: VideoFrame[]
  duration: number
  title: string
}

function calculateTimestamps(duration: number): number[] {
  const safe = isFinite(duration) && duration > 0 ? duration : 180
  const ts = new Set<number>()
  // Always include the opening sequence (title card / intro / first clip).
  ts.add(0)
  ts.add(3)
  ts.add(8)

  // Dense sampling — one frame every 3 seconds. Highlight clips are often only
  // 3–6s, so a 3s interval guarantees we land inside every single clip and
  // miss nothing across the whole video.
  const FRAME_INTERVAL_SEC = 3
  const MAX_FRAMES = 80  // hard cap to stay within Anthropic's per-request image budget and keep latency sane

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
    // 1280x720 viewport gives the AI enough resolution to actually see small
    // on-field details like a player-identifier circle, arrow, or spotlight.
    // 854x480 was too low — markers shrunk to ~10 pixels and looked like noise.
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
        // quality 75 — lowered to keep total payload manageable now that we send
        // up to 80 frames per request. Still legible at 1280x720 for vision analysis.
        const buf = await videoEl.screenshot({ type: 'jpeg', quality: 75 })
        frames.push({ timestamp: ts, data: Buffer.isBuffer(buf) ? buf.toString('base64') : String(buf) })
      }
    }

    return { frames, duration, title }
  } finally {
    await browser.close()
  }
}
