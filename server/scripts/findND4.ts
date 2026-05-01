import puppeteer from 'puppeteer'
async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0')
  // Try the main homepage and look for soccer links
  await page.goto('https://fightingirish.com/', { waitUntil: 'networkidle2', timeout: 20000 })
  await new Promise(r => setTimeout(r, 2000))
  const links = await page.evaluate(`(function(){
    var out=[]
    document.querySelectorAll('a[href]').forEach(function(a){
      if (/soccer/i.test(a.href)) out.push(a.href)
    })
    return [...new Set(out)].slice(0,15)
  })()`)
  console.log('Soccer links:', JSON.stringify(links, null, 2))
  await browser.close()
}
main().catch(console.error)
