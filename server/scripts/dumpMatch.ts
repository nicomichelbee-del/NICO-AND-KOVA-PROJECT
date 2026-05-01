// Dumps which line in the page text triggered a head-coach title match near "Aniya Williams"
import puppeteer from 'puppeteer'

async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0')
  await page.goto('https://gostanford.com/sports/womens-soccer/roster', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await new Promise(r => setTimeout(r, 2500))

  const result = await page.evaluate(`(function() {
    var lines = (document.body.innerText||'').split('\\n').map(s=>s.trim()).filter(Boolean)
    var isHeadCoachTitle = function(s) {
      if (!s) return false
      if (/\\bhead\\b.*\\bcoach\\b/i.test(s)) return true
      if (/\\bdirector\\b.*\\bsoccer\\b/i.test(s)) return true
      return false
    }
    var isPersonName = function(s) {
      if (!s || s.length < 4 || s.length > 60) return false
      var tokens = s.split(/\\s+/).filter(Boolean)
      if (tokens.length < 2 || tokens.length > 6) return false
      if (!/^[A-Z]/.test(tokens[0])) return false
      if (!/^[A-Z]/.test(tokens[tokens.length-1])) return false
      var NAME_BLOCKLIST = /^(NAME|TITLE|PHONE|EMAIL|YEAR|HOMETOWN|POSITION|MEN\\'S|WOMEN\\'S|SOCCER|HEAD|COACH|STAFF|COACHING|ROSTER|DIRECTORY|SUPPORT|VIEW|BIO)\\b/i
      var SPORT_WORDS = /\\b(SOCCER|FOOTBALL|BASEBALL|BASKETBALL|HOCKEY|LACROSSE|TENNIS|GOLF|VOLLEYBALL|SWIMMING|TRACK|RUGBY|WRESTLING|COACH|STAFF|DIRECTOR|MANAGER|COORDINATOR|TRAINER|ATHLETIC|ATHLETICS|TEAM)\\b/i
      if (!/^[A-Za-z][a-zA-Z'.\-]+(?:\\s+[A-Za-z][a-zA-Z'.\-]*){1,5}$/.test(s)) return false
      if (NAME_BLOCKLIST.test(s)) return false
      if (SPORT_WORDS.test(s)) return false
      return true
    }
    var hits = []
    for (var i2 = 0; i2 < lines.length - 4; i2++) {
      var a = lines[i2].trim()
      if (!isPersonName(a)) continue
      for (var p = 1; p <= 4; p++) {
        var candidate = (lines[i2+p]||'').trim()
        if (isHeadCoachTitle(candidate) && !/former|assistant|associate|emerit|interim|deputy/i.test(candidate)) {
          hits.push({ nameIdx: i2, name: a, titleIdx: i2+p, title: candidate,
            between: lines.slice(i2+1, i2+p).join(' | ') })
          break
        }
        if (p > 1 && isPersonName(candidate)) break
      }
    }
    return hits.slice(0, 10)
  })()`)
  console.log('Strategy 2 hits:', JSON.stringify(result, null, 2))
  await browser.close()
}
main().catch(console.error)
