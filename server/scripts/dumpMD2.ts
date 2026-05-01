import puppeteer from 'puppeteer'
async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0')
  await page.goto('https://umterps.com/sports/womens-soccer/roster', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await new Promise(r => setTimeout(r, 2500))
  const data = await page.evaluate(`(function() {
    var lines = (document.body.innerText||'').split('\\n').map(s=>s.trim()).filter(Boolean)
    // Find all occurrences of "oversight" 
    var hits1 = []
    for (var i=0; i<lines.length; i++) {
      if (/oversight/i.test(lines[i])) {
        hits1.push({i, line: lines[i], ctx: lines.slice(Math.max(0,i-3),i+5).join(' | ')})
      }
    }
    // Also find lines near mmarch email
    var emailIdx = lines.findIndex(l => /mmarch/i.test(l))
    var emailCtx = lines.slice(Math.max(0,emailIdx-10), emailIdx+5)
    return { oversight: hits1, emailCtx, emailIdx }
  })()`)
  console.log(JSON.stringify(data, null, 2))
  await browser.close()
}
main().catch(console.error)
