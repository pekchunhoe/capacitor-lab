import { test, expect, devices, type Locator, type Page } from '@playwright/test';

const rc = (page: Page) => page.locator('#panel-1');
const toggle = (page: Page) => rc(page).getByRole('button', { name: /^Time Constant:/ });
async function openRC(page: Page) {
  await page.goto('/'); await page.getByRole('tab', { name: 'RC Circuits', exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
}
async function layout(panel: Locator) {
  return panel.evaluate(el => {
    const box = (selector: string) => el.querySelector(selector)!.getBoundingClientRect();
    const circuit = box('.experiment'), time = box('.time-constant'), graph = box('.graphs-panel'), parameters = box('.control-panel');
    return { height: time.height, distance: graph.top - circuit.bottom, gap: graph.top - time.bottom,
      circuitGap: time.top - circuit.bottom, parametersAfterGraph: parameters.top >= graph.bottom };
  });
}

for (const [width, height] of [[320, 640], [360, 800], [390, 844], [430, 932], [768, 1024], [1024, 768], [834, 1194], [1194, 834], [1440, 1000]]) {
  test(`compact time constant disclosure at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.setViewportSize({ width, height }); await openRC(page);
    const panel = rc(page), button = toggle(page), explanation = panel.locator('.time-constant-explanation');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(button).toHaveAccessibleName('Time Constant: 1 s');
    await expect(button.locator('annotation')).toHaveText(String.raw`\tau=RC=1\,\mathrm{s}`);
    await expect(button.locator('.katex-display')).toHaveCount(0);
    await expect(explanation).toBeHidden();
    expect(await explanation.evaluate(el => el.getBoundingClientRect().height)).toBe(0);
    expect(await button.getAttribute('aria-controls')).toBe(await explanation.getAttribute('id'));
    const collapsed = await layout(panel);
    expect(collapsed.height).toBeGreaterThanOrEqual(56); expect(collapsed.height).toBeLessThanOrEqual(80);
    expect(collapsed.gap).toBeLessThanOrEqual(12); expect(collapsed.distance).toBeLessThanOrEqual(100);
    expect(collapsed.circuitGap).toBeGreaterThanOrEqual(0);
    if (width <= 780) expect(collapsed.parametersAfterGraph).toBe(true);
    await panel.locator('.time-constant').screenshot({ path: `test-results/timescale-${width}-collapsed.png` });
    // Click the title side of the header, rather than requiring the chevron.
    await button.click({ position: { x: 20, y: 20 } });
    await expect(button).toHaveAttribute('aria-expanded', 'true'); await expect(explanation).toBeVisible();
    await expect(explanation).toContainText('THE CIRCUIT’S NATURAL TIMESCALE');
    for (const percentage of ['63.2%', '36.8%', '99.3%']) await expect(explanation).toContainText(percentage);
    const expanded = await layout(panel);
    expect(expanded.height).toBeGreaterThan(collapsed.height + 100);
    expect(expanded.distance - collapsed.distance).toBeCloseTo(expanded.height - collapsed.height, 1);
    const mathFits = await panel.locator('.time-constant .inline-math:visible, .time-constant .display-math:visible').evaluateAll(nodes => nodes.every(el => el.scrollWidth <= el.clientWidth + 2));
    expect(mathFits).toBe(true);
    const buttonBox = (await button.boundingBox())!, chevronBox = (await button.locator('svg').boundingBox())!;
    expect(chevronBox.x + chevronBox.width).toBeLessThanOrEqual(buttonBox.x + buttonBox.width);
    await panel.locator('.time-constant').screenshot({ path: `test-results/timescale-${width}-expanded.png` });
    await button.locator('svg').click();
    await expect(button).toHaveAttribute('aria-expanded', 'false'); await expect(explanation).toBeHidden();
    expect((await layout(panel)).distance).toBeCloseTo(collapsed.distance, 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('.math-fallback, .katex-error')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('time constant updates in seconds; keyboard toggle preserves paused state and graph cursor', async ({ page }) => {
  await openRC(page); const panel = rc(page), button = toggle(page);
  await panel.getByRole('spinbutton', { name: 'Resistance', exact: true }).fill('20');
  await expect(button).toHaveAccessibleName('Time Constant: 2 s');
  await panel.getByRole('spinbutton', { name: 'RC capacitance', exact: true }).fill('250');
  await expect(button.locator('annotation')).toHaveText(String.raw`\tau=RC=5\,\mathrm{s}`);
  await panel.getByRole('spinbutton', { name: 'Resistance', exact: true }).fill('1');
  await panel.getByRole('spinbutton', { name: 'RC capacitance', exact: true }).fill('10');
  await expect(button.locator('annotation')).toHaveText(String.raw`\tau=RC=0.01\,\mathrm{s}`);
  await panel.getByRole('spinbutton', { name: 'Resistance', exact: true }).fill('10');
  await panel.getByRole('spinbutton', { name: 'RC capacitance', exact: true }).fill('100');
  await panel.getByLabel('Playback speed').selectOption('0.25');
  await panel.getByRole('slider', { name: 'Graph inspection time' }).fill('2');
  const before = await panel.locator('.readings dd').allTextContents();
  const graphs = await panel.locator('.graphs-panel').innerHTML();
  await button.focus(); await page.keyboard.press('Enter');
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await expect(button).toBeFocused(); await page.keyboard.press('Space');
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  expect(await panel.locator('.readings dd').allTextContents()).toEqual(before);
  expect(await panel.locator('.graphs-panel').innerHTML()).toBe(graphs);
  await expect(panel.getByLabel('Playback speed')).toHaveValue('0.25');
  await expect(panel.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Virtual experiment', exact: true }).click();
  await expect(button).toHaveAccessibleName('Time Constant: unknown');
  await expect(button.locator('annotation')).toHaveText(String.raw`\tau=RC=?`);
  await button.click(); await expect(panel.locator('.time-constant-explanation annotation')).toHaveText(String.raw`\tau=RC=?`);
  await panel.getByRole('button', { name: 'Reveal reference answer', exact: true }).click();
  await expect(button).toHaveAccessibleName('Time Constant: 1.2 s');
});

test('charging and discharging continue with synchronized graphs while toggling', async ({ page }) => {
  await openRC(page); const panel = rc(page), button = toggle(page);
  await panel.getByRole('spinbutton', { name: 'Resistance', exact: true }).fill('100');
  await panel.getByRole('button', { name: 'Charge', exact: true }).click();
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  const time = () => panel.locator('.readings dd').first().innerText().then(parseFloat);
  await expect.poll(time).toBeGreaterThan(.1);
  const beforeCharge = await time();
  await button.click(); await button.click();
  await expect.poll(time).toBeGreaterThan(beforeCharge + .1);
  await expect(panel.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Discharge', exact: true }).click();
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  const beforeDischarge = await time();
  await button.click(); await button.click();
  await expect.poll(time).toBeGreaterThan(beforeDischarge + .1);
  await expect(panel.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Pause', exact: true }).click();
  const readings = await panel.locator('.readings dd').allTextContents();
  expect(parseFloat(readings[1])).toBeGreaterThan(0); expect(parseFloat(readings[3])).toBeLessThan(0);
  expect(await panel.locator('.graph-title strong').allTextContents()).toEqual([readings[2], readings[3]]);
  const frozen = await panel.locator('.readings dd').allTextContents();
  await button.click(); await button.click();
  expect(await panel.locator('.readings dd').allTextContents()).toEqual(frozen);
});

test('touch toggles preserve virtual experiment measurements in tablet portrait and landscape', async ({ browser }) => {
  const context = await browser.newContext({ ...devices['iPad Pro 11'], baseURL: 'http://127.0.0.1:5173' });
  try {
    const page = await context.newPage(); await openRC(page); const panel = rc(page), button = toggle(page);
    await panel.getByRole('button', { name: 'Virtual experiment', exact: true }).tap();
    await panel.getByRole('button', { name: 'Record reading', exact: true }).tap();
    await panel.getByRole('button', { name: 'Advance 0.2 s', exact: true }).tap();
    await panel.getByRole('button', { name: 'Record reading', exact: true }).tap();
    await panel.getByRole('spinbutton', { name: 'Measured time constant' }).fill('1.2');
    const readings = await panel.locator('.virtual-lab tbody').innerText();
    for (const [width, height] of [[834, 1194], [1194, 834]]) {
      await page.setViewportSize({ width, height });
      await button.tap(); await expect(button).toHaveAttribute('aria-expanded', 'true');
      await button.tap(); await expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(await panel.locator('.virtual-lab tbody').innerText()).toBe(readings);
      await expect(panel.getByRole('spinbutton', { name: 'Measured time constant' })).toHaveValue('1.2');
    }
  } finally { await context.close(); }
});
