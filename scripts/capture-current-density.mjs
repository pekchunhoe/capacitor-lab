// Compare density, signed displacement, graph data and local rendering cost.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const stage = process.argv[2] || 'after';
const url = process.argv[3] || 'http://127.0.0.1:5173/';
const directory = 'artifacts/current-density';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const captures = [], performance = [];
try {
  for (const [width, height] of [[320, 640], [360, 800], [390, 844], [430, 932], [834, 1194], [1194, 834], [1440, 1000]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.clock.install({ time: new Date('2026-10-18T00:00:00Z') });
    await page.goto(url); await page.getByRole('tab', { name: 'RC Circuits', exact: true }).click();
    await page.clock.pauseAt(new Date('2026-10-18T00:00:10Z'));
    const panel = page.locator('#panel-1'), modes = {};
    for (const mode of ['charge', 'discharge']) {
      await panel.getByRole('button', { name: mode === 'charge' ? 'Charge' : 'Discharge', exact: true }).click();
      const samples = [];
      for (let step = 0; step <= 12; step++) {
        if (step) await page.clock.runFor(250);
        samples.push(await panel.evaluate(el => {
          const flow = el.querySelector('.current-flow'), matrix = el.querySelector('.rc-scene').getScreenCTM();
          return { time: +flow.dataset.time, current: +flow.dataset.current, phase: +flow.dataset.phase, speed: +flow.dataset.speed,
            svgScale: Math.hypot(matrix.a, matrix.b), readouts: [...el.querySelectorAll('.readings dd')].map(node => node.textContent),
            graphReadouts: [...el.querySelectorAll('.graph-title strong')].map(node => node.textContent),
            graphCurves: [...el.querySelectorAll('.graph path')].map(node => node.getAttribute('d')),
            paths: [...flow.querySelectorAll('[data-current-path]')].map(path => ({ name: path.dataset.currentPath,
              length: path.querySelector('.current-conductor').getTotalLength(),
              markers: [...path.querySelectorAll('.current-particle')].map(circle => ({ distance: +circle.dataset.distance,
                x: +circle.getAttribute('cx'), y: +circle.getAttribute('cy'), opacity: +circle.getAttribute('opacity') })) })) };
        }));
        if ([1, 4, 12].includes(step)) await panel.locator('.experiment').screenshot({ path: `${directory}/${stage}-${width}-${mode}-${step}.png` });
      }
      modes[mode] = samples;
      if (mode === 'charge') await page.clock.runFor(6000);
    }
    captures.push({ width, height, ...modes }); await page.close();
  }
  // Relative workstation comparison only; CPU throttling is not phone emulation.
  for (const [width, height] of [[390, 844], [834, 1194]]) for (const cpuRate of [1, 4]) for (let run = 1; run <= 3; run++) {
    const page = await browser.newPage({ viewport: { width, height } });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
    await page.goto(url); await page.getByRole('tab', { name: 'RC Circuits', exact: true }).click();
    await page.locator('#panel-1').getByRole('button', { name: 'Charge', exact: true }).click();
    const measurement = await page.evaluate(async () => {
      const flow = document.querySelector('#panel-1 .current-flow'), deltas = [];
      let longTasks = 0, particleMounts = 0, particleRemovals = 0, commits = 0;
      const observer = new PerformanceObserver(list => { longTasks += list.getEntries().length; });
      observer.observe({ type: 'longtask', buffered: false });
      const mutations = new MutationObserver(records => {
        for (const record of records) {
          if (record.type === 'attributes') commits++;
          else {
            particleMounts += [...record.addedNodes].filter(node => node instanceof Element && node.matches('.current-particle')).length;
            particleRemovals += [...record.removedNodes].filter(node => node instanceof Element && node.matches('.current-particle')).length;
          }
        }
      });
      mutations.observe(flow, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-time'] });
      await new Promise(resolve => {
        const start = window.performance.now(); let previous = start;
        const frame = now => { deltas.push(now - previous); previous = now; if (now - start < 1200) requestAnimationFrame(frame); else resolve(); };
        requestAnimationFrame(frame);
      });
      mutations.disconnect(); observer.disconnect(); deltas.shift(); deltas.sort((a, b) => a - b);
      return { frames: deltas.length, medianFrameMs: deltas[Math.floor(deltas.length / 2)], p95FrameMs: deltas[Math.floor(deltas.length * .95)],
        longTasks, particleMounts, particleRemovals, commits, particles: flow.querySelectorAll('.current-particle').length };
    });
    performance.push({ width, height, cpuRate, run, ...measurement }); await page.close();
  }
  await writeFile(`${directory}/${stage}.json`, JSON.stringify({ captures, performance }, null, 2));
  console.log(JSON.stringify({ stage, viewports: captures.length, particles: captures.map(item => ({ width: item.width,
    charge: item.charge[0].paths.reduce((n, path) => n + path.markers.length, 0), discharge: item.discharge[0].paths.reduce((n, path) => n + path.markers.length, 0) })), performance }));
} finally { await browser.close(); }
