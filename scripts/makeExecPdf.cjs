const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const abs = path.resolve(__dirname, '..', 'docs', 'EXECUTIVE_SUMMARY.html');
  const url = 'file:///' + abs.split(path.sep).join('/');
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.emulateMediaType('print');
  await page.pdf({
    path: path.resolve(__dirname, '..', 'docs', 'EXECUTIVE_SUMMARY.pdf'),
    format: 'Letter',
    printBackground: true,
    margin: { top: '0.55in', right: '0.6in', bottom: '0.55in', left: '0.6in' },
    preferCSSPageSize: true,
  });
  await browser.close();
  console.log('PDF written: docs/EXECUTIVE_SUMMARY.pdf');
})();
