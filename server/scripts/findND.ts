import puppeteer from 'puppeteer'
async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0')
  // Use DuckDuckGo to find the right page
  const q = encodeURIComponent("Notre Dame fighting Irish women's soccer head coach site:fightingirish.com")
  await page.goto(`https://duckduckgo.com/html/?q=${q}`, { waitUntil: 'domcontentloaded', timeout: 15000 })
  await new Promise(r => setTimeout(r, 1000))
  const links = await page.evaluate(`(function(){
    var out=[]
    document.querySelectorAll('a.result__a,a.result__url,.result__title a').forEach(function(a){
      if(a.href && a.href.indexOf('duckduckgo.com')===-1) out.push(a.href)
    })
    return out.slice(0,8)
  })()`)
  console.log('DDG links:', JSON.stringify(links, null, 2))
  await browser.close()
}
main().catch(console.error)
