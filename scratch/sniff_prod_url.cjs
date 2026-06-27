const puppeteer = require('puppeteer');

(async () => {
  console.log("Launching browser to sniff production URL...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  page.on('request', request => {
    const url = request.url();
    if (url.includes('supabase') || url.includes('postgrest') || url.includes('auth')) {
      console.log(`📡 Outgoing Request: ${url}`);
    }
  });

  try {
    await page.goto('https://retail-manager-mobile.vercel.app/#/auth', { waitUntil: 'networkidle2' });
    console.log("Navigation complete. Sniffing done.");
  } catch (err) {
    console.error("Error navigating:", err);
  } finally {
    await browser.close();
  }
})();
