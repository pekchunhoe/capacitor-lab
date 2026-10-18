import { memo, useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { format } from './physics';

// Only application-authored TeX and finite numeric substitutions reach this boundary.
// No shared macro state, links, HTML extensions, external resources or user macros.
export function renderMath(tex: string, displayMode = false): string | null {
  if (tex.length > 4000 || /\\(?:href|url|includegraphics|html\w*|def|gdef|edef|xdef|let|futurelet|newcommand|renewcommand|global|csname)\b/i.test(tex)) return null;
  try {
    return katex.renderToString(tex, {
      displayMode, output: 'htmlAndMathml', trust: false, strict: 'error',
      throwOnError: true, maxExpand: 100, maxSize: 10, macros: {},
    });
  } catch { return null; }
}

export const MathExpression = memo(function MathExpression({ tex, display = false }: { tex: string; display?: boolean }) {
  const html = useMemo(() => renderMath(tex, display), [tex, display]);
  if (html === null) return <span className="math-fallback">Equation unavailable.</span>;
  // This HTML is produced exclusively by the restricted KaTeX renderer above.
  const math = <span className="math-content" dangerouslySetInnerHTML={{ __html: html }} />;
  return display ? <div className="display-math" tabIndex={0} role="region" aria-label="Mathematical equation">{math}</div> : <span className="inline-math">{math}</span>;
});
export function InlineMath({ tex }: { tex: string }) { return <MathExpression tex={tex} />; }
export function DisplayMath({ tex }: { tex: string }) { return <MathExpression tex={tex} display />; }

/** Dollar-delimited math in developer-authored prose; never applied to student input. */
export function MathText({ children }: { children: string }) {
  return <>{children.split(/(\$[^$]+\$)/g).map((part, i) => part.startsWith('$') && part.endsWith('$')
    ? <InlineMath key={i} tex={part.slice(1, -1)} /> : part)}</>;
}

export function mathNumber(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return '\\text{unavailable}';
  const text = String(Number(value.toPrecision(digits)));
  return text.replace(/e\+?(-?\d+)$/, '\\times 10^{$1}');
}
export function quantity(value: number, unit: string, digits = 3): string {
  const allowed = ['F', 'C', 'V', 'J', 's', 'A', 'Ω', 'V/m'];
  if (!allowed.includes(unit) || !Number.isFinite(value)) return '\\text{unavailable}';
  const [number, symbol] = format(value, unit, digits).split(' ');
  const renderedUnit = symbol.replace('µ', '\\mu ').replace('Ω', '\\Omega ').replace('V/m', 'V\\,m^{-1}');
  return `${mathNumber(Number(number), digits)}\\,\\mathrm{${renderedUnit}}`;
}
