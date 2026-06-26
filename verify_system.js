import puppeteer from 'puppeteer';

(async () => {
  console.log("🚀 Starting system verification script...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Capture page logs and errors
  page.on('console', msg => console.log('🖥️ [Browser Console]:', msg.text()));
  page.on('pageerror', err => console.error('🚫 [Browser Error]:', err.toString()));
  
  // Set viewport size
  await page.setViewport({ width: 1280, height: 800 });

  // Typing helper function to avoid race conditions/stale elements in React
  const typeInInput = async (selector, text) => {
    await page.waitForSelector(selector);
    await page.focus(selector);
    await page.evaluate((sel, val) => {
      const el = document.querySelector(sel);
      if (el) {
        // Bypass React's value interceptor
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(el, val);
        // Dispatch event so React detects the change
        const ev = new Event('input', { bubbles: true });
        el.dispatchEvent(ev);
      }
    }, selector, text);
  };

  // Helper for taking screenshots
  let screenshotIndex = 1;
  const takeScreenshot = async (name) => {
    const path = `/Users/mohamedcoulibaly/.gemini/antigravity-cli/brain/5f75d8fa-84c1-457a-b2e1-29b831e15efb/scratch/screenshot_${screenshotIndex}_${name}.png`;
    await page.screenshot({ path });
    console.log(`📸 Screenshot saved: ${path}`);
    screenshotIndex++;
  };

  try {
    // 1. Load Auth Page
    console.log("Navigating to auth page...");
    await page.goto('http://localhost:5173/#/auth', { waitUntil: 'networkidle2' });
    await takeScreenshot('initial_load');

    // 2. Handle Activation/Skip Gate
    console.log("Checking for Activation Skip button...");
    const trialButtonText = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const found = buttons.find(b => b.textContent.includes('Essai') || b.textContent.includes('trial') || b.textContent.includes('Trial'));
      if (found) {
        found.click();
        return found.textContent;
      }
      return null;
    });

    if (trialButtonText) {
      console.log(`Clicked trial skip button: "${trialButtonText.trim()}"`);
      await page.waitForTimeout ? await page.waitForTimeout(1000) : await new Promise(r => setTimeout(r, 1000));
      await takeScreenshot('after_trial_skip');
    } else {
      console.log("No trial skip button found, proceeding.");
    }

    // 3. Handle Terms of Service Gate
    console.log("Checking for Terms of Service checkbox...");
    const hasTerms = await page.evaluate(() => {
      const chk = document.querySelector('#terms');
      if (chk) {
        const label = document.querySelector('label[for="terms"]') || chk;
        label.click();
        return true;
      }
      return false;
    });

    if (hasTerms) {
      console.log("Terms checkbox clicked. Finding and clicking CONFIRMER button...");
      await page.waitForTimeout ? await page.waitForTimeout(500) : await new Promise(r => setTimeout(r, 500));
      
      const clickedConfirm = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const confirmBtn = buttons.find(b => b.textContent.includes('CONFIRMER') || b.textContent.includes('ACCÉDER'));
        if (confirmBtn) {
          confirmBtn.click();
          return true;
        }
        return false;
      });
      
      if (clickedConfirm) {
        console.log("Terms CONFIRMER button clicked successfully.");
        await page.waitForTimeout ? await page.waitForTimeout(1500) : await new Promise(r => setTimeout(r, 1500));
        await takeScreenshot('after_terms_confirm');
      } else {
        console.log("Could not find Terms confirm button.");
      }
    } else {
      console.log("No Terms of Service gate detected.");
    }

    // 3.5. Handle Landing Page "Commencer" / "Get Started"
    console.log("Checking for Landing Page 'Commencer' button...");
    const hasGetStarted = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const startBtn = buttons.find(b => b.textContent.includes('Commencer') || b.textContent.includes('Get Started'));
      if (startBtn) {
        startBtn.click();
        return true;
      }
      return false;
    });

    if (hasGetStarted) {
      console.log("Clicked 'Commencer' button. Waiting for login page to load...");
      await page.waitForTimeout ? await page.waitForTimeout(1500) : await new Promise(r => setTimeout(r, 1500));
      await takeScreenshot('after_commencer_click');
    } else {
      console.log("No landing page 'Commencer' button found, proceeding.");
    }

    // 4. Perform Master Login
    console.log("Entering Master credentials...");
    await typeInInput('#login-email', 'ursula@master.com');
    await typeInInput('#login-password', '1234567890');
    await takeScreenshot('auth_credentials_entered');

    console.log("Submitting login form...");
    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form) {
        form.requestSubmit();
      } else {
        throw new Error("Could not find login form element!");
      }
    });

    // 5. Verify Master Dashboard Redirection & Render
    console.log("Waiting for redirection to Master dashboard...");
    await page.waitForFunction(() => window.location.hash.includes('/master/dashboard'), { timeout: 15000 });
    console.log("Successfully redirected to Master dashboard!");
    await page.waitForNetworkIdle({ idleTime: 1500 });
    await takeScreenshot('master_dashboard');

    // Check if dashboard metrics are loaded
    const titleText = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      return h1 ? h1.textContent : '';
    });
    console.log("Master Dashboard Title:", titleText);

    // 6. Test Dashboard Interconnectivity: Check Tabs (Overview, AI Assistant, Insights)
    console.log("Checking AI Assistant Tab...");
    const tabButtons = await page.$$('button[role="tab"]');
    console.log(`Found ${tabButtons.length} tab buttons.`);
    
    if (tabButtons.length >= 2) {
      await tabButtons[1].click(); // Click AI Assistant tab
      await page.waitForTimeout ? await page.waitForTimeout(1000) : await new Promise(r => setTimeout(r, 1000));
      await takeScreenshot('master_ai_assistant_tab');
      console.log("AI Assistant tab clicked.");
    }

    if (tabButtons.length >= 3) {
      await tabButtons[2].click(); // Click AI Insights tab
      await page.waitForTimeout ? await page.waitForTimeout(1000) : await new Promise(r => setTimeout(r, 1000));
      await takeScreenshot('master_insights_tab');
      console.log("AI Insights tab clicked.");
    }

    // Go back to Overview
    if (tabButtons.length >= 1) {
      await tabButtons[0].click();
      await page.waitForTimeout ? await page.waitForTimeout(1000) : await new Promise(r => setTimeout(r, 1000));
    }

    // 7. Perform Logout
    console.log("Logging out of Master account...");
    await page.evaluate(() => {
      localStorage.clear();
      window.location.hash = '#/auth';
    });
    await page.reload({ waitUntil: 'networkidle2' });
    console.log("Session cleared, auth page reloaded.");
    await page.waitForTimeout ? await page.waitForTimeout(1500) : await new Promise(r => setTimeout(r, 1500));
    await takeScreenshot('logged_out');

    // 8. Re-skip Gates
    console.log("Handling Terms of Service Gate for Worker login...");
    const hasTerms2 = await page.evaluate(() => {
      const chk = document.querySelector('#terms');
      if (chk) {
        const label = document.querySelector('label[for="terms"]') || chk;
        label.click();
        return true;
      }
      return false;
    });

    if (hasTerms2) {
      console.log("Terms checkbox clicked for Worker login. Clicking CONFIRMER...");
      await page.waitForTimeout ? await page.waitForTimeout(500) : await new Promise(r => setTimeout(r, 500));
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const confirmBtn = buttons.find(b => b.textContent.includes('CONFIRMER') || b.textContent.includes('ACCÉDER'));
        if (confirmBtn) confirmBtn.click();
      });
      await page.waitForTimeout ? await page.waitForTimeout(1500) : await new Promise(r => setTimeout(r, 1500));
      await takeScreenshot('worker_after_terms');
    }

    console.log("Handling Activation/Skip Gate for Worker login...");
    const clickedTrialSkip2 = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const found = buttons.find(b => b.textContent.includes('Essai') || b.textContent.includes('trial') || b.textContent.includes('Trial'));
      if (found) {
        found.click();
        return true;
      }
      return false;
    });

    if (clickedTrialSkip2) {
      console.log("Clicked trial skip button for Worker login.");
      await page.waitForTimeout ? await page.waitForTimeout(1000) : await new Promise(r => setTimeout(r, 1000));
      await takeScreenshot('worker_after_trial_skip');
    }

    console.log("Checking for Landing Page 'Commencer' button for Worker login...");
    const hasGetStarted2 = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const startBtn = buttons.find(b => b.textContent.includes('Commencer') || b.textContent.includes('Get Started'));
      if (startBtn) {
        startBtn.click();
        return true;
      }
      return false;
    });

    if (hasGetStarted2) {
      console.log("Clicked 'Commencer' button for Worker login.");
      await page.waitForTimeout ? await page.waitForTimeout(1500) : await new Promise(r => setTimeout(r, 1500));
      await takeScreenshot('worker_after_commencer_click');
    }

    // 9. Perform Worker Login
    console.log("Entering Worker credentials...");
    await typeInInput('#login-email', 'jesse@worker.com');
    await typeInInput('#login-password', 'ximdu1-sowsyf-Mokkaz');
    await takeScreenshot('worker_credentials_entered');

    console.log("Submitting login form...");
    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form) {
        form.requestSubmit();
      } else {
        throw new Error("Could not find login form element!");
      }
    });

    // 10. Verify Worker Dashboard Redirection & Render
    console.log("Waiting for redirection to Worker dashboard...");
    await page.waitForFunction(() => window.location.hash.includes('/worker/dashboard'), { timeout: 15000 });
    console.log("Successfully redirected to Worker dashboard!");
    await page.waitForNetworkIdle({ idleTime: 1500 });
    await takeScreenshot('worker_dashboard');

    // 11. Verify Worker Layout active module
    const activeModuleText = await page.evaluate(() => {
      const span = document.querySelector('main span');
      return span ? span.textContent : null;
    });
    console.log("Worker Active Module:", activeModuleText);

    console.log("System verification completed successfully!");
  } catch (error) {
    console.error("❌ Verification failed with error:", error);
    await takeScreenshot('error_state');
  } finally {
    await browser.close();
    console.log("Browser closed.");
  }
})();
