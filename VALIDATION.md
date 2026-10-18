# Validation report

**Date:** 17 October 2026 (Asia/Kuala_Lumpur). All work was performed locally.

| Check | Actual result |
| --- | --- |
| TypeScript and production build | Passed: `npm run build` |
| Physics unit tests | **29 passed**, 1 test file, using Vitest |
| Browser interaction tests | **14 passed** in 26.4 seconds, using headless Chromium, including a touch-enabled mobile context |
| Responsive widths | 320, 360, 390, 430, 768 and 1440 CSS px checked; no horizontal page overflow |
| Browser console/runtime errors | None observed in tested responsive and interaction scenarios |
| Production assets | JS 282.53 kB / 88.70 kB gzip; CSS 27.89 kB / 7.04 kB gzip; HTML 0.60 kB |
| Local animation sample | 109 frame intervals over approximately 1.8 seconds; median 16.7 ms; p95 16.8 ms; **0 long tasks** |
| Production browser smoke check | Passed against `vite preview` on port 4173: all three tabs at 390 px and 1440 px, six screenshots, no console/runtime errors; mobile control proximity verified |

The animation measurement used headless Chromium 156 at 1280×720 on this Windows workstation, without phone CPU throttling. UI state commits are intentionally capped at 30 Hz, while the requestAnimationFrame scheduler continues at the browser's rate. This sample is evidence of local responsiveness, **not** a physical-phone benchmark or a guaranteed frame rate.

Physics checks include prescribed capacitance values and RC fractions, energy identities, charge/voltage conservation, exact switch continuity in both directions, restart-on-parameter-change behavior, fixed-V/fixed-Q dielectric behavior, geometry scaling, partial lateral insertion, unit conversion and invalid/overflowing input rejection.

Interaction coverage includes all three subtopics, independent settings, series/parallel construction and comparison, correct/incorrect answers and hard energy-unit checking, all three prediction trials, RC pause/resume and mid-run discharge, graph expansion/inspection/replay, R/C/source restarts, unknown-capacitance measurement and assessment, result clearing on reset, geometry and electrical boundaries, invalid-input reset, keyboard tab navigation, expanded-view Escape behavior, reduced motion, and responsive rendering.

Screenshot review identified a mobile ordering problem: controls originally followed equations and notes. The final layout puts controls directly below the apparatus on phone/tablet layouts. The dielectric animation uses the physical lateral-fill model at every intermediate frame; battery disconnection during motion preserves the actual charge at that instant. The browser test for the air-filled baseline explicitly waits until removal is complete.

## Verification limits

- No physical Android/iPhone tests or actual Safari/iOS tests were available. No device-wide performance claim is made.
- The user-facing embedded-browser service had no available browser surfaces. Local headless Chromium tests and screenshot inspection succeeded independently; open the localhost address in your own browser for a live preview.
- Accessibility features were interaction-tested, but no full WCAG 2.2 AA audit or screen-reader certification was performed.
- No curriculum PDF was present; syllabus coverage follows the supplied request. PDF page 7 was not independently checked.
- Models assume ideal capacitors, linear dielectrics, no leakage and negligible edge effects. Material permittivities are illustrative presets with limitations explained in the UI.
- No automated physics, build or Chromium interaction failures remain from the final validation run.

No commit, push, hosting registration, deployment, production setting change or unrelated feature modification occurred.
