# Mathematical notation and Chapter 2 scope correction

18 October 2026, Asia/Kuala_Lumpur. Local implementation only. This report supersedes the earlier mathematical-rendering report for the changes described here.

## Root cause and layout correction

The selector `.dielectric-status span` applied `display: block` and a fixed font size to **every nested span**, including KaTeX's internal fraction, subscript and positioning elements. The phone rule also reduced every such span to 8 px. This broke both `C_0` and the capacitance fraction despite valid TeX and successful rendering.

The measurement panel now uses a semantic definition list (`dl`, `dt`, `dd`). Typography targets the labels and values, leaving KaTeX's internal layout intact. Symbols render in inline mode. On phones, each measurement occupies a row with its label and value aligned; larger layouts use two columns. Values and units stay together. Grid and field labels allow their containers to shrink with `min-width: 0`, while individual inline math expressions do not shrink or wrap. Subscripts retain their natural height and visible overflow. No KaTeX vendor stylesheet was changed.

The application audit found the same kind of descendant-span selector in `.graph-title span`. It is now `.graph-title > span`, so the hidden-capacitance graph's inline voltage subscript in Experiment 1 is not turned into nested flex containers. A browser regression checks that state before revealing the answer.

The dielectric measurements distinguish:

- **Air capacitance** `C_0`: 148 pF at the default geometry, unchanged calculation.
- **Dielectric constant** `\varepsilon_r`: 4.000 for the default material, independent of insertion.
- **Capacitance ratio** `C/C_0`: the existing live ratio, initially 1.000 and 4.000 at complete insertion of the default material.
- The existing net electric field reading.

The material constant and live ratio can differ during partial insertion. The formula panel explicitly states that its full-fill relations compare the same geometry before and after complete filling.

## Student-facing equations

The advanced general interval voltage-response equation was removed from both the RC panel and the presentation equation catalog. The expanded RC library no longer lists separate voltage/current exponentials or fraction-at-one-time-constant formulas. The three main sections now show:

1. Charging: `Q=Q_0\left(1-e^{-\frac{t}{RC}}\right)`.
2. Discharging: `Q=Q_0e^{-\frac{t}{RC}}`.
3. Time constant: `\tau=RC`.

The charging section requires an initially uncharged capacitor and defines the reference charge as the maximum charge. The discharging section defines it as the actual initial charge before discharge. The text explicitly states that the zero-start charging equation does not apply unchanged to partially charged recharging. Switching continues from the actual physical state. The 63.2% and 36.8% consequences are explained in words, with concise expandable symbol definitions and accessible MathML.

RC display equations use responsive 24–26 px type. At 320 px they fit without horizontal scrolling.

Other main equations retained:

- Capacitance: `C=Q/V`.
- Series: reciprocal addition of the individual capacitances.
- Parallel: direct addition of the individual capacitances.
- Energy: `U=CV²/2`, `U=QV/2`, `U=Q²/(2C)`, shown as three readable equations.
- Dielectrics: `\varepsilon_r=C/C_0`, `C_0=\varepsilon_0 A/d`, `C=\varepsilon_r C_0`.

Basic rearrangements remain where needed for solving questions and Experiment 1, including `Q=CV`, `V=Q/C` and `C=\tau/R`. Fixed-charge and fixed-voltage conditions remain concise labels. Partial-insertion and electric-field formula panels were removed; the calculations and conceptual explanations remain. Dielectric geometry solutions now find air capacitance first and then multiply by relative permittivity.

The hard RC challenge now asks for remaining discharge charge instead of requiring the out-of-scope current exponential. Its answer still comes from the existing exact engine. Difficulty selection, generated variants, hints, worked solutions, unit conversion and scoring remain functional. Medium RC solutions consistently use maximum charging charge; hard solutions use initial discharging charge.

No user-visible syllabus code was introduced. Navigation remains **Capacitance | RC Circuits | Dielectrics**.

## Physics preservation

`src/physics.ts` is byte-for-byte unchanged in the Git diff. The RC integration, interval transitions, current direction, graphs, dielectric lateral-fill model, fixed-voltage/fixed-charge boundaries, geometry and energy calculations are unchanged. Animation, switching handlers, prediction trials and Experiment 1 measurement/scoring logic are unchanged.

An additional physics regression recharges a partially charged capacitor after discharge, checks its voltage, charge and current one time constant later, and confirms that it follows the actual retained state rather than the zero-start teaching formula. Existing tests cover continuity in both switch directions, tiny-time accuracy, graph replay, dielectric isolation and reconnection, energy identities and numerical input handling.

## Validation

| Check | Result |
| --- | --- |
| `npm test` | 70 passed: 30 physics tests and 40 notation/rendering/security tests |
| Mathematical browser coverage | All 11 tests passed: nine viewport audits, every one of 36 challenge variants at 320 px, and the iPad touch test |
| `npx playwright test tests/lab.spec.ts --output artifacts/notation-interactions` | All 15 interaction tests passed in a fresh 45.7-second run |
| `npm run build` | Passed TypeScript checking and Vite production bundling |
| Production preview | Existing screenshot/smoke script passed all three tabs at 390 and 1440 px; six screenshots, no runtime/console errors, correct phone control ordering |
| `git diff --check` | Passed |
| Physics engine diff | Empty for `src/physics.ts` |

The combined 26-test browser run passed all 11 math tests and 14 interaction tests. Its 768 px interaction case was interrupted by a development-page reload during the final text edit; its trace shows Vite reconnecting. With editing stopped, the entire 15-test interaction file was rerun successfully. No application or test changes were needed to resolve that interruption. All 26 distinct browser checks therefore have passing final verification.

Regression coverage checks true subscript positioning geometrically (the zero is lower and to the right of the C), correct material-constant/live-ratio labels, accessible MathML and symbol explanations, exact prescribed charge equations, absence of the general voltage response, the hidden-capacitance graph label, phone alignment, intact inline glyphs, no vertically clipped or horizontally scrolling display equations, no page overflow, no visible syllabus code, successful font loading and no browser errors. Existing physics and interaction checks cover both switching directions, graphs/replay, all three tabs, prediction trials, numerical answer checking, dielectric boundaries and completing Experiment 1.

Actual rendered measurement and RC equation screenshots were visually inspected at **all nine widths**, including iPad portrait/landscape sizes. Full-page views, dielectric fractions, expanded formula libraries and the revised discharge solution were also reviewed. No clipped notation, broken subscripts, malformed fractions or full-page horizontal overflow was observed. Browser screenshots are preserved in `artifacts/notation/`, with production preview captures in `artifacts/lab-*.png`. The production Experiment 1 graph heading and voltage subscript were additionally captured and visually checked at 320 and 1194 px.

Examples: [320 px measurements](artifacts/notation/measurements-320.png), [320 px RC lesson](artifacts/notation/math-320-1.png), [iPad landscape measurements](artifacts/notation/measurements-1194.png), [desktop RC lesson](artifacts/notation/math-1440-1.png).

The browser matrix is 320×640, 360×800, 390×844, 430×932, 768×1024, 1024×768, 834×1194, 1194×834 and 1440×1000 CSS px. Separate touch-enabled iPad Pro 11 emulation covers portrait and landscape. These are Chromium viewport/device-emulation checks, not physical iPad or Safari verification.

The curriculum PDF was absent from the project and supplied attachment directory. Direct verification of page 7 was unavailable; the supplied explicit Chapter 2 requirements were used.

## Files changed

- `src/DielectricLab.tsx`: semantic measurements, distinct material constant/live ratio, prescribed formula panels and concise model notes.
- `src/RCLab.tsx`: charge-equation lesson, assumptions, symbol meanings and simplified expanded explanations.
- `src/equations.ts`: prescribed RC charge notation and removal of unnecessary advanced presentation formulas.
- `src/learning.tsx`: charge-based RC challenges and stepwise dielectric solutions.
- `src/ui.tsx`: reusable lesson sections with accessible equations and expandable symbols.
- `src/styles.css`: scoped measurement/graph rules, atomic inline symbols and responsive equation typography.
- `src/math.test.tsx`: exact notation, accessible lesson content, scope and generated challenge regressions.
- `src/physics.test.ts`: partial-charge recharge trajectory regression.
- `tests/math.spec.ts`: nine viewport audits, glyph/subscript alignment, accessible explanations, all 36 challenge variants and iPad touch checks.
- `tests/lab.spec.ts`: charging/discharging challenge scoring regression.
- `NOTATION_VALIDATION.md`: this completion report.

No dependency, branch, production configuration, repository configuration or hosting project was changed. No commit, push or deployment occurred. Deployment requires separate authorization.
