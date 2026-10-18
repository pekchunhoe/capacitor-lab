# RC current particle density validation

Implemented and checked locally on 18 October 2026, using commit `03e1469` as the clean baseline. No commit, push, deployment, branch change or Git/Vercel configuration change was made.

## Count and distribution

Charging previously rendered eight current particles; discharging also rendered eight. Both now render **32 particles: exactly 4× the baseline**. This is the number of stable SVG circle nodes; the existing endpoint fade can temporarily make a circle faint as it wraps. All circles retain the same 2.7 SVG-unit radius, amber color and brightness/fade rule.

| Conducting path | Length (SVG units) | Previous count | New count | New spacing (SVG units) |
| --- | ---: | ---: | ---: | ---: |
| Upper common wire | 374 | 3 | 12 | 31.17 |
| Lower common wire | 479 | 3 | 12 | 39.92 |
| Supply branch, charging only | 215 | 1 | 4 | 53.75 |
| Battery return, charging only | 119 | 1 | 4 | 29.75 |
| Shunt, discharging only | 249.03 | 2 | 8 | 31.13 |

The existing path lengths determine the baseline allocation. Each baseline spacing is subdivided into four equal parts:

```text
N = 4 × max(1, floor(pathLength / 120))
offset[i] = (i + 0.5) × pathLength / N
distance[i] = positiveModulo(offset[i] + existingContinuousPhase, pathLength)
```

Spacing is uniform in arc length within each path, including its wrap seam. It does not depend on how many straight SVG segments form that path. The shortest spacing remains more than five particle diameters, approximately 12.7 CSS pixels on the narrowest tested phone viewport. Existing endpoint fades soften wraparound and adjoining path boundaries. The number is intentionally fixed during current decay; particles are not deleted as equilibrium approaches.

Offsets are calculated once at module initialization and retained in frozen arrays. The renderer retains its existing path/index React keys. Position objects describe the latest coordinates; particle DOM nodes are reused. No particle timer, animation loop, new React state, dependency or adaptive-density setting was introduced. The existing caption now explains that particle count is illustrative and speed represents relative current, rather than implying a quantitative carrier density.

## Speed, direction, physics and graph synchronization

The signed-current mapping and phase integral are unchanged:

```text
Iref = max(1 nA, source voltage / resistance)
v = sign(I) × 88 × min(1, abs(I) / Iref)
v = 0 when abs(I) <= 1 nA
```

The reference remains fixed for each parameter trial. Particle count does not divide or multiply phase, current or velocity. The earlier approximately 4.48× starting-speed improvement is retained, including its 88 SVG-unit/s maximum. Continuous phase, playback scaling, pause/resume and simulation timing were not modified.

Controlled before/after browser captures covered seven viewports: 320 × 640, 360 × 800, 390 × 844, 430 × 932, tablet portrait 834 × 1194, tablet landscape 1194 × 834 and desktop 1440 × 1000. At each size, both charge and discharge were sampled at thirteen controlled timestamps. All **182 matched snapshots** had exactly identical simulation time, numerical current, phase, visual speed, SVG scale, all four physics readouts, both graph readouts and all graph path data. Every active path had exactly four times its former circle count.

| Width (CSS px) | Early charge speed, before = after (CSS px/s) | Early discharge speed, before = after (CSS px/s) |
| --- | ---: | ---: |
| 320 | 34.09 | 33.30 |
| 360 | 37.75 | 36.87 |
| 390 | 41.18 | 40.22 |
| 430 | 45.75 | 44.69 |
| 834 | 56.39 | 55.08 |
| 1194 | 88.87 | 86.81 |
| 1440 | 100.73 | 98.39 |

Rates use along-path, unwrapped phase displacement over actual simulated elapsed time, converted with the rendered SVG transform. Playback was 1×; the first charge/discharge intervals were 0.192/0.240 simulated seconds. Discharge starts from the existing eight-time-constant charge endpoint. Initial charge speed remains exactly 88 SVG units/s and full-charge discharge starts at approximately −87.97 SVG units/s.

Charging retains the upper/lower/supply/return paths. Discharging retains the upper/lower/shunt paths and excludes the battery branch. The signed direction logic, capacitor insulating gap, switch geometry, surface-charge symbols and direction arrows are unchanged. Tests verify every marker's signed movement against the same continuous phase, including negative modulo wrapping. Current and speed still decay by the same fraction, and shared-wire positions remain continuous through partial-charge switching. Reduced motion still freezes particle positions and retains accurate current/direction indicators.

The old test bounding stalled-frame travel below half an individual spacing assumed the sparse eight-particle layout. Fourfold density with unchanged speed and timing necessarily reduces that margin. The updated checks retain the half-spacing bound at normal playback, and verify stable identities and exact signed displacement at 5× playback and delayed frames, with travel below half a whole path. They do not claim that identical, closely spaced dots cannot perceptually alias during severely missed frames at accelerated playback. Existing direction arrows remain visible; the implementation does not slow particles or alter the simulation clock to hide missed frames.

## Performance before and after

The same local Chromium script sampled three 1.2-second runs at each viewport and CPU setting. The following ranges summarize the three unthrottled runs:

| Viewport | Median RAF interval, before → after | p95 RAF interval, before → after | Long tasks, before → after | Particle mounts/removals during flow |
| --- | --- | --- | --- | --- |
| 390 × 844 | 16.7 → 16.7 ms | 16.7–16.8 → 16.7–16.8 ms | 0 → 0 | 0 / 0 in every run |
| 834 × 1194 | 16.7 → 16.7 ms | 16.7–16.8 → 16.7–16.8 ms | 0 → 0 | 0 / 0 in every run |

There was no measurable unthrottled frame-interval regression in these samples. Each run recorded roughly 26–27 simulation UI commits, with no additional update source. RAF interval sampling is not a claim that React commits at 60 Hz: the existing 30 Hz commit cap remains unchanged.

At artificial 4× CPU throttling, the development app was uneven before and after the density change. Median RAF intervals ranged from 66.7–266.7 ms before and 33.3–166.7 ms after at 390 px; at 834 px they ranged from 166.7–183.3 ms before and 33.4–216.6 ms after. Long-task counts were 4–7 per run before and 5–7 after. These noisy, already slow baseline runs do not establish smooth performance on constrained devices or prove a density-specific slowdown. An adaptive-density fallback was not added on that evidence. Broader whole-app performance optimization was outside this change's scope.

These measurements were made on a workstation in headless Chromium. Physical Android/iPhone devices, Safari, memory retention over long sessions and battery use were not measured. No device-wide performance claim is made.

## Validation

- `npm test`: **87 passed** (30 physics, 40 mathematical rendering, 17 current-motion tests).
- `npx playwright test tests/current-animation.spec.ts`: **13 passed**.
- `npm run test:e2e`: **51 passed** (4.8 minutes), including all existing application, notation, touch and Time Constant scenarios.
- `npm run build`: **passed**, including TypeScript and the Vite production build.
- Production preview checks: **passed** at 320, 834 and 1440 px, verifying 32 particles, unchanged 88-unit initial speed, deceleration, charge/discharge phase direction and correct discharge branches.
- Before/after controlled capture comparison: **182 matched snapshots passed**, including identical Q–t/I–t graph path data and unchanged speed.
- Visual sequence review: charge/discharge frames at multiple times, including phone, tablet and desktop; circuit labels, resistor, switches, plates, color scheme and controls remain readable.
- `git diff --check`: **passed**.

Regression coverage retains the existing unit/browser scenarios and adds exact density, uniform cyclic spacing, unchanged movement of every marker, persistent particle count near equilibrium and stable DOM identities through decay, pause and resume. Browser charging coverage now includes all four requested phone widths, tablet portrait/landscape and desktop. Existing checks continue to cover disconnected branches, the capacitor gap, switching continuity, monotonically decreasing current/speed, graph synchronization, playback 0.25×/1×/2×/5×, irregular frame delivery and reduced motion.

The physics engine, current reference/speed functions, analytical phase integral, conducting paths, RC simulation clock, graph calculations, Capacitance/Dielectrics tabs, notation, Time Constant panel, learning modes, challenges, Virtual Experiment and routing were not changed. Protected source files were checked with Git diff.

## Files and evidence

- `src/currentMotion.ts`: independent 4× density constant and precomputed per-path offsets.
- `src/ui.tsx`: existing caption clarifies illustrative particle count.
- `src/currentMotion.test.ts`: count, cyclic spacing, signed movement and retained equilibrium particles; revised spacing-dependent frame bound.
- `tests/current-animation.spec.ts`: dense counts/spacing, two additional phone widths, stable DOM identities and updated dense-layout stall assertion.
- `scripts/capture-current-density.mjs`: controlled temporal captures, counts, speed/readouts/graph data and repeated local performance samples.
- `CURRENT_DENSITY_VALIDATION.md`: this report.

Local evidence is ignored by Git: [before captures/measurements](artifacts/current-density/before.json), [after captures/measurements](artifacts/current-density/after.json), [exact comparison](artifacts/current-density/comparison.json), [production smoke results](artifacts/current-density/production-smoke.json). Example frames: [phone charging](artifacts/current-density/after-320-charge-4.png), [phone discharging](artifacts/current-density/after-390-discharge-4.png), [tablet discharging](artifacts/current-density/after-834-discharge-12.png), [desktop charging](artifacts/current-density/after-1440-charge-4.png). Each captured mode/viewport has frames at steps 1, 4 and 12 for temporal review.

To reproduce the current captures and local measurements, start the dev server and run `node scripts/capture-current-density.mjs after`. To measure the built preview instead, run the build, serve it on port 4173 and use `node scripts/capture-current-density.mjs production http://127.0.0.1:4173/`. The `before` evidence was recorded from the clean original renderer before implementation.

No commit, push, deployment, branch/remote change or production setting change occurred.
