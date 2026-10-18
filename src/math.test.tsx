import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DisplayMath, InlineMath, MathText, mathNumber, quantity, renderMath } from './math';
import { equations } from './equations';
import { question } from './learning';

describe('textbook notation and accessible rendering', () => {
  it.each(Object.entries(equations))('renders %s as visual math and accessible MathML', (_, tex) => {
    const html = renderMath(tex, true);
    expect(html).toContain('katex-html');
    expect(html).toContain('<math');
    expect(html).not.toContain('katex-error');
  });
  it('uses mathematical fractions, superscripts, subscripts and Greek letters', () => {
    expect(renderMath(equations.capacitance)).toContain('<mfrac>');
    expect(renderMath(equations.energyCV)).toContain('<msup>');
    expect(renderMath(equations.rcGeneral)).toContain('<msub>');
    expect(renderMath(equations.rcGeneral)).toContain('<msup>');
    expect(renderMath(equations.tau)).toContain('τ');
    expect(renderMath(equations.permittivity)).toContain('ε');
  });
  it('supports inline prose and keyboard-scrollable display math without duplicate speech', () => {
    expect(renderToStaticMarkup(<InlineMath tex="C_0" />)).not.toContain('role="region"');
    expect(renderToStaticMarkup(<DisplayMath tex={equations.energyQC} />)).toContain('tabindex="0"');
    const prose = renderToStaticMarkup(<MathText>{String.raw`Use $C=\frac{Q}{V}$ to compare.`}</MathText>);
    expect(prose).toContain('Use ');
    expect(prose).toContain('to compare.');
    expect(prose).toContain('aria-hidden="true"');
  });
  it('formats finite scientific values and units safely', () => {
    expect(mathNumber(2.88e-8)).toBe(String.raw`2.88\times 10^{-8}`);
    expect(quantity(4e-6, 'F')).toBe(String.raw`4\,\mathrm{\mu F}`);
    expect(quantity(1e4, 'Ω')).toBe(String.raw`10\,\mathrm{k\Omega }`);
    expect(renderMath(quantity(2.88e-8, 'J'))).not.toBeNull();
    expect(quantity(NaN, 'F')).toBe(String.raw`\text{unavailable}`);
    expect(quantity(1, '<script>')).toBe(String.raw`\text{unavailable}`);
  });
});

describe('restricted math boundary', () => {
  it.each([String.raw`\href{javascript:alert(1)}{go}`, String.raw`\includegraphics{https://example.com/x}`,
    String.raw`\htmlStyle{color:red}{x}`, String.raw`\gdef\x{X}\x`, String.raw`\def\x{\x}\x`,
    String.raw`\frac{`, 'x'.repeat(4001)])('rejects unsafe or invalid input: %s', tex => {
    expect(renderMath(tex)).toBeNull();
    const fallback = renderToStaticMarkup(<InlineMath tex={tex} />);
    expect(fallback).toContain('Equation unavailable.');
    expect(fallback).not.toContain(tex);
  });
  it('escapes text as renderer output and does not retain macros between equations', () => {
    expect(renderMath(String.raw`\text{<script>alert(1)</script>}`)).not.toContain('<script>');
    expect(renderMath(String.raw`\gdef\leak{1}`)).toBeNull();
    expect(renderMath(String.raw`\leak`)).toBeNull();
    expect(renderMath(equations.charge)).toBe(renderMath(equations.charge));
  });
});

describe('dynamic challenge presentation', () => {
  for (const tab of [0, 1, 2]) for (const difficulty of ['Easy', 'Medium', 'Hard']) {
    it(`typesets all four variants for tab ${tab}, ${difficulty}`, () => {
      for (let index = 0; index < 4; index++) {
        const q = question(tab, difficulty, index);
        expect(Number.isFinite(q.answer)).toBe(true);
        for (const tex of q.solution) expect(renderMath(tex, true), tex).not.toBeNull();
        for (const prose of [q.text, q.hint, q.solutionNote ?? '']) {
          expect((prose.match(/\$/g) ?? []).length % 2).toBe(0);
          for (const match of prose.matchAll(/\$([^$]+)\$/g)) expect(renderMath(match[1]), match[1]).not.toBeNull();
        }
      }
    });
  }
});
