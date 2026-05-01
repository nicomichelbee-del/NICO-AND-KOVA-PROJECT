import puppeteer from 'puppeteer'
const urls = [
  'https://fightingirish.com/sports/womens-soccer',
  'https://fightingirish.com/sports/womens-soccer/coaches',
  'https://athletics.nd.edu/sports/womens-soccer/coaches',
  'https://und.com/sports/womens-soccer/coaches',
]
async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  for (const url of urls) {
    const page = await browser.newPage()
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 })
      await new Promise(r => setTimeout(r, 1500))
      const info = await page.evaluate(`(function(){
        return {
          title: document.title,
          finalUrl: window.location.href,
          hasCoach: /head.*coach|director.*soccer/i.test(document.body.innerText||''),
          hasSoccer: /\\bsoccer\\b/i.test(document.title)
        }
      })()`)
      console.log(url, '->', resp?.status(), info)
    } catch(e) { console.log(url, '-> error:', (e as Error).message.slice(0,60)) }
    await page.close()
  }
  await browser.close()
}
main().catch(console.error)
