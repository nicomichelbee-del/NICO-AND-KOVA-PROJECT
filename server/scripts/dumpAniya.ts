import puppeteer from 'puppeteer'
async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0')
  await page.goto('https://gostanford.com/sports/womens-soccer/roster', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await new Promise(r => setTimeout(r, 2500))
  const data = await page.evaluate(`(function() {
    var lines = (document.body.innerText||'').split('\\n').map(s=>s.trim()).filter(Boolean)
    var idx = lines.findIndex(l => /aniya/i.test(l))
    return { context: lines.slice(Math.max(0,idx-3), idx+10), idx }
  })()`)
  console.log(JSON.stringify(data, null, 2))
  await browser.close()
}
main().catch(console.error)
