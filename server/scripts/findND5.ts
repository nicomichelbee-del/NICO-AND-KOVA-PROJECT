import puppeteer from 'puppeteer'
async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0')
  // Wait for full JS to load, then check if URL changed
  await page.goto('https://fightingirish.com/sports/womens-soccer/coaches', { waitUntil: 'networkidle0', timeout: 25000 })
  const info = await page.evaluate(`(function(){
    var lines = (document.body.innerText||'').split('\\n').map(s=>s.trim()).filter(Boolean)
    var coachLines = lines.filter(l => /coach/i.test(l)).slice(0,5)
    return { title: document.title, finalUrl: window.location.href, coachLines }
  })()`)
  console.log(JSON.stringify(info, null, 2))
  await browser.close()
}
main().catch(console.error)
