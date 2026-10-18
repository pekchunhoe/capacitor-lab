# Capacitor Lab · Semester 2

A client-side TypeScript/React laboratory for **SP025 Chapter 2: Capacitors and Dielectrics**. Semester 2 is the permanent display identity; SP025 is the curriculum version. No accounts, backend, paid services, external fonts or image downloads are needed by the running application.

## Run locally

Node.js 22.12+ or 24+ is recommended for the pinned Vite version.

```powershell
npm install
npm run dev
```

Open **http://127.0.0.1:5173/** (the terminal reports a different port if 5173 is occupied).

```powershell
npm test
npm run test:e2e
npm run build
npm run preview
```

Playwright starts a local Vite server for its tests, or reuses one already running on 5173. If Chromium is not installed for Playwright, run `npx playwright install chromium`. The production output is `dist/`; `npm run preview` serves that output at the address printed by Vite, normally http://127.0.0.1:4173/.

With the dev server running, `node scripts/capture-preview.mjs` saves six representative desktop/mobile screenshots in `artifacts/` and verifies that mobile controls immediately follow the apparatus.
Pass a different preview address as its first argument to check a production preview, for example `node scripts/capture-preview.mjs http://127.0.0.1:4173/`.

## Three independent laboratories

| Tab | Implemented experiments and syllabus coverage |
| --- | --- |
| **2.1 Capacitance** | Definition C = Q/V; voltage and capacitance controls; charge and electric-field overlays; 2–4 capacitor series/parallel builder; per-capacitor Q, V and U; conservation checks; arrangement comparison; energy gauge; all three equivalent energy expressions; voltage-doubling prediction. |
| **2.2 RC Circuits** | Charge/discharge switching; actual partially charged initial conditions; exact exponential solutions; pause/resume/reset; 0.25×–5× playback; signed current; synchronized Q–t and I–t graphs; shared live/inspection cursor; piecewise switch markers; τ, 2τ, 3τ and 5τ markers; exact time-constant fractions; unknown-capacitance Experiment 1. |
| **2.3 Dielectrics** | εr = C/C₀; ε₀A/d geometry model; adjustable area and separation; full dielectric insertion; polarization and bound-charge illustration; material/custom εr; connected fixed-V and isolated fixed-Q cases; actual charge preserved on isolation; net field E = V/d; source reconnection at ideal equilibrium. |

All three tabs provide **Explore, Predict, Challenges, and Virtual experiment** controls. The prescribed **Experiment 1: Capacitor** is in 2.2; the investigations in 2.1 and 2.3 are explicitly labeled enrichment. Predict commits an answer before running a specified controlled trial. Challenges include three difficulty levels, unit selection, hints, retries, worked solutions, and a 2% numerical tolerance.

Experiment 1 keeps C and numerical τ hidden, replaces the charge graph with a voltage graph, and removes τ markers until assessment/reveal. Students record distinct stopwatch/voltmeter readings bracketing the 63.2% crossing, enter measured τ and calculated C, and receive percentage errors and calculation feedback. Reference reveal is optional. Trial resets clear readings and results. Data are deterministic ideal simulated readings with no added noise.

## Architecture and numerical policies

- `src/physics.ts`: pure SI-unit calculations, input-domain validation, stable network equivalents, energy identities, analytical RC segments, dielectric boundaries, formatting, unit conversion and experiment checking.
- `src/ui.tsx`: reusable accessible controls, pseudo-3D SVG apparatus, network topology, exact synchronized graphs, and expanded views with keyboard focus handling.
- `src/CapacitanceLab.tsx`, `src/RCLab.tsx`, `src/DielectricLab.tsx`: separate state owners; tab navigation keeps their settings mounted and pauses inactive RC playback.
- `src/learning.tsx`: prediction trials, deterministic numerical challenge generation, guided investigations and the measurement/assessment workflow. Answers use the same physics engine as the apparatus and graphs.
- `src/main.tsx`: chapter navigation and separate semester/curriculum identity.

RC evolution uses Vc = V∞ + (Vinitial − V∞) exp(−Δt/RC), with `expm1` for small charging times and direct `exp` for stable discharge tails. Charge and voltage remain continuous across charge/discharge switches; signed current may jump. Each switch adds an analytical segment and a visible graph marker. Graphs include future projections, explicitly labeled, and never use frame-dependent numerical integration.

Changing **R, C or source voltage restarts a discharged trial**, pauses playback and clears measurements. This intentionally avoids implying a particular physical process for replacing components during a transient. Changing playback speed does not alter the circuit equations. Graph replay discards switch events after the selected time.

The scheduler accumulates elapsed time, freezes when the page is hidden, and caps a stalled frame's real-time contribution at 0.1 s. UI commits are capped at 30 Hz. A trial pauses at 8τ after the last switch; its analytical curve remains inspectable. Trial history and measurement tables are bounded at 200 events/readings. Animation frames and event listeners are cleaned up.

For dielectrics, ε₀ = **8.8541878128 × 10⁻¹² F m⁻¹**. Full uniform filling with a linear dielectric and negligible fringing is the syllabus model. Smooth lateral insertion uses the valid enrichment model C = C₀[1 + f(εr − 1)] at **every animation step**, where f is the fraction of plate area filled through the complete gap thickness. Isolating the capacitor during motion captures its actual instantaneous free charge. Reconnecting the ideal source immediately establishes its voltage; no fictitious RC transient is shown.

The directly adjustable capacitor in 2.1 is conceptual; its drawing carries **no numerical geometry claim**. The geometry-based model belongs to 2.3. Plate charge-symbol density and field-arrow strength are qualitative, while all measurement values are calculated quantitatively. Conventional-current indicators move only in conducting wires. No electron markers cross an insulating gap. The energy gauge represents field energy, not a fluid reservoir.

Material presets (air 1, paper 3, glass 5, plastic 2.5, ceramic 10) are explicitly illustrative values, not universal material constants. Actual permittivity depends on composition, temperature and frequency; ceramic values vary especially widely.

## Mobile and accessibility

The apparatus receives visual priority. On phones, controls follow it immediately, ahead of equations and supplemental panels. Four compact live readings remain together. Large controls, sliders with numeric alternatives, horizontal-overflow prevention, keyboard tab-list navigation, visible focus, symbol-based charge signs, graph descriptions, reduced-motion handling and expanded apparatus/graph views support touch and keyboard operation. Expanded views support Escape, focus containment and focus restoration. No feature requires hover, right-click, login or WebGL.

## Validation

- Physics tests cover the required 2 µF/3 µF network results, Kirchhoff/conservation identities, all energy formulas, τ = 1 s, charging/discharge fractions, current signs, arbitrary switch continuity, component-change restart rules, dielectric fixed-V/fixed-Q behavior, geometry, unit conversion and invalid/overflowing inputs.
- Browser tests exercise the three tabs and independent settings, network construction, correct/incorrect numerical answers, all prediction trials, RC playback and graph replay, dielectric insertion and boundaries, invalid-input reset, the complete measurement activity, expanded views, keyboard navigation and reduced motion.
- Layout tests check **320×640, 360×800, 390×844, 430×932, 768×1024 and 1440×1000** CSS pixels and capture representative screenshots. Browser errors and horizontal overflow are checked. These are browser simulations on a workstation, not physical-device tests.
- A short headless Chromium animation profile records median/p95 frame intervals and long tasks as a Playwright attachment. It is a local measurement, not a guaranteed Android frame rate. See `VALIDATION.md` for the actual latest results and limitations.

## Scope and limitations

No prior application or routes existed in this folder. No uploaded curriculum PDF was available, so coverage follows the supplied Chapter 2 syllabus text rather than independently verified PDF page 7. The app does not include a service worker or promise offline reloads before its assets have been cached. Settings persist while switching tabs, not across page reloads. No personal information is stored.

Physical Android/iPhone performance, actual Safari/iOS behavior, and a full WCAG 2.2 AA audit remain unverified. Core browser interactions are tested in Chromium. Material presets and the ideal capacitor models are educational approximations with the assumptions described above.

Implementation and testing are local only. **No Git commit, push, hosting registration, deployment or production configuration change was performed.**
