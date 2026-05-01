import puppeteer from 'puppeteer'
import { ATHLETICS_DOMAINS } from './athleticsDomains'

;(async () => {
  console.log('Domain map size:', Object.keys(ATHLETICS_DOMAINS).length)
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36')
  await page.setViewport({ width: 1280, height: 800 })
  console.log('Going to Hopkins...')
  try {
    const r = await page.goto('https://hopkinssports.com/sports/mens-soccer/coaches', { waitUntil: 'domcontentloaded', timeout: 20000 })
    console.log('status:', r?.status())
    const len = await page.evaluate(() => document.body.innerText.length)
    console.log('body length:', len)
  } catch (e) {
    console.log('FAIL:', (e as Error).message)
  }
  await browser.close()
})()
