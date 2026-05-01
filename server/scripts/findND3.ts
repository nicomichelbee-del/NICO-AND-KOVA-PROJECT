import puppeteer from 'puppeteer'
const slugs = [
  'soccer-women', 'soccer-men', 'women-soccer', 'men-soccer',
  'womens-soccer', 'wsoccer', 'msoccer', 'soccer',
]
async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  for (const slug of slugs) {
    const url = `https://fightingirish.com/sports/${slug}/coaches`
    const page = await browser.newPage()
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 })
      await new Promise(r => setTimeout(r, 2000))
      const info = await page.evaluate(`(function(){
        return { title: document.title.slice(0,60), finalUrl: window.location.href, hasCoach: /head.*coach/i.test(document.body.innerText||'') }
      })()`)
      if (info.finalUrl !== 'https://fightingirish.com/') {
        console.log('FOUND:', url, '->', resp?.status(), info)
      }
    } catch(e) {}
    await page.close()
  }
  await browser.close()
  console.log('done')
}
main().catch(console.error)
