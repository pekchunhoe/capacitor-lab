import { test, expect, type Page } from '@playwright/test';

const panel = (page: Page) => page.locator('#panel-1');
async function setup(page: Page, width = 390, height = 844) {
  await page.setViewportSize({ width, height });
  await page.clock.install({ time: new Date('2026-10-18T00:00:00Z') });
  await page.goto('/'); await page.getByRole('tab', { name: 'RC Circuits', exact: true }).click();
  await page.clock.pauseAt(new Date('2026-10-18T00:00:10Z'));
  await page.evaluate(() => document.fonts.ready);
}
async function snapshot(page: Page) {
  return panel(page).evaluate(el => {
    const flow = el.querySelector<SVGGElement>('.current-flow')!, scene = el.querySelector<SVGSVGElement>('.rc-scene')!;
    const number = (key: string) => Number(flow.dataset[key]);
    const graph = el.querySelectorAll('.graph svg')[1], cursor = graph.querySelector('circle')!;
    const matrix = scene.getScreenCTM()!;
    return { time: number('time'), current: number('current'), phase: number('phase'), speed: number('speed'), motionSpeed: number('motionSpeed'), direction: number('direction'), svgScale: Math.hypot(matrix.a, matrix.b),
      reduced: flow.dataset.reducedMotion, animations: scene.getAnimations({ subtree: true }).length,
      readouts: [...el.querySelectorAll('.readings dd')].map(node => node.textContent),
      graphCurrent: el.querySelectorAll('.graph-title strong')[1].textContent,
      graphTimeEnd: Number(el.querySelector<HTMLInputElement>('[aria-label="Graph inspection time"]')!.max),
      graphCursor: { x: Number(cursor.getAttribute('cx')), y: Number(cursor.getAttribute('cy')) },
      paths: [...flow.querySelectorAll<SVGGElement>('[data-current-path]')].map(path => ({ name: path.dataset.currentPath,
        length: path.querySelector<SVGPathElement>('.current-conductor')!.getTotalLength(),
        markers: [...path.querySelectorAll<SVGCircleElement>('.current-particle')].map(circle => ({
          distance: Number(circle.dataset.distance), x: Number(circle.getAttribute('cx')), y: Number(circle.getAttribute('cy')),
        })),
      })),
    };
  });
}
type Snapshot = Awaited<ReturnType<typeof snapshot>>;
function checkDensity(state: Snapshot) {
  const expected: Record<string, number> = { upper: 12, lower: 12, supply: 4, return: 4, shunt: 8 };
  expect(state.paths.reduce((count, path) => count + path.markers.length, 0)).toBe(32);
  for (const path of state.paths) {
    expect(path.markers).toHaveLength(expected[path.name!]);
    const sorted = path.markers.map(marker => marker.distance).sort((a, b) => a - b);
    const spacing = path.length / sorted.length;
    expect(spacing * state.svgScale).toBeGreaterThan(12);
    sorted.forEach((distance, index) => {
      const next = sorted[(index + 1) % sorted.length];
      expect(((next - distance) % path.length + path.length) % path.length).toBeCloseTo(spacing, 3);
    });
  }
}
function checkSync(state: Snapshot, direction: number, peakCurrent = .0012) {
  checkDensity(state);
  expect(state.animations).toBe(0); expect(state.direction).toBe(direction);
  expect(Math.sign(state.current)).toBe(direction); expect(Math.sign(state.speed)).toBe(direction);
  expect(state.speed).toBeCloseTo(88 * state.current / peakCurrent, 9);
  expect(state.graphCurrent).toBe(state.readouts[3]);
  expect(Math.sign(parseFloat(state.readouts[3]!))).toBe(direction);
  expect(state.graphCursor.x).toBeCloseTo(82 + state.time / state.graphTimeEnd * 454, 7);
  expect(state.graphCursor.y).toBeCloseTo(168 - (state.current + peakCurrent) / (2 * peakCurrent) * 140, 7);
  for (const path of state.paths) for (const marker of path.markers) {
    expect(marker.x >= 507 && marker.x <= 593 && marker.y > 139 && marker.y < 161).toBe(false);
    if (direction < 0) expect(marker.x).toBeGreaterThanOrEqual(160);
  }
}
function movement(previous: Snapshot, next: Snapshot, direction: number) {
  const delta = next.phase - previous.phase, elapsed = next.time - previous.time;
  expect(delta * direction).toBeGreaterThanOrEqual(0);
  expect(Math.abs(next.speed)).toBeLessThanOrEqual(Math.abs(previous.speed));
  if (elapsed > 0) {
    const rate = Math.abs(delta / elapsed);
    expect(rate).toBeLessThanOrEqual(Math.abs(previous.speed) + 1e-6);
    expect(rate).toBeGreaterThanOrEqual(Math.abs(next.speed) - 1e-6);
  }
  let wraps = 0;
  for (const path of next.paths) {
    const before = previous.paths.find(other => other.name === path.name)!;
    path.markers.forEach((marker, index) => {
      const difference = marker.distance - before.markers[index].distance, length = path.length;
      const travelled = ((difference + length / 2) % length + length) % length - length / 2;
      expect(travelled).toBeCloseTo(delta, 3);
      if (difference * direction < 0) wraps++;
    });
  }
  return wraps;
}

for (const [width, height] of [[320, 640], [360, 800], [390, 844], [430, 932], [834, 1194], [1194, 834], [1440, 1000]]) {
  test(`controlled charging frames keep direction, slow smoothly and match graphs at ${width}px`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' || (message.type() === 'warning' && /animation/i.test(message.text()))) errors.push(message.text()); });
    await setup(page, width, height);
    await panel(page).getByRole('button', { name: 'Charge', exact: true }).click();
    const samples = [await snapshot(page)]; let wraps = 0;
    expect(samples[0].speed).toBe(88);
    expect(samples[0].speed * samples[0].svgScale).toBeGreaterThan(35);
    for (let step = 1; step <= 24; step++) {
      await page.clock.runFor(250); const state = await snapshot(page);
      checkSync(state, 1); wraps += movement(samples.at(-1)!, state, 1);
      expect(state.current).toBeCloseTo(.0012 * Math.exp(-state.time), 12);
      samples.push(state);
      if (step === 1) {
        const measuredCssRate = (state.phase - samples[0].phase) / (state.time - samples[0].time) * state.svgScale;
        expect(measuredCssRate).toBeGreaterThan(30);
      }
      if ([1, 4, 12, 20].includes(step)) await panel(page).locator('.experiment').screenshot({ path: `artifacts/rc-current/charge-${width}-${step}.png` });
    }
    expect(samples.at(-1)!.time).toBeGreaterThan(5);
    expect(wraps).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(panel(page).locator('.time-constant-toggle')).toHaveAttribute('aria-expanded', 'false');
    await testInfo.attach('signed-motion-samples', { body: JSON.stringify(samples, null, 2), contentType: 'application/json' });
    expect(errors).toEqual([]);
  });
}

test('fully charged discharge uses the reverse shunt loop and slows for five time constants', async ({ page }, testInfo) => {
  await setup(page); const rc = panel(page);
  await rc.getByRole('button', { name: 'Charge', exact: true }).click(); await page.clock.runFor(8500);
  const before = await snapshot(page);
  await rc.getByRole('button', { name: 'Discharge', exact: true }).click();
  const initial = await snapshot(page);
  expect(initial.readouts.slice(1, 3)).toEqual(before.readouts.slice(1, 3));
  expect(initial.phase).toBeCloseTo(before.phase, 12);
  expect(initial.paths.map(path => path.name)).toEqual(['upper', 'lower', 'shunt']);
  expect(Math.abs(initial.speed)).toBeGreaterThan(87);
  const samples = [initial]; let wraps = 0;
  for (let step = 1; step <= 24; step++) {
    await page.clock.runFor(250); const state = await snapshot(page);
    checkSync(state, -1); wraps += movement(samples.at(-1)!, state, -1);
    expect(state.current).toBeCloseTo(initial.current * Math.exp(-(state.time - initial.time)), 12);
    samples.push(state);
    if (step === 1) {
      const measuredCssRate = Math.abs((state.phase - initial.phase) / (state.time - initial.time)) * state.svgScale;
      expect(measuredCssRate).toBeGreaterThan(35);
    }
    if ([1, 4, 12, 20].includes(step)) await rc.locator('.experiment').screenshot({ path: `artifacts/rc-current/discharge-390-${step}.png` });
  }
  expect(wraps).toBeGreaterThan(0);
  await testInfo.attach('signed-motion-samples', { body: JSON.stringify(samples, null, 2), contentType: 'application/json' });
});

test('partial discharge and recharging retain phase and shared-wire particle positions', async ({ page }) => {
  await setup(page); const rc = panel(page);
  await rc.getByRole('button', { name: 'Charge', exact: true }).click(); await page.clock.runFor(1050);
  for (const [action, direction] of [['Discharge', -1], ['Charge', 1], ['Discharge', -1]] as const) {
    const before = await snapshot(page), voltage = before.direction > 0 ? 12 - before.current * 1e4 : -before.current * 1e4;
    await rc.getByRole('button', { name: action, exact: true }).click(); const after = await snapshot(page);
    expect(after.phase).toBeCloseTo(before.phase, 12);
    expect(after.current).toBeCloseTo(((direction > 0 ? 12 : 0) - voltage) / 1e4, 12);
    expect(after.readouts.slice(1, 3)).toEqual(before.readouts.slice(1, 3));
    expect(after.paths.slice(0, 2)).toEqual(before.paths.slice(0, 2));
    checkSync(after, direction);
    await page.clock.runFor(400); const later = await snapshot(page);
    movement(after, later, direction); checkSync(later, direction);
  }
});

test('repeated pause/resume and playback changes preserve phase and apply speed only once', async ({ page }) => {
  await setup(page); const rc = panel(page);
  await rc.getByRole('button', { name: 'Charge', exact: true }).click(); await page.clock.runFor(400);
  for (const speed of ['0.25', '1', '2', '5']) {
    await rc.getByRole('button', { name: 'Pause', exact: true }).click();
    const before = await snapshot(page);
    expect(before.motionSpeed).toBe(0); await page.clock.runFor(1500);
    expect(await snapshot(page)).toEqual(before);
    await rc.getByLabel('Playback speed').selectOption(speed);
    expect((await snapshot(page)).phase).toBe(before.phase);
    await rc.getByRole('button', { name: 'Resume', exact: true }).click();
    expect((await snapshot(page)).paths).toEqual(before.paths);
    await page.clock.runFor(200); const after = await snapshot(page);
    expect(after.time - before.time).toBeGreaterThan(.13 * Number(speed));
    expect(after.time - before.time).toBeLessThanOrEqual(.21 * Number(speed));
    checkSync(after, 1); movement(before, after, 1);
  }
});

test('zero current and reduced motion keep stationary markers with accurate sign indicators', async ({ page }) => {
  await setup(page); const rc = panel(page);
  await rc.getByRole('button', { name: 'Discharge', exact: true }).click();
  const zero = await snapshot(page); expect(zero.current).toBe(0); expect(zero.speed).toBe(0);
  checkDensity(zero);
  await page.clock.runFor(700); const next = await snapshot(page);
  expect(next.paths).toEqual(zero.paths); expect(next.phase).toBe(zero.phase);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await rc.getByRole('button', { name: 'Charge', exact: true }).click();
  const still = await snapshot(page);
  await page.clock.runFor(500); const later = await snapshot(page);
  expect(later.reduced).toBe('true'); expect(later.motionSpeed).toBe(0); expect(later.paths).toEqual(still.paths);
  checkSync(later, 1); await expect(rc.locator('.current-direction-arrow')).toHaveCount(4);
  await rc.getByRole('button', { name: 'Discharge', exact: true }).click();
  await expect(rc.getByRole('img', { name: /RC circuit,/ })).toHaveAccessibleName(/opposite to the charging reference/);
  const reversed = await snapshot(page); await page.clock.runFor(500);
  expect((await snapshot(page)).paths).toEqual(reversed.paths);
  await expect(rc.locator('.current-direction-arrow')).toHaveCount(3);
  await rc.locator('.experiment').screenshot({ path: 'artifacts/rc-current/reduced-motion-discharge.png' });
});

test('variable frame delivery and stalls do not reverse markers at maximum current and 5× playback', async ({ page }) => {
  await setup(page, 320, 640); const rc = panel(page);
  await rc.getByRole('spinbutton', { name: 'Resistance', exact: true }).fill('1');
  await rc.getByRole('spinbutton', { name: 'RC capacitance', exact: true }).fill('500');
  await rc.getByRole('spinbutton', { name: 'Supply voltage', exact: true }).fill('24');
  await rc.getByLabel('Playback speed').selectOption('5');
  await rc.getByRole('button', { name: 'Charge', exact: true }).click();
  let before = await snapshot(page);
  for (const gap of [16, 16, 80, 500, 16, 33, 1000, 16, 16]) {
    // fastForward delivers delayed callbacks once, exercising actual frame stalls.
    await page.clock.fastForward(gap); const after = await snapshot(page);
    checkSync(after, 1, .024); movement(before, after, 1);
    expect(after.current).toBeCloseTo(.024 * Math.exp(-after.time / .5), 12);
    // Dense particles retain their identities across missed frames. Their
    // signed displacement, checked by movement(), is not a nearest-dot match.
    for (const path of after.paths) expect(after.phase - before.phase).toBeLessThan(path.length / 2);
    before = after;
  }
});

test('dense particles reuse DOM nodes through decay, equilibrium, pause and resume', async ({ page }) => {
  await setup(page); const rc = panel(page);
  await rc.getByRole('button', { name: 'Charge', exact: true }).click();
  const identities = await rc.locator('.current-flow').evaluateHandle(flow => [...flow.querySelectorAll('.current-particle')]);
  try {
    let before = await snapshot(page);
    for (const interval of [250, 750, 2000, 2000, 2000]) {
      await page.clock.runFor(interval); const after = await snapshot(page);
      checkSync(after, 1); movement(before, after, 1);
      expect(await identities.evaluate(nodes => nodes.length === 32 && nodes.every(node => node.isConnected))).toBe(true);
      before = after;
    }
    expect(Math.abs(before.speed)).toBeLessThan(.1);
    await rc.getByRole('button', { name: 'Pause', exact: true }).click();
    const paused = await snapshot(page); await page.clock.runFor(500);
    expect(await snapshot(page)).toEqual(paused);
    await rc.getByRole('button', { name: 'Resume', exact: true }).click();
    expect((await snapshot(page)).paths).toEqual(paused.paths);
    await page.clock.runFor(2000);
    const equilibrium = await snapshot(page);
    checkDensity(equilibrium); expect(equilibrium.time).toBe(8); expect(equilibrium.motionSpeed).toBe(0);
    expect(await identities.evaluate(nodes => nodes.every(node => node.isConnected))).toBe(true);
    await page.clock.runFor(500); expect(await snapshot(page)).toEqual(equilibrium);
  } finally { await identities.dispose(); }
});
