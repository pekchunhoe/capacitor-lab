# RC current visibility validation

Validated locally on 18 October 2026. The RC particles now start at about 4.48 times their previous speed for a standard charging or full-charge discharging interval, then slow in direct proportion to the signed engine current.

## Cause and mapping

The previous presentation mapping was `v = 36 I / (0.001 + |I|)`, in SVG units per simulated second, with current in amperes. The fixed 1 mA denominator and conservative 36-unit cap gave the default 1.2 mA starting current only 19.64 SVG units/s. Scaling the diagram to a 320 px phone reduced that to 8.36 screen pixels/s initially, making movement difficult to notice.

The new mapping uses a reference fixed for the entire parameter trial:

```text
Iref = max(1 nA, source voltage / resistance)
v = sign(I) × 88 × min(1, |I| / Iref)
v = 0 when |I| <= 1 nA
```

For supported UI trials, current never exceeds the reference, so speed is linear in signed current. A partial-charge switch retains this reference and does not boost a small current to full speed. The upper cap also handles above-reference inputs consistently. No minimum nonzero speed was introduced. At one, three, five and eight time constants, a standard interval has speeds of approximately 32.37, 4.38, 0.593 and 0.0295 SVG units/s respectively. The existing 8-time-constant trial limit is unchanged.

The continuous phase remains the analytical integral of the presentation mapping using `rcState` samples and existing simulation history. The integral includes the same 1 nA stop threshold. No new current model, timer, RAF loop, CSS keyframe animation or duration retiming was added. Playback speed is still applied once by the existing simulation clock. Pause freezes simulation time and phase; resume and switching preserve phase. Reduced motion still fixes marker positions while retaining direction arrows and current readouts.

## Measured browser improvement

The capture script sampled the actual browser DOM at controlled times before implementation, after implementation, and from the production build. It recorded signed current, phase, marker coordinates, diagram scale, current readout and graph current. Rates below use unwrapped along-path phase displacement divided by actual simulated elapsed time, converted to CSS pixels using the rendered SVG transform. This avoids measuring a misleading straight-line distance around a corner or across a wrap. Playback was 1×. The first measured charge/discharge intervals were 0.192 s and 0.240 s respectively.

| Viewport | Early charging, old → new (CSS px/s) | Early discharging, old → new (CSS px/s) |
| --- | ---: | ---: |
| 320 × 640 | 7.99 → 34.09 | 7.90 → 33.30 |
| 390 × 844 | 9.66 → 41.18 | 9.54 → 40.22 |
| 834 × 1194 | 13.22 → 56.39 | 13.07 → 55.08 |
| 1194 × 834 | 20.84 → 88.87 | 20.60 → 86.81 |
| 1440 × 1000 | 23.62 → 100.73 | 23.35 → 98.39 |

The instantaneous standard starting speed increased from 19.64 to 88 SVG units/s, a 4.48× gain. The measured early-interval gains were 4.26× charging and 4.21× discharging, because the new linear mapping also decays faster than the old saturating mapping. Discharge began from the existing 8-time-constant charge endpoint, rather than an artificially exact full charge. Development and production measurements matched.

All 130 corresponding snapshots (five viewports, two modes, thirteen times) had exactly identical simulation times, numerical currents, current readouts and graph-current labels before and after the change, including in the production preview.

Raw local evidence (ignored by Git): [before](artifacts/current-visibility/before.json), [after](artifacts/current-visibility/after.json), [production](artifacts/current-visibility/production.json). Representative production frames: [320 px charging](artifacts/current-visibility/production-320-charge-4.png), [tablet discharging](artifacts/current-visibility/production-834-discharge-4.png), [desktop charging](artifacts/current-visibility/production-1440-charge-4.png). Each viewport/mode also has frames at capture steps 1, 4 and 12 for temporal comparison.

## Readability, direction and performance

Marker spacing targets increased from 48 to 120 SVG units, retaining uniform spacing within each path. There are now eight particles in either mode, compared with 22 charging and 21 discharging previously. Actual path spacing is 119–215 SVG units. Even with 5× playback, the existing 0.1 s frame cap and pending 30 Hz commit bound travel below 58.67 SVG units, less than half the minimum spacing (59.5 units). This preserves direction readability during delayed frames. Markers retain the existing endpoint fades and wrap behavior.

Charging and discharging use the same corrected conducting paths and signed directions as before. Tests verify no particles enter the capacitor gap, open/disconnected branches, or excluded battery branch during discharge. Common-wire positions remain continuous across switching; the phase does not reset. No extra visibility setting was needed for the calibrated default.

Production Chromium measurements over 1.8 s at each viewport recorded:

| Viewport | Sampled RAF intervals | Median / p95 interval | Long tasks |
| --- | ---: | ---: | ---: |
| 390 × 844 | 109 | 16.7 / 16.8 ms | 0 |
| 834 × 1194 | 109 | 16.7 / 16.7 ms | 0 |

These are unthrottled workstation browser observations, not physical-phone CPU or battery measurements. RAF interval measurements do not imply a 60 Hz React update rate: the existing 30 Hz UI commit cap remains. No additional React update source was added, and fewer marker nodes are rendered. Physical Android/iPhone hardware and Safari were not tested. Raw measurements: [production performance](artifacts/current-visibility/production-performance.json).

## Verification and scope

- `npm test`: **84 passed** (30 physics, 40 mathematical rendering, 14 current-motion tests).
- `npx playwright test tests/current-animation.spec.ts`: **10 passed**.
- `npm run test:e2e`: **48 passed**, including all animation, responsive layout, touch, mathematical notation, Time Constant disclosure, prediction, challenge and Virtual Experiment checks.
- `npm run build`: **passed**, including TypeScript and the Vite production build.
- `node scripts/capture-preview.mjs http://127.0.0.1:4173/`: **passed**, covering the three tabs in mobile/desktop previews.
- Controlled production animation capture at all five viewports: **passed**.
- `git diff --check`: **passed**.

Animation regression coverage includes visible charge/discharge displacement, signed direction, monotonically decreasing speed, proportional decay, phase derivatives, partial switches, pause/resume, zero/near-zero current, wrapping, branch/gap safety, graph cursor/current synchronization, frame partitioning, playback 0.25×/1×/2×/5×, delayed high-current frames and reduced motion.

The physics engine, graph calculations, simulation duration, R/C/source controls, mathematical notation, Time Constant panel, other tabs, Predict mode, Challenges and Virtual Experiment implementation were not changed. Protected source files were checked with Git diff. No dependencies, Git configuration or Vercel settings changed.

Files changed:

- `src/currentMotion.ts`: fixed trial reference, faster linear mapping, matching continuous integral and wider spacing.
- `src/ui.tsx`: passes the reference into the visual mapping and explains the normalized marker speed in the existing caption.
- `src/currentMotion.test.ts`: visibility, proportional decay and capped-integral regressions; updated mapping/spacing assertions.
- `tests/current-animation.spec.ts`: measured mobile visibility and proportional-speed checks alongside existing browser regressions.
- `scripts/capture-current-visibility.mjs`: repeatable controlled browser measurements and temporal captures.
- `CURRENT_VISIBILITY_VALIDATION.md`: this report.

To capture the current implementation again, run the dev server and `node scripts/capture-current-visibility.mjs after`. To capture the built preview, run `npm run build`, start preview on port 4173, then run `node scripts/capture-current-visibility.mjs production http://127.0.0.1:4173/`. The saved `before.json` was captured from the original implementation before edits.

No commit, push, branch creation or deployment occurred.
