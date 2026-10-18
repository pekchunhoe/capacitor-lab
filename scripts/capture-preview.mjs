// Visual QA against a running `npm run dev` server.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const directory = new URL('../artifacts/', import.meta.url);
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const url = process.argv[2] || 'http://127.0.0.1:5173/';
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(url);
    for (let tab = 0; tab < 3; tab++) {
      await page.getByRole('tab').nth(tab).click();
      const panel = page.locator(`#panel-${tab}`);
      if (tab === 1) {
        await panel.getByRole('slider', { name: 'Graph inspection time' }).fill('1');
        await panel.getByRole('button', { name: 'Replay from here' }).click();
      }
      if (tab === 2) await panel.getByRole('button', { name: 'Fully insert dielectric' }).click();
      await page.screenshot({ path: fileURLToPath(new URL(`lab-${tab + 1}-${width}.png`, directory)), fullPage: true });
      const apparatus = await panel.locator('.experiment').boundingBox();
      const controls = await panel.locator('.control-panel').boundingBox();
      if (width === 390) {
        const preceding = tab === 1 ? await panel.locator('.graphs-panel').boundingBox() : apparatus;
        if (!preceding || !controls || Math.abs(controls.y - preceding.y - preceding.height) > 25) throw new Error('Mobile parameters must follow RC graphs, or the apparatus on the other tabs.');
      }
    }
    if (errors.length) throw new Error(errors.join('\n'));
    await page.close();
  }
  console.log('Six desktop/mobile screenshots captured; mobile apparatus/graph/parameter ordering checked.');
} finally { await browser.close(); }
