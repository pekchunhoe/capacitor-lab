import { test, expect, devices, type Page } from '@playwright/test';

async function checkMath(page: Page) {
  await expect(page.locator('.math-fallback, .katex-error')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const raw = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const problems: string[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode, parent = node.parentElement;
      if (!parent || parent.closest('.katex,script,style,[hidden]') || !parent.getClientRects().length) continue;
      if (/\\(?:frac|varepsilon|tau|mathrm)|e\^|\bexp\(|Vinitial|Ceq|SP025|\$/.test(node.textContent ?? '')) problems.push(node.textContent!);
    }
    return problems;
  });
  expect(raw).toEqual([]);
  const clipped = await page.locator('.display-math:visible').evaluateAll(nodes => nodes.filter(el => el.scrollHeight > el.clientHeight + 1).length);
  expect(clipped).toBe(0);
  const tooWide = await page.locator('.display-math:visible').evaluateAll(nodes => nodes.filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.querySelector('annotation')?.textContent));
  expect(tooWide).toEqual([]);
  const outside = await page.locator('.inline-math:visible').evaluateAll(nodes => nodes.filter(el => {
    const rect = el.getBoundingClientRect();
    const glyphs = [...el.querySelectorAll('.katex-html span')].filter(span => !span.children.length && span.textContent?.trim());
    return rect.left < -1 || rect.right > innerWidth + 1 || glyphs.some(span => {
      const glyph = span.getBoundingClientRect();
      return glyph.left < -1 || glyph.right > innerWidth + 1;
    });
  }).map(el => el.querySelector('annotation')?.textContent));
  expect(outside).toEqual([]);
}

test('all 36 challenge variants remain readable at 320px', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 320, height: 640 }); await page.goto('/');
  for (let tab = 0; tab < 3; tab++) {
    await page.getByRole('tab').nth(tab).click(); const panel = page.locator(`#panel-${tab}`);
    await panel.getByRole('button', { name: 'Challenges', exact: true }).click();
    for (const difficulty of ['Easy', 'Medium', 'Hard']) {
      await panel.getByRole('button', { name: difficulty, exact: true }).click();
      for (let variant = 0; variant < 4; variant++) {
        await panel.getByRole('button', { name: 'Hint', exact: true }).click();
        await panel.getByRole('button', { name: 'Worked solution', exact: true }).click();
        await checkMath(page);
        await panel.getByRole('button', { name: 'Next challenge', exact: false }).click();
      }
    }
  }
});

test('iPad touch layout preserves mathematical labels in portrait and landscape', async ({ browser }) => {
  const context = await browser.newContext({ ...devices['iPad Pro 11'], baseURL: 'http://127.0.0.1:5173' });
  try {
    const page = await context.newPage();
    for (const [width, height] of [[834, 1194], [1194, 834]]) {
      await page.setViewportSize({ width, height }); await page.goto('/');
      for (let tab = 0; tab < 3; tab++) {
        await page.getByRole('tab').nth(tab).tap();
        const panel = page.locator(`#panel-${tab}`);
        await panel.locator('.equation-explanation summary').tap();
        await checkMath(page);
        await page.screenshot({ path: `test-results/ipad-touch-${width}-${tab}.png`, fullPage: true });
      }
    }
  } finally { await context.close(); }
});

for (const [width, height] of [[320, 640], [360, 800], [390, 844], [430, 932], [768, 1024], [1024, 768], [834, 1194], [1194, 834], [1440, 1000]]) {
  test(`textbook equations across tabs and learning modes at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.setViewportSize({ width, height }); await page.goto('/');
    for (const [i, name] of ['Capacitance', 'RC Circuits', 'Dielectrics'].entries()) {
      await page.getByRole('tab', { name, exact: true }).click();
      const panel = page.locator(`#panel-${i}`);
      await expect(panel.locator('.equation math mfrac').first()).toBeAttached();
      await panel.locator('.equation-explanation summary').click();
      await panel.locator('details.model-notes:not(.equation-library) summary, details.learning-summary summary').evaluateAll(nodes => nodes.forEach(summary => (summary.parentElement as HTMLDetailsElement).open = true));
      if (i === 0) {
        await panel.getByRole('button', { name: 'Circuit builder', exact: true }).click(); await checkMath(page);
        await panel.getByRole('button', { name: 'Parallel', exact: true }).click(); await checkMath(page);
        await panel.getByRole('button', { name: 'Stored energy', exact: true }).click();
        await expect(panel.locator('.equation .display-math')).toHaveCount(3);
      } else {
        await panel.locator('.equation-library summary').click();
        await expect(panel.locator('.equation-library math mfrac').first()).toBeAttached();
      }
      if (i === 1) {
        const lesson = panel.locator('.equation-lesson');
        await expect(lesson.locator('.equation-section h3')).toHaveText(['Charging', 'Discharging', 'Time Constant']);
        await expect(lesson.locator('annotation')).toContainText([
          String.raw`Q=Q_0\left(1-e^{-\frac{t}{RC}}\right)`, String.raw`Q=Q_0e^{-\frac{t}{RC}}`, String.raw`\tau=RC`,
        ]);
        await expect(lesson).toContainText('does not apply unchanged when recharging a partially charged capacitor');
        await expect(lesson.getByText(/maximum charge in the charging equation/)).toBeVisible();
        await expect(lesson.locator('.equation-explanation p')).toBeVisible();
        const tex = await panel.locator('annotation').allTextContents();
        expect(tex.join(' ')).not.toMatch(/V_\\infty|t_0|V_\{C,0\}|I\(t\)=|V_C\(t\)=/);
      }
      if (i === 2) {
        const status = panel.locator('.dielectric-status');
        const air = status.locator('div').filter({ hasText: 'Air capacitance' });
        await expect(air.locator('annotation')).toHaveText('C_0');
        await expect(air.locator('math msub')).toHaveCount(1);
        await expect(air.locator('dd')).toHaveText('148 pF');
        await expect(status.locator('div').filter({ hasText: 'Dielectric constant' }).locator('dd')).toHaveText('4.000');
        await expect(status.locator('div').filter({ hasText: 'Capacitance ratio' }).locator('dd')).toHaveText('1.000');
        await expect(panel.locator('.equation annotation')).toContainText([String.raw`\varepsilon_r=\frac{C}{C_0}`]);
        // A CSS rule that turns KaTeX's nested spans into blocks separates C and 0.
        const geometry = await air.locator('.katex-html').evaluate(el => {
          const c = el.querySelector('.mathnormal')!.getBoundingClientRect();
          const zero = [...el.querySelectorAll('span')].find(span => !span.children.length && span.textContent === '0')!.getBoundingClientRect();
          const rect = el.getBoundingClientRect();
          return { c: { x: c.x, y: c.y, width: c.width, height: c.height }, zero: { x: zero.x, y: zero.y }, height: rect.height };
        });
        expect(geometry.zero.x).toBeGreaterThan(geometry.c.x + geometry.c.width * .6);
        expect(geometry.zero.y).toBeGreaterThan(geometry.c.y);
        expect(geometry.height).toBeLessThan(30);
        const boxes = await status.locator('div').evaluateAll(nodes => nodes.map(el => {
          const label = el.querySelector('dt')!.getBoundingClientRect(), value = el.querySelector('dd')!.getBoundingClientRect();
          const math = el.querySelector('.inline-math')!.getBoundingClientRect();
          return { fits: math.right <= label.right + 1 && math.left >= label.left - 1, sameRow: Math.abs(value.y - label.y) < 8 };
        }));
        expect(boxes.every(box => box.fits)).toBe(true);
        if (width <= 430) expect(boxes.every(box => box.sameRow)).toBe(true);
      }
      await checkMath(page);
      await panel.locator('.equation').screenshot({ path: `test-results/math-${width}-${i}.png` });
      if (i > 0) await panel.locator('.equation-library').screenshot({ path: `test-results/math-library-${width}-${i}.png` });
      if (i === 2) await panel.locator('.dielectric-status').screenshot({ path: `test-results/measurements-${width}.png` });
      await page.screenshot({ path: `test-results/audit-${width}-${i}.png`, fullPage: true });
      await panel.getByRole('button', { name: 'Predict', exact: true }).click();
      await panel.locator('.prediction-options button').first().click();
      await panel.getByRole('button', { name: 'Commit prediction & run' }).click();
      if (i === 1) await panel.getByRole('button', { name: 'Pause', exact: true }).click();
      await checkMath(page);
      await panel.getByRole('button', { name: 'Challenges', exact: true }).click();
      for (const difficulty of ['Easy', 'Medium', 'Hard']) {
        await panel.getByRole('button', { name: difficulty, exact: true }).click();
        await panel.getByRole('button', { name: 'Hint', exact: true }).click();
        await panel.getByRole('button', { name: 'Worked solution', exact: true }).click();
        await expect(panel.locator('.worked-solution .katex').first()).toBeVisible();
        await checkMath(page);
        if (width === 320 || width === 1440) await panel.locator('.challenge').screenshot({ path: `test-results/math-challenge-${width}-${i}-${difficulty}.png` });
      }
      await panel.getByRole('button', { name: 'Virtual experiment', exact: true }).click();
      if (i === 1) {
        await expect(panel.locator('.virtual-lab .eyebrow')).toHaveText('EXPERIMENT 1');
        await checkMath(page);
        const graphSymbol = panel.locator('.graph-title .inline-math');
        await expect(graphSymbol.locator('annotation')).toHaveText('V_C');
        expect(await graphSymbol.locator('.katex-html').evaluate(el => getComputedStyle(el).display)).toBe('inline');
        const box = await graphSymbol.boundingBox();
        expect(box!.height).toBeLessThan(30);
        await panel.getByRole('button', { name: 'Reveal reference answer', exact: true }).click();
      }
      await checkMath(page);
    }
    const fonts = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter(font => font.family.startsWith('KaTeX') && font.status === 'loaded').length; });
    expect(fonts).toBeGreaterThan(0);
    expect(await page.evaluate(() => [...document.fonts].filter(font => font.status === 'error').length)).toBe(0);
    expect(errors).toEqual([]);
  });
}
