import { test, expect, type Page } from '@playwright/test';

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
}

for (const [width, height] of [[320, 640], [360, 800], [390, 844], [430, 932], [768, 1024], [1440, 1000]]) {
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
      if (i === 0) {
        await panel.getByRole('button', { name: 'Circuit builder', exact: true }).click(); await checkMath(page);
        await panel.getByRole('button', { name: 'Parallel', exact: true }).click(); await checkMath(page);
        await panel.getByRole('button', { name: 'Stored energy', exact: true }).click();
        await expect(panel.locator('.equation .display-math')).toHaveCount(3);
      } else {
        await panel.locator('.equation-library summary').click();
        await expect(panel.locator('.equation-library math msup').first()).toBeAttached();
      }
      await checkMath(page);
      if (width === 320 || width === 390 || width === 1440) {
        await panel.locator('.equation').screenshot({ path: `test-results/math-${width}-${i}.png` });
        if (i > 0) await panel.locator('.equation-library').screenshot({ path: `test-results/math-library-${width}-${i}.png` });
      }
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
