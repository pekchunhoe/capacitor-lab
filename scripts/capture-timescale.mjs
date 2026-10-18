// Run against the local dev/preview server before and after the disclosure change.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const stage = process.argv[2] || 'after';
const url = process.argv[3] || 'http://127.0.0.1:5173/';
const directory = 'artifacts/timescale';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const [width, height] of [[320, 640], [360, 800], [390, 844], [430, 932], [768, 1024], [1024, 768], [834, 1194], [1194, 834], [1440, 1000]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    await page.goto(url);
    await page.getByRole('tab', { name: 'RC Circuits', exact: true }).click();
    await page.evaluate(() => document.fonts.ready);
    const measure = () => page.locator('#panel-1').evaluate(panel => {
      const rect = selector => panel.querySelector(selector).getBoundingClientRect();
      const circuit = rect('.experiment'), apparatus = rect('.apparatus'), time = rect('.time-constant'), graph = rect('.graphs-panel');
      return { circuitToGraph: graph.top - circuit.bottom, apparatusToGraph: graph.top - apparatus.bottom, panelHeight: time.height, panelToGraph: graph.top - time.bottom };
    });
    const collapsed = await measure();
    await page.locator('#panel-1 .time-constant').screenshot({ path: `${directory}/${stage}-${width}-panel.png` });
    await page.screenshot({ path: `${directory}/${stage}-${width}-page.png`, fullPage: true });
    let expanded;
    if (stage !== 'before') {
      await page.locator('#panel-1 .time-constant-toggle').click();
      expanded = await measure();
      await page.locator('#panel-1 .time-constant').screenshot({ path: `${directory}/${stage}-${width}-expanded.png` });
    }
    results.push({ width, height, collapsed, ...(expanded ? { expanded } : {}) });
    await page.close();
  }
  await writeFile(`${directory}/${stage}.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
