# Capacitor Lab mathematical rendering validation

This is the implementation-stage record, before the separately authorized release. Deployment observations below describe that stage.

Validated locally on 18 October 2026. No commit, push, deployment, branch change, repository configuration change or production configuration change was made.

## Implementation and scope

KaTeX 0.19.0 renders HTML for sighted students and MathML for assistive technology. Its JavaScript, stylesheet and fonts are bundled locally; runtime inspection found no external requests. The renderer is a separate local production chunk. Existing application colors, controls, mounted tab state and simulation architecture are preserved.

The shared `InlineMath`, `DisplayMath` and `MathText` components handle inline notation, display equations and application-authored mathematical prose. The existing `Equation` component now provides a reusable equation panel with expandable symbol definitions. Graphs and apparatus use native SVG text with real subscript positioning rather than KaTeX HTML inside SVG.

The equation catalog contains **27 core formula templates**: seven capacitance/network/energy formulas, eleven RC formulas, and nine dielectric/geometry/boundary formulas. Shared charge and energy equations are reused between tabs. Presentation also covers **36 generated challenge variants** (three tabs × three difficulties × four parameter sets), all three prediction activities, guided investigations, virtual-experiment calculations and feedback, network comparisons, measurement labels, graph labels, reset/prediction notices, and learning summaries.

Examples of the presentation changes:

| Previous text | New textbook notation |
| --- | --- |
| `C = Q/V` | $C=\frac{Q}{V}$ |
| `1/Ceq = 1/C₁ + 1/C₂ + …` | $\frac{1}{C_{\mathrm{eq}}}=\frac{1}{C_1}+\frac{1}{C_2}+\cdots+\frac{1}{C_n}$ |
| `Q²/(2C)` | $U=\frac{Q^2}{2C}$ |
| `Vc = V∞ + (Vinitial − V∞)e^(−Δt/RC)` | $V_C(t)=V_\infty+[V_C(t_0)-V_\infty]e^{-(t-t_0)/(RC)}$, with a stacked fraction in the exponent and sensible continuation lines |
| `εr = C/C₀` | $\varepsilon_r=\frac{C}{C_0}$ |

The RC explanation defines the start of each switching interval separately. Standard charging defines its reference charge as final charge; discharging defines its reference charge as initial charge. Discharge current is negative under the existing charging-positive convention. Connected dielectric cases fix voltage; disconnected cases preserve the actual charge at isolation. Partial lateral insertion remains explicitly distinguished from complete filling.

`src/physics.ts` and `src/physics.test.ts` have no changes. Challenge answers, difficulty progression, tolerances, parameter ranges, default values, timing, switching, prediction trials, and experiment validation calculations are unchanged.

## Rendering safety

Only developer-authored formulas and finite numerical substitutions reach KaTeX. Student answer strings are never interpreted as TeX. Rendering uses `trust: false`, strict parsing, fresh macro state, bounded expansion and size, and explicit rejection of links, HTML extensions, external images and user macro definitions. Invalid content shows a neutral fallback without raw TeX. React HTML insertion is confined to the restricted renderer's output. No security headers, CSP, external scripts or inline JavaScript were added or changed.

The chosen options follow the [KaTeX options documentation](https://katex.org/docs/options.html) and [security guidance](https://katex.org/docs/security.html).

## Final validation

- `npm test`: **76 passed** across two files: all **29 existing physics tests** and **47 new rendering/security tests**.
- `npm run test:e2e`: **20 passed**: all **14 existing browser tests** and **six new equation browser tests**.
- New unit checks cover all 27 catalog formulas, fractions, superscripts, subscripts, Greek symbols, MathML, safe failure, macro isolation, units/scientific values, and every challenge variant's mathematical strings.
- Browser sizes: **320×640, 360×800, 390×844, 430×932, 768×1024, 1440×1000**. All tabs and modes, all challenge difficulties, expanded equation libraries, symbol definitions, virtual-experiment reference answers, font loading, raw-notation absence, math clipping and horizontal overflow were checked.
- A separate 320px audit covered all 36 challenge variants and found **no display equations requiring horizontal scrolling**. Dedicated equation regions still support keyboard-accessible local scrolling as a fallback.
- Actual mobile and desktop screenshots were inspected, including RC exponent/fraction notation, all energy forms, dielectric boundary formulas, and multistep challenge substitutions. Long substitutions were split into complete readable steps rather than reduced to tiny type.
- Existing browser tests also pass for independent tab state, network calculations, prediction and challenge scoring, RC timing and replay, synchronized graphs, complete virtual experiment, dielectric boundary changes, keyboard navigation, touch controls, reduced motion and responsive layouts.
- `npm run build`: **passed**, including `tsc --noEmit`. Local KaTeX fonts and two JavaScript chunks are emitted successfully, without the initial large-chunk warning.
- Production smoke tests: all three tabs and all four learning modes at **320px and 1440px**; no visible syllabus code, page overflow, failed routes or console errors.
- Fresh production-browser inspection confirmed local mathematical fonts loaded successfully, with no failed assets or external requests.
- `git diff --check`: **passed**.

Screenshots are in `test-results/math-*.png`, `test-results/math-library-*.png`, `test-results/math-challenge-*.png`, and `artifacts/text-cleanup-*.png`. Ignored audit scripts and deployment comparison evidence are saved in `artifacts/`.

## Deployed-version investigation

A fresh browser context inspected <https://capacitor-lab-rosy.vercel.app/> and its served JavaScript, with service workers blocked. The public site returned HTTP 200 and currently shows:

- `Capacitance | RC Circuits | Dielectrics`.
- `EXPERIMENT 1`, with **no SP025 in the visible page or served JavaScript**.
- The previous plain-text RC equation, with no KaTeX renderer.

The public entry asset is `/assets/index-ChEmz7Ud.js`, the same filename produced by the earlier local text-cleanup build in this session. The upgraded local production entry is `/assets/index-CNI4QC4N.js` plus the local KaTeX chunk. SHA-256 asset hashes, selected cache headers and browser findings are recorded in `artifacts/deployment-comparison.json`; screenshots are `artifacts/equations-deployed-390.png` and `artifacts/equations-local-390.png`.

The older local Git commit `ab3a75c` contains the exact `SP025 · EXPERIMENT 1` heading; the current baseline commit `1921727` already contains `EXPERIMENT 1`. The reported SP025 screenshot therefore differs from both the freshly inspected public site and the current local build. Its precise original cause (older screenshot/deployment or client cache) cannot be proved from the current public state. No deployment was performed to investigate or resolve this.

The equation upgrade is local only. The public site still needs a separately authorized deployment to receive it. Historical README syllabus references remain unchanged.

## Files changed or added

- `package.json`, `package-lock.json`: KaTeX and its TypeScript types.
- `src/math.tsx` (new): reusable, restricted equation renderer and numerical notation helpers.
- `src/equations.ts` (new): shared catalog of 27 formulas.
- `src/ui.tsx`: equation panels, symbol explanations, scientific labels, SVG subscripts and graph units.
- `src/CapacitanceLab.tsx`: capacitance, network and energy mathematics.
- `src/RCLab.tsx`: general interval response, standard responses, time constant, definitions and example.
- `src/DielectricLab.tsx`: dielectric geometry, boundary equations, definitions and explanatory notation.
- `src/learning.tsx`: predictions, questions, hints, worked solutions, experiment instructions/results and guided activities.
- `src/styles.css`: readable responsive mathematical typography and contained scrolling.
- `src/math.test.tsx` (new): focused notation and rendering-safety tests.
- `tests/math.spec.ts` (new): six complete browser equation checks.
- `tests/lab.spec.ts`: two text assertions updated to inspect the corresponding rendered math without changing their physics expectations.
- `vite.config.ts`: include TSX unit tests and separate the renderer's production chunk.
- `MATH_VALIDATION.md` (new): this report.
