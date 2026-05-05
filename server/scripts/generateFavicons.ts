/**
 * Generate favicon set + og:image from logo-kickriq.png.
 *
 * Output (written to client/public/):
 *   favicon-16.png         16x16
 *   favicon-32.png         32x32
 *   favicon.ico            32x32 (browsers fall back to this)
 *   apple-touch-icon.png   180x180 (iOS home-screen icon)
 *   icon-192.png           192x192 (PWA / Android)
 *   icon-512.png           512x512 (PWA / Android)
 *   og-image.png           1200x630 (Open Graph + Twitter Card)
 *
 * Logo is wide (891x272). For square icons we crop to just the leftmost square
 * (the "K" + part of "ickr") which stays readable at small sizes. For og-image
 * we center the full wordmark on a dark background.
 *
 * Usage: npx tsx server/scripts/generateFavicons.ts
 */

import sharp from 'sharp'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.join(__dirname, '..', '..')
const LOGO = path.join(ROOT, 'logo-kickriq.png')
const OUT = path.join(ROOT, 'client', 'public')

// KickrIQ brand: deep navy/black background. Matches the dashboard theme.
const BG = { r: 11, g: 14, b: 24, alpha: 1 }

async function squareFromLogo(size: number, outFile: string) {
  // Crop the leftmost square of the logo (the "K") so the icon is readable
  // even at 16x16. The logo is 891 wide × 272 tall — we take 272×272 from
  // the left edge, then resize to the target size.
  const meta = await sharp(LOGO).metadata()
  const sourceSize = Math.min(meta.width ?? 272, meta.height ?? 272)
  await sharp(LOGO)
    .extract({ left: 0, top: 0, width: sourceSize, height: sourceSize })
    .resize(size, size, { fit: 'contain', background: BG })
    .png()
    .toFile(outFile)
  console.log(`  ✓ ${path.relative(ROOT, outFile)}  (${size}x${size})`)
}

async function ogImage(outFile: string) {
  const W = 1200
  const H = 630
  // Logo at ~70% of OG image width, centered vertically with breathing room.
  const logoWidth = Math.round(W * 0.7)
  const resized = await sharp(LOGO).resize(logoWidth).png().toBuffer()
  const meta = await sharp(resized).metadata()
  const top = Math.round((H - (meta.height ?? 0)) / 2)
  const left = Math.round((W - (meta.width ?? 0)) / 2)

  await sharp({
    create: { width: W, height: H, channels: 4, background: BG },
  })
    .composite([{ input: resized, top, left }])
    .png()
    .toFile(outFile)
  console.log(`  ✓ ${path.relative(ROOT, outFile)}  (${W}x${H})`)
}

async function main() {
  if (!fs.existsSync(LOGO)) throw new Error(`Logo not found at ${LOGO}`)
  fs.mkdirSync(OUT, { recursive: true })

  console.log('Generating favicon set from logo-kickriq.png:')
  await squareFromLogo(16, path.join(OUT, 'favicon-16.png'))
  await squareFromLogo(32, path.join(OUT, 'favicon-32.png'))
  await squareFromLogo(180, path.join(OUT, 'apple-touch-icon.png'))
  await squareFromLogo(192, path.join(OUT, 'icon-192.png'))
  await squareFromLogo(512, path.join(OUT, 'icon-512.png'))
  await ogImage(path.join(OUT, 'og-image.png'))

  // favicon.ico: just copy the 32×32 PNG. Modern browsers accept PNG inside
  // .ico via the link rel="icon" — full multi-resolution .ico is overkill.
  fs.copyFileSync(path.join(OUT, 'favicon-32.png'), path.join(OUT, 'favicon.ico'))
  console.log(`  ✓ client/public/favicon.ico  (32x32 fallback)`)

  console.log('\nDone. Add the link tags to client/index.html (see deploy runbook).')
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
