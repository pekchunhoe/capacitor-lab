# RC current animation correction

18 October 2026, Asia/Kuala_Lumpur. Local work only.

## Root cause recorded before correction

The numerical engine (`rcState`/`sampleRC`) already computes signed current correctly for each switching interval. RCLab passes its current to the numerical reading and circuit, while RCGraphs samples the same trajectory at its live cursor. The engine's existing requestAnimationFrame loop advances simulated time with playback speed and caps React commits at 30 Hz.

The old circuit overlay instead uses a separate CSS document-time clock: `stroke-dashoffset: 0 → -128`, infinitely repeated. Its duration changes on every render to `min(20, 0.7 / max(abs(I)/(source/R), .015))`. Changing that duration reinterprets elapsed animation time against the new duration, rather than integrating velocity. Thus its phase can run backward while signed current stays positive. The 20-second cap later changes the trend again. This is a phase-retiming defect, not a random-number or physics-engine defect.

A controlled browser reproduction set CSS animation time to the corresponding simulation instant and measured the actual computed offsets:

| Simulated time | Signed current | CSS duration | Dash offset |
| --- | --- | --- | --- |
| 0 s | 1.2 mA | 0.700 s | 0 px |
| 0.5 s | 728 µA | 1.154 s | −55.454 px |
| 1 s | 441 µA | 1.903 s | −67.269 px |
| 2 s | 162 µA | 5.172 s | −49.494 px |
| 3 s | 59.7 µA | 14.060 s | −27.312 px |
| 5 s | 8.09 µA | 20.000 s | −32 px |

The offset reverses from 1 to 3 seconds even though current remains positive and decreases smoothly. It then resumes the earlier direction at the duration cap. Evidence is saved in `artifacts/rc-current/before.json` and `before-charge-*.png`.

Playback speed changes the simulation clock but not this CSS clock. Direction is selected from the charging switch boolean instead of the signed current. The dashed compound path restarts its pattern on separate subpaths and omits the active switch connection. The discharge return path must exclude the disconnected battery branch. No JavaScript particle-position integration exists in the original implementation, and no random velocities were found.

The correction below replaces CSS retiming with an integrated presentation phase derived from existing analytical engine samples, a fixed monotonic speed mapping, and explicit conducting paths. Physics calculations, graph calculations and approved lesson equations are unchanged.

## Current animation architecture

`RCLab` continues to obtain its live state from `sampleRC(p, segments, time)`. It passes the same signed current, simulation time and a deterministic visual phase to `RCCircuit`. The phase helper samples interval endpoints through the existing `rcState` engine. It analytically integrates the visual speed mapping over those existing exponential intervals, accumulating the completed intervals and the current interval. It does not implement another capacitor-voltage or current solver.

The fixed mapping is `v_visual = 36 I / (0.001 + |I|)`, with current in amperes and visual speed in SVG units per simulated second. Its sign is the current sign; its magnitude increases strictly with current magnitude and remains below 36. A 1 nA visual stopping threshold freezes markers without changing the numerical current. The mapping is deliberately nonlinear and is identified in the circuit caption as a qualitative representation of current strength, rather than literal charge-carrier drift speed.

For the default initially uncharged trial:

| Elapsed time | Engine current | Visual speed | Accumulated visual phase |
| --- | --- | --- | --- |
| 0 | 1200 µA | 19.636 SVG units/s | 0 SVG units |
| One time constant | 441.455 µA | 11.025 SVG units/s | 15.221 SVG units |
| Three time constants | 59.744 µA | 2.030 SVG units/s | 26.295 SVG units |
| Five time constants | 8.086 µA | 0.289 SVG units/s | 28.095 SVG units |

The current at one time constant is the initial current multiplied by `e⁻¹`. The speed decreases under the stated nonlinear mapping; it is not presented as a literal measurement of current. Discharging uses the same mapping with negative sign and the actual interval-start current, including partial-charge starts.

Direction arrows and circuit direction text derive from `Math.sign(I)`. The switch state selects topology only. Positive phase follows the charging reference; negative phase follows the same conducting paths in reverse. Shared upper and lower wire paths retain both phase and marker positions at a switch. The charging-only supply/return branches are replaced by the active shunt during discharge.

Every marker is placed on an explicit conducting polyline. No path crosses the capacitor gap or battery interior. The discharge paths contain no point left of the shunt at x = 160, excluding the disconnected battery branch. The active switch connection is included. Markers wrap along their assigned path without changing direction or velocity; endpoints fade and no CSS transition carries a marker between disconnected endpoints. Plate-surface charge remains a separate representation.

There is **no new requestAnimationFrame loop, timer, CSS animation, or per-particle React state**. Small fixed groups of markers update together with the existing 30 Hz simulation commits. Playback speed is applied once, by the existing simulation clock. The phase is evaluated at that resulting simulation time; wall time never enters the marker calculation. Pause, hidden-tab handling, resume, reset and graph replay therefore follow the existing time policy. Normal rendering cannot restart the phase.

The maximum visual rate also keeps a worst-case 5× playback step, including the existing 0.1-second frame-stall cap plus a pending 30 Hz commit, below half the marker spacing. This prevents a repeated marker pattern from appearing to reverse through temporal aliasing in the tested frame-stall scenario.

Reduced motion uses stationary markers and clear signed-direction arrows while the accurate measurements and graphs keep updating. A server-rendering guard in the existing reduced-motion hook avoids requiring `matchMedia` during the rendering/security unit tests; its normal browser behavior and cleanup are preserved.

## Validation results

| Check | Result |
| --- | --- |
| `npm test` | **81 passed**: 30 existing physics, 40 existing rendering/security, 11 new motion/path tests |
| `npm run test:e2e` | **48 passed in 4.2 minutes**: all 38 existing browser tests plus 10 new current-animation tests |
| `npm run build` | **Passed** TypeScript and Vite production bundling |
| Production animation smoke | **Passed** current/graph agreement, signed motion, continuous switching, pause, zero CSS animation clocks and no browser errors |
| Existing production preview captures | **Passed** all three tabs at 390/1440 px, including existing mobile ordering |
| `git diff --check` | **Passed** |

The physics engine file `src/physics.ts` has no changes. Existing tests still verify exact switched trajectories, voltage/charge continuity, charge/discharge fractions, numerical challenges, prediction trials, dielectric boundaries and completing Experiment 1. Graph calculations, current/charge lessons and the collapsible time-constant panel are unchanged.

New unit checks verify a fixed monotonic signed speed mapping; monotonic charging/discharging current and speed through five time constants; the `e⁻¹` current ratio; agreement of phase derivative with the engine-current-driven visual speed; exact phase continuity and common-wire positions at partial-charge switches; time/frame partition independence at 30, 60, 120 and 144 Hz; zero-current stopping; both signed wraps; exclusion of the gap and disconnected battery branch; and the maximum-step spacing bound.

New browser tests use controlled simulated timestamps and inspect **all marker coordinates**, signed displacement, current, speed, graph cursor position and readout values over time. Each charging/discharging sequence contains 25 snapshots spanning more than five time constants. They check actual path wrapping, partial discharge/recharge, fully charged discharge, repeated pause/resume, all playback settings (0.25×/1×/2×/5×), zero current, reduced motion and delayed frame delivery at maximum current and 5× playback. No independent CSS animations or browser animation warnings were found.

Motion sequences cover 320×640, 390×844, 834×1194, 1194×834 and 1440×1000. The complete existing layout/notation/disclosure suite additionally covers 360, 430, 768 and 1024 px widths and touch-enabled iPad portrait/landscape. Actual circuit frames at multiple charging and discharging times were visually inspected, together with reduced-motion and tablet/desktop captures. No reversed branch, gap-crossing marker, unexpected phase reset or clipping was observed.

The existing local animation sample recorded 109 frame intervals, median 16.7 ms, p95 16.8 ms and zero long tasks in headless Chromium at 1280×720. This is workstation evidence, not a physical-phone performance guarantee.

## Evidence and reproduction

- [Original computed CSS offsets](artifacts/rc-current/before.json).
- [Charging coordinate sequence, 390 px](artifacts/rc-current/charge-390.json).
- [Discharging coordinate sequence, 390 px](artifacts/rc-current/discharge-390.json).
- [Production motion smoke data](artifacts/rc-current/production-motion.json).
- Charging frames near [one time constant](artifacts/rc-current/charge-390-4.png), [three time constants](artifacts/rc-current/charge-390-12.png), [five time constants](artifacts/rc-current/charge-390-20.png).
- Discharging frames near [one time constant](artifacts/rc-current/discharge-390-4.png), [three time constants](artifacts/rc-current/discharge-390-12.png), [five time constants](artifacts/rc-current/discharge-390-20.png).
- [Tablet charging frame](artifacts/rc-current/charge-834-4.png), [desktop charging frame](artifacts/rc-current/charge-1440-4.png), [reduced-motion discharge](artifacts/rc-current/reduced-motion-discharge.png).

Run `npx playwright test tests/current-animation.spec.ts` for the focused browser regressions. Coordinate snapshots are also attached to those tests as `signed-motion-samples`. `npm test` and `npm run test:e2e` run the complete suites. Browser screenshots and the captured coordinate JSON are retained under `artifacts/rc-current/`.

## Limits

- Markers and their endpoint recycling represent current qualitatively, not microscopic carrier trajectories or drift velocity.
- The existing manual graph-inspection cursor can intentionally show a historical point. Live animation and readouts continue at simulation time unless paused or replayed; live-cursor synchronization is what the motion tests verify. This inspection behavior was preserved.
- Validation used Chromium and viewport/device emulation, not physical phones, iPads or Safari. No device-wide frame-rate claim is made.

## Files changed

- `src/currentMotion.ts` (new): presentation mapping, analytical phase integration using engine samples, active conducting geometry and marker placement.
- `src/currentMotion.test.ts` (new): 11 focused motion, switching and path regressions.
- `src/RCLab.tsx`: supply authoritative time and phase to the circuit renderer.
- `src/ui.tsx`: signed-current particles, correct active topology, static direction arrows, qualitative caption and SSR-safe reduced-motion initialization. RCGraphs calculations are unchanged.
- `src/styles.css`: remove the old RC keyframe/duration system; add static particle/arrow styles.
- `tests/current-animation.spec.ts` (new): 10 controlled-time browser animation regressions and motion evidence.
- `RC_CURRENT_VALIDATION.md` (new): root-cause evidence and this completion report.

No dependencies, production configuration, remote configuration or hosting projects changed. **No commit, push, branch change or deployment occurred.** Deployment requires separate authorization.
