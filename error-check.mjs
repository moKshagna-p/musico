import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
  
  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
    const errorText = await page.evaluate(() => {
      const pre = document.querySelector('pre');
      return pre ? pre.innerText : null;
    });
    if (errorText) {
      console.log('ERROR ON PAGE:', errorText);
    } else {
      console.log('No error pre tag found.');
    }
  } catch (err) {
    console.log('Navigation failed:', err.message);
  }
  
  await browser.close();
})();
