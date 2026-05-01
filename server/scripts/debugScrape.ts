import puppeteer from 'puppeteer'

const url = process.argv[2] || 'https://hopkinssports.com/sports/mens-soccer/coaches'

;(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36')
  console.log('Visiting:', url)
  const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
  console.log('Status:', r?.status())
  await new Promise((res) => setTimeout(res, 2500))

  const info = await page.evaluate(() => {
    const text = document.body?.innerText ?? ''
    const headIdx = text.toLowerCase().indexOf('head coach')
    return {
      title: document.title,
      bodyChars: text.length,
      headIdx,
      headContext: headIdx >= 0 ? text.slice(Math.max(0, headIdx - 200), headIdx + 400) : '(no "head coach" found)',
      mailtos: Array.from(document.querySelectorAll('a[href^="mailto:"]')).map(a => (a as HTMLAnchorElement).href),
      // Try several common SIDEARM staff selectors
      selectorCounts: {
        sidearmStaff: document.querySelectorAll('.sidearm-staff-member').length,
        staffCard: document.querySelectorAll('[class*="staff"]').length,
        coachWord: document.querySelectorAll('[class*="coach"]').length,
        person: document.querySelectorAll('.person').length,
        staffItem: document.querySelectorAll('.s-staff-card, .s-staff-card-list-item, .s-person-card, .s-person-details').length,
        h2h3: document.querySelectorAll('h2, h3').length,
      },
    }
  })
  console.log(JSON.stringify(info, null, 2))
  await browser.close()
})()
