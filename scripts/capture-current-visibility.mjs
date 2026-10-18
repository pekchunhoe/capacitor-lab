// Capture actual browser displacement before/after visual calibration.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const stage = process.argv[2] || 'after';
const url = process.argv[3] || 'http://127.0.0.1:5173/';
const directory = 'artifacts/current-visibility';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch(); const results = [];
try {
  for (const [width, height] of [[320, 640], [390, 844], [834, 1194], [1194, 834], [1440, 1000]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.clock.install({ time: new Date('2026-10-18T00:00:00Z') });
    await page.goto(url); await page.getByRole('tab', { name: 'RC Circuits', exact: true }).click();
    await page.clock.pauseAt(new Date('2026-10-18T00:00:10Z'));
    const panel = page.locator('#panel-1');
    const sample = () => panel.evaluate(el => {
      const flow = el.querySelector('.current-flow'), scene = el.querySelector('.rc-scene'), matrix = scene.getScreenCTM();
      return { time: +flow.dataset.time, current: +flow.dataset.current, phase: +flow.dataset.phase, speed: +flow.dataset.speed,
        svgScale: Math.hypot(matrix.a, matrix.b), currentLabel: el.querySelectorAll('.readings dd')[3].textContent,
        graphCurrent: el.querySelectorAll('.graph-title strong')[1].textContent,
        markers: [...flow.querySelectorAll('.current-particle')].map(circle => ({ x: +circle.getAttribute('cx'), y: +circle.getAttribute('cy'), distance: +circle.dataset.distance })) };
    });
    const intervals = {};
    for (const mode of ['charge', 'discharge']) {
      await panel.getByRole('button', { name: mode === 'charge' ? 'Charge' : 'Discharge', exact: true }).click();
      const samples = [await sample()];
      for (let step = 1; step <= 12; step++) {
        await page.clock.runFor(250); samples.push(await sample());
        if ([1, 4, 12].includes(step)) await panel.locator('.experiment').screenshot({ path: `${directory}/${stage}-${width}-${mode}-${step}.png` });
      }
      const a = samples[0], b = samples[1];
      intervals[mode] = { initialSpeed: Math.abs(a.speed), initialCssSpeed: Math.abs(a.speed) * a.svgScale,
        measuredInitialRate: Math.abs((b.phase - a.phase) / (b.time - a.time)),
        measuredInitialCssRate: Math.abs((b.phase - a.phase) / (b.time - a.time)) * a.svgScale, samples };
      if (mode === 'charge') await page.clock.runFor(6000); // existing 8-tau trial limit
    }
    results.push({ width, height, ...intervals }); await page.close();
  }
  await writeFile(`${directory}/${stage}.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results.map(({ width, charge, discharge }) => ({ width,
    charge: { svgSpeed: charge.initialSpeed, cssSpeed: charge.initialCssSpeed, measuredCssRate: charge.measuredInitialCssRate },
    discharge: { svgSpeed: discharge.initialSpeed, cssSpeed: discharge.initialCssSpeed, measuredCssRate: discharge.measuredInitialCssRate } }))));
} finally { await browser.close(); }
