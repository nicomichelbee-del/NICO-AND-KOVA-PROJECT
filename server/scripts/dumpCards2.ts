import puppeteer from 'puppeteer'
async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0')
  await page.goto('https://umterps.com/sports/womens-soccer/roster', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await new Promise(r => setTimeout(r, 2500))
  const data = await page.evaluate(`(function() {
    // Search all text for "sport oversight" to understand where it comes from
    var allText = (document.body.innerText||'').split('\\n').map(s=>s.trim()).filter(Boolean)
    var idx = allText.findIndex(l => /sport oversight/i.test(l))
    var context = allText.slice(Math.max(0,idx-5), idx+10)
    
    // Also find the coaching staff cards specifically
    var staffCards = Array.from(document.querySelectorAll('.s-person-card')).filter(function(el) {
      return /head.*coach|director.*soccer/i.test(el.innerText||'')
    })
    var staffInfo = staffCards.slice(0,4).map(function(el) {
      var text = (el.innerText||'').replace(/\\s+/g,' ').trim()
      var mailto = (el.querySelector('a[href^="mailto:"]')||{}).href || ''
      return { text: text.slice(0,150), mailto }
    })
    return { sportOversightCtx: context, idx, staffCards: staffInfo }
  })()`)
  console.log(JSON.stringify(data, null, 2))
  await browser.close()
}
main().catch(console.error)
