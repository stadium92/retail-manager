const puppeteer = require('puppeteer');

(async () => {
  console.log("🚀 Running robust integration test for signup & master login...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', msg => console.log('🖥️ [Browser Console]:', msg.text()));
  page.on('pageerror', err => console.error('🚫 [Browser Error]:', err.toString()));

  const typeInInput = async (selector, text) => {
    await page.waitForSelector(selector);
    await page.focus(selector);
    await page.evaluate((sel, val) => {
      const el = document.querySelector(sel);
      if (el) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(el, val);
        const ev = new Event('input', { bubbles: true });
        el.dispatchEvent(ev);
      }
    }, selector, text);
  };

  try {
    console.log("Navigating to production site...");
    await page.goto('https://retail-manager-mobile.vercel.app/#/auth', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3000));

    // 1. Click skip/trial button on Activation Gate
    console.log("Checking for Activation Gate skip button...");
    const clickedTrial = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const found = buttons.find(b => b.textContent.includes('Essai') || b.textContent.includes('trial') || b.textContent.includes('Trial'));
      if (found) {
        found.click();
        return true;
      }
      return false;
    });

    if (clickedTrial) {
      console.log("Clicked trial skip button. Waiting for Terms of Service Gate...");
      await new Promise(r => setTimeout(r, 2000));
    }

    // 2. Handle Terms of Service Gate
    console.log("Checking for Terms of Service checkbox...");
    const hasTerms = await page.evaluate(() => {
      return !!document.querySelector('#terms');
    });

    if (hasTerms) {
      console.log("Terms checkbox found. Clicking it...");
      await page.evaluate(() => {
        const chk = document.querySelector('#terms');
        const label = document.querySelector('label[for="terms"]') || chk;
        if (label) label.click();
      });

      await new Promise(r => setTimeout(r, 1000));

      console.log("Clicking CONFIRMER button...");
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const confirmBtn = buttons.find(b => b.textContent.includes('CONFIRMER') || b.textContent.includes('ACCÉDER'));
        if (confirmBtn) confirmBtn.click();
      });
      await new Promise(r => setTimeout(r, 2000));
    }

    // 3. Click Landing Page "Commencer" button
    console.log("Checking for Landing Page 'Commencer' button...");
    const clickedCommencer = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const startBtn = buttons.find(b => b.textContent.includes('Commencer') || b.textContent.includes('Get Started'));
      if (startBtn) {
        startBtn.click();
        return true;
      }
      return false;
    });

    if (clickedCommencer) {
      console.log("Clicked 'Commencer' button. Waiting for Auth form...");
      await new Promise(r => setTimeout(r, 2000));
    }

    // Generate unique email to avoid duplication errors
    const uniqueEmail = `test_master_${Date.now()}@master.com`;
    console.log(`Using unique signup email: ${uniqueEmail}`);

    // 4. Click the "S'inscrire" (Signup) tab natively using Puppeteer selector
    console.log("Switching to Sign Up tab using CSS selector...");
    await page.waitForSelector('button[id$="-trigger-signup"]');
    await page.click('button[id$="-trigger-signup"]');
    await new Promise(r => setTimeout(r, 1500));

    // 5. Fill out Sign Up Form
    console.log("Entering Sign Up details...");
    await typeInInput('#signup-name', 'Ursula Master');
    await typeInInput('#signup-email', uniqueEmail);
    await typeInInput('#signup-password', '12345678@');
    await typeInInput('#signup-confirm', '12345678@');

    // Screenshot of signup form before submit
    let signupFormPath = '/Users/mohamedcoulibaly/.gemini/antigravity-cli/brain/17427b69-df36-432b-88e5-15c4d9dd2f56/scratch/live_signup_form_before_submit.png';
    await page.screenshot({ path: signupFormPath });
    console.log(`📸 Sign up form screenshot saved: ${signupFormPath}`);

    console.log("Submitting Sign Up form...");
    await page.evaluate(() => {
      const forms = Array.from(document.querySelectorAll('form'));
      const signupForm = forms.find(f => f.querySelector('#signup-name'));
      if (signupForm) {
        signupForm.requestSubmit();
      } else {
        const submitBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Créer') || b.textContent.includes('Account'));
        if (submitBtn) submitBtn.click();
      }
    });

    // Wait for the signup request to complete and show toast/success state
    console.log("Waiting for signup request to process...");
    await new Promise(r => setTimeout(r, 5000));

    // 6. Switch back to Login Tab natively using Puppeteer
    console.log("Switching back to Login tab using CSS selector...");
    await page.click('button[id$="-trigger-login"]');
    await new Promise(r => setTimeout(r, 1500));

    console.log("Entering login credentials...");
    await typeInInput('#login-email', uniqueEmail);
    await typeInInput('#login-password', '12345678@');

    console.log("Submitting login form...");
    await page.evaluate(() => {
      const forms = Array.from(document.querySelectorAll('form'));
      const loginForm = forms.find(f => f.querySelector('#login-email'));
      if (loginForm) loginForm.requestSubmit();
    });

    console.log("Waiting for redirection to Master dashboard...");
    await page.waitForFunction(() => window.location.hash.includes('/master/dashboard'), { timeout: 15000 });
    await new Promise(r => setTimeout(r, 5000)); // wait for data to load

    const path = '/Users/mohamedcoulibaly/.gemini/antigravity-cli/brain/17427b69-df36-432b-88e5-15c4d9dd2f56/scratch/live_master_dashboard_success.png';
    await page.screenshot({ path });
    console.log(`📸 Master dashboard success screenshot saved: ${path}`);

  } catch (error) {
    console.error("❌ Error during integration test:", error);
    const path = '/Users/mohamedcoulibaly/.gemini/antigravity-cli/brain/17427b69-df36-432b-88e5-15c4d9dd2f56/scratch/live_signup_error_state.png';
    await page.screenshot({ path });
    console.log(`📸 Error screenshot saved: ${path}`);
  } finally {
    await browser.close();
  }
})();
