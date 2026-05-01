import puppeteer from 'puppeteer'
const url = process.argv[2] || 'https://gostanford.com/sports/womens-soccer'
async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await new Promise(r => setTimeout(r, 2500))
  const data = await page.evaluate(`(function() {
    var lines = (document.body.innerText||'').split('\\n').map(s=>s.trim()).filter(Boolean)
    var coachCtx = []
    for(var i=0;i<lines.length;i++){if(/coach/i.test(lines[i])){coachCtx.push({b2:lines[i-2]||'',b1:lines[i-1]||'',L:lines[i],a1:lines[i+1]||'',a2:lines[i+2]||''});if(coachCtx.length>=8)break;}}
    var emails = Array.from(document.querySelectorAll('a[href^="mailto:"]')).map(a=>({href:a.href,text:a.innerText,cls:(a.parentElement||{}).className||''})).slice(0,8)
    var cls = Array.from(new Set(Array.from(document.querySelectorAll('[class]')).map(el=>el.className).join(' ').split(/\\s+/))).filter(c=>/staff|coach|person|card|bio|member|sidearm/i.test(c)).slice(0,20)
    return {title:document.title, coachCtx, emails, cls}
  })()`)
  console.log('URL:', url)
  console.log(JSON.stringify(data, null, 2))
  await browser.close()
}
main().catch(console.error)
