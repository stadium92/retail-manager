#!/usr/bin/env node
// ESM-compatible PDF generator using Puppeteer.

import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import minimist from 'minimist';

function loadTemplate(templatePath) {
  return fs.readFileSync(templatePath, 'utf8');
}

function renderTemplate(template, data) {
  let out = template;
  // handle arrays
  out = out.replace(/\{\{#items\}\}([\s\S]*?)\{\{\/items\}\}/g, (m, p) => {
    if (!Array.isArray(data.items)) return '';
    return data.items.map(item => {
      return p.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (_, key) => {
        // nested keys not supported, simple lookup
        return item[key] ?? '';
      });
    }).join('');
  });
  // simple replacements
  out = out.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (_, key) => {
    return (data[key] !== undefined) ? data[key] : '';
  });
  return out;
}

async function generatePdf(html, outPath, pdfOptions={}){
  const chromePath = resolveChromeExecutable();
  const launchOptions = { args:['--no-sandbox','--disable-setuid-sandbox'] };
  if (chromePath) launchOptions.executablePath = chromePath;
  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf(Object.assign({ path: outPath, printBackground: true }, pdfOptions));
  await browser.close();
}

function resolveChromeExecutable(){
  const candidates = [
    process.env.CHROME_PATH,
    process.env.GOOGLE_CHROME_BIN,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary'
  ].filter(Boolean);
  for (const p of candidates){
    try{
      if (fs.existsSync(p)) return p;
    }catch(e){/* ignore */}
  }
  return null;
}

async function main(){
  const argv = minimist(process.argv.slice(2));
  const tpl = argv.template || 'templates/ticket.html';
  const dataFile = argv.data || null;
  const out = argv.out || 'out/output.pdf';
  const a4 = argv.a4 || false;

  if (!fs.existsSync(tpl)){
    console.error('Template not found:', tpl);
    process.exit(1);
  }

  let data = {};
  if (dataFile){
    if (!fs.existsSync(dataFile)){
      console.error('Data file not found:', dataFile);
      process.exit(1);
    }
    data = JSON.parse(fs.readFileSync(dataFile,'utf8'));
  }

  const template = loadTemplate(tpl);
  const html = renderTemplate(template, data);

  // ensure out dir
  const outDir = path.dirname(out);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive:true });

  const pdfOptions = a4 ? { format: 'A4' } : { width: '80mm' };

  console.log('Generating PDF ->', out);
  await generatePdf(html, out, pdfOptions);
  console.log('Done');
}

main().catch(err => { console.error(err); process.exit(1); });
