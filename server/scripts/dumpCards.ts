import puppeteer from 'puppeteer'
async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0')
  await page.goto('https://umterps.com/sports/womens-soccer/roster', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await new Promise(r => setTimeout(r, 2500))
  const data = await page.evaluate(`(function() {
    var cards = document.querySelectorAll('.s-person-card,[class*="staff-list-item"],[class*="person-details"]')
    var results = []
    for (var c = 0; c < Math.min(cards.length, 8); c++) {
      var card = cards[c]
      var text = (card.innerText||'').replace(/\\s+/g,' ').trim()
      var cls = card.className
      var mailto = (card.querySelector('a[href^="mailto:"]')||{}).href || ''
      results.push({cls: cls.slice(0,60), text: text.slice(0,120), mailto})
    }
    return results
  })()`)
  console.log(JSON.stringify(data, null, 2))
  await browser.close()
}
main().catch(console.error)
