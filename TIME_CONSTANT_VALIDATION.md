# Collapsible Time Constant panel — completion report

18 October 2026, Asia/Kuala_Lumpur. Implemented and validated locally.

## Result and behavior

The RC Time Constant panel is **collapsed by default**. Its 66 CSS px summary contains the title, inline KaTeX equation with the live result in seconds, and a downward chevron. The entire header is a native button. Clicking, tapping, Enter or Space toggles the explanation and changes the chevron to point upward. `aria-expanded` and `aria-controls` expose the disclosure state and relationship.

When expanded, the panel shows the natural-timescale heading, display equation with the same current result, the original explanation, and the 63.2%, 36.8% and 99.3% consequences with their standard initial-condition assumptions. No advanced equations were added. The explanation uses `hidden` while collapsed, so it occupies no layout space. Expanded height follows the actual text content.

The displayed time constant still comes from the existing physics calculation. Both summary and expanded value update when resistance or capacitance changes. Values remain in seconds, including small values such as 0.01 s. In Experiment 1, the existing concealment behavior is preserved: the value is `?` until the reference is revealed.

Disclosure state is local to the panel. Toggling does not change RC parameters, pause/reset playback, update trial keys, or remount the graphs. The numerical engine, circuit animation, graph calculations, cursor/replay logic, prediction, challenge and measurement/scoring logic are unchanged. Other tabs are unchanged.

## Root cause and spacing

Legacy CSS gave the equation and paragraph flex bases of 240 px and 270 px. At tablet widths, a column-direction rule interpreted those bases as vertical space, producing a **560 px** panel with large blank areas. Other widths still showed the entire explanation by default. On phones, the separate parameter settings panel also stood between the circuit card and the graphs.

Those legacy flex sizing rules were removed. The summary uses an intrinsic grid layout with a 64 px minimum button height plus the panel borders. The explanation has no fixed height, flex basis or placeholder space. The panel-to-graph gap is 12 px.

At widths up to the existing 780 px mobile breakpoint, the RC order is now: circuit actions and live readings, Time Constant, graphs, parameter settings, then further learning. Wider layouts keep parameter settings in the existing sidebar. Only RC layout ordering changed.

Measurements use the default circuit and loaded local fonts. **Circuit-to-graph gap** means the top of `.graphs-panel` minus the bottom of `.experiment`, which includes the animation, simulation action buttons, live readings and legend. The raw measurements also record the distance from the bottom of the circuit SVG. Before measurements used the original local implementation; after measurements used the built production preview.

| Viewport width | Panel height before → collapsed | Circuit-to-graph gap before → after | Gap reduction |
| --- | --- | --- | --- |
| 320 px | 272.3 → 66 px | 977.3 → 90 px | **887.3 px** |
| 360 px | 272.3 → 66 px | 967.3 → 90 px | **877.3 px** |
| 390 px | 247.1 → 66 px | 924.0 → 90 px | **834.0 px** |
| 430 px | 247.1 → 66 px | 924.0 → 90 px | **834.0 px** |
| 768 px | 163.9 → 66 px | 831.0 → 90 px | **741.0 px** |
| 834 px | 560.0 → 66 px | 600.0 → 94 px | **506.0 px** |
| 1024 px | 560.0 → 66 px | 600.0 → 94 px | **506.0 px** |
| 1194 px | 163.9 → 66 px | 203.9 → 94 px | **109.9 px** |
| 1440 px | 163.9 → 66 px | 203.9 → 94 px | **109.9 px** |

The phone reductions include moving parameter settings below the graphs, compacting the panel, and reducing the gaps. For example, at 390 px the panel itself saves 181.1 px; the total circuit-to-graph reduction is 834.0 px.

Raw evidence: [before measurements](artifacts/timescale/before.json), [after measurements](artifacts/timescale/after.json). Reproduce captures with `node scripts/capture-timescale.mjs after http://127.0.0.1:4173/` against a running local preview. The `before` stage must run against the original implementation.

## Validation

- `npm test`: **70 passed**, including 30 physics tests and 40 mathematical rendering/security tests.
- `npm run test:e2e`: **38 passed in 3.4 minutes**, including all 26 existing browser tests and 12 new disclosure tests.
- `npm run build`: **passed**, including TypeScript and production asset bundling.
- `node scripts/capture-preview.mjs http://127.0.0.1:4173/`: **passed** for all three tabs at 390 and 1440 px, including the revised RC mobile ordering.
- `git diff --check`: **passed**.
- Git diffs confirm no changes to `src/physics.ts`, `src/ui.tsx` (including graphs), `src/equations.ts`, `src/learning.tsx`, `src/CapacitanceLab.tsx` or `src/DielectricLab.tsx`.

New browser checks cover default collapse, whole-header/chevron activation, visible dynamic values, R/C updates, seconds formatting, explanation removal from layout, 56–80 px compact height, graph movement on collapse, tight gaps, mobile ordering, keyboard operation, ARIA state, continued charging/discharging, synchronized graph/readout values, unchanged paused state/cursor/playback speed, touch operation and retained Experiment 1 measurements and answer fields. The existing tests retain coverage of graph expansion/replay, all tabs and modes, switching, predictions, challenge scoring, complete Experiment 1 and mathematical layout/security.

Viewport matrix: **320×640, 360×800, 390×844, 430×932, 768×1024, 1024×768, 834×1194, 1194×834 and 1440×1000** CSS px. Additional touch-enabled iPad Pro 11 checks cover portrait and landscape. Tests use Chromium emulation; physical iPad/Safari testing was not performed.

Actual production-preview screenshots of collapsed and expanded panels were visually inspected at every listed width. Full-page mobile and tablet views were also reviewed, including touch-emulated iPad captures. No clipped equations, missing chevrons, leftover blank areas or horizontal page scrolling were observed. The 45 before/after screenshots are preserved in `artifacts/timescale/`.

Examples: [original tablet panel](artifacts/timescale/before-834-panel.png), [320 px collapsed](artifacts/timescale/after-320-panel.png), [320 px expanded](artifacts/timescale/after-320-expanded.png), [390 px full page](artifacts/timescale/after-390-page.png), [tablet expanded](artifacts/timescale/after-834-expanded.png), [landscape full page](artifacts/timescale/after-1194-page.png).

## Files modified or added

- `src/RCLab.tsx`: isolated disclosure component, live KaTeX summary and expanded content; RC-specific layout class.
- `src/styles.css`: remove legacy time-constant sizing; intrinsic disclosure styles and RC mobile ordering.
- `tests/time-constant.spec.ts` (new): 12 focused browser regressions.
- `scripts/capture-timescale.mjs` (new): repeatable screenshots and geometric measurements.
- `scripts/capture-preview.mjs`: validate the new RC phone ordering while preserving checks for the other tabs.
- `TIME_CONSTANT_VALIDATION.md` (new): this report.

No dependencies, physics calculations, graph calculations, branches, hosting settings or production configuration were changed. **No commit, push or deployment occurred.** Deployment awaits separate authorization.
