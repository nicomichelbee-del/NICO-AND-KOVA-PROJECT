import puppeteer from 'puppeteer'
async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0')
  await page.goto('https://umterps.com/sports/womens-soccer/roster', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await new Promise(r => setTimeout(r, 2500))
  const data = await page.evaluate(`(function() {
    var lines = (document.body.innerText||'').split('\\n').map(s=>s.trim()).filter(Boolean)
    // Find all occurrences of "SPORT" in lines
    var hits = []
    for (var i=0; i<lines.length; i++) {
      if (/\\bsport\\b/i.test(lines[i])) {
        hits.push({i, ctx: lines.slice(Math.max(0,i-2),i+5).join(' | ')})
        if (hits.length >= 5) break
      }
    }
    return hits
  })()`)
  console.log(JSON.stringify(data, null, 2))
  await browser.close()
}
main().catch(console.error)
