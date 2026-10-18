import { describe, expect, it } from 'vitest';
import { rcState, sampleRC, transition } from './physics';
import { activeCurrentPaths, CURRENT_PATHS, CURRENT_STOP, CURRENT_MARKER_SPACING, CURRENT_PARTICLE_DENSITY, MAX_CURRENT_SPEED, currentMarkers, currentPhase, currentReference, currentVisualSpeed, pointOnCurrentPath, wrapDistance } from './currentMotion';

const p = { r: 1e4, c: 100e-6, source: 12 };
const charge = [{ start: 0, initial: 0, target: 12 }];
const reference = currentReference(p);
describe('current-driven visual phase', () => {
  it('has a fixed signed monotonic mapping with a bounded visual speed', () => {
    const currents = [0, CURRENT_STOP, 1e-8, 1e-6, 1e-4, .0012, .024];
    const speeds = currents.map(current => currentVisualSpeed(current, .024));
    expect(speeds[0]).toBe(0); expect(speeds[1]).toBe(0);
    for (let index = 2; index < speeds.length; index++) {
      expect(speeds[index]).toBeGreaterThan(speeds[index - 1]);
      expect(speeds[index]).toBeLessThanOrEqual(MAX_CURRENT_SPEED);
      expect(currentVisualSpeed(-currents[index], .024)).toBe(-speeds[index]);
    }
  });
  it.each([['charging', charge], ['discharging', [{ start: 0, initial: 12, target: 0 }]]] as const)('keeps %s direction and slows throughout five time constants', (_, segments) => {
    const direction = Math.sign(sampleRC(p, [...segments], 0).i);
    let previousCurrent = Infinity, previousSpeed = Infinity, previousPhase = 0;
    for (let t = 0; t <= 5; t += .05) {
      const current = sampleRC(p, [...segments], t).i, speed = currentVisualSpeed(current, reference), phase = currentPhase(p, [...segments], t);
      expect(Math.sign(current)).toBe(direction); expect(Math.sign(speed)).toBe(direction);
      expect(Math.abs(current)).toBeLessThanOrEqual(previousCurrent);
      expect(Math.abs(speed)).toBeLessThanOrEqual(previousSpeed);
      expect((phase - previousPhase) * direction).toBeGreaterThanOrEqual(0);
      previousCurrent = Math.abs(current); previousSpeed = Math.abs(speed); previousPhase = phase;
    }
    expect(Math.abs(sampleRC(p, [...segments], 1).i / sampleRC(p, [...segments], 0).i)).toBeCloseTo(Math.exp(-1), 12);
  });
  it('phase derivative follows the authoritative signed current under the chosen mapping', () => {
    const segments = transition(p, charge, .7, false);
    for (const t of [.01, .2, .6, .71, 1, 2, 5]) {
      const delta = 1e-5;
      const derivative = (currentPhase(p, segments, t + delta) - currentPhase(p, segments, t - delta)) / (2 * delta);
      expect(derivative).toBeCloseTo(currentVisualSpeed(sampleRC(p, segments, t).i, reference), 6);
    }
  });
  it('retains phase and common-wire marker positions across partial-charge switches', () => {
    let segments = charge;
    for (const [time, charging] of [[1, false], [1.7, true], [2.4, false]] as const) {
      const before = currentPhase(p, segments, time), beforeState = sampleRC(p, segments, time);
      segments = transition(p, segments, time, charging);
      const after = currentPhase(p, segments, time), state = sampleRC(p, segments, time);
      expect(after).toBeCloseTo(before, 12);
      expect(state.v).toBeCloseTo(beforeState.v, 12); expect(state.q).toBeCloseTo(beforeState.q, 12);
      expect(state.i).toBeCloseTo(((charging ? p.source : 0) - beforeState.v) / p.r, 12);
      for (const path of ['upper', 'lower'] as const) expect(currentMarkers(path, after)).toEqual(currentMarkers(path, before));
    }
  });
  it('is independent of frame partitioning, playback speed and repeated rendering', () => {
    for (const hz of [30, 60, 120, 144]) {
      let total = 0, previous = 0;
      for (let frame = 1; frame <= hz * 5; frame++) {
        const phase = currentPhase(p, charge, frame / hz);
        total += phase - previous; previous = phase;
      }
      expect(total).toBeCloseTo(currentPhase(p, charge, 5), 12);
    }
    const before = currentPhase(p, charge, .5);
    expect(currentPhase(p, charge, .5)).toBe(before);
    expect(currentPhase(p, charge, 1) - before).toBeGreaterThan(0);
  });
  it('stops for zero current and stays stopped below the visual threshold', () => {
    const empty = [{ start: 0, initial: 0, target: 0 }];
    expect(currentPhase(p, empty, 10)).toBe(0); expect(currentVisualSpeed(rcState(p, empty[0], 1).i, reference)).toBe(0);
    expect(currentPhase(p, charge, 50)).toBe(currentPhase(p, charge, 100));
    expect(currentVisualSpeed(sampleRC(p, charge, 50).i, reference)).toBe(0);
  });
  it('makes the standard initial motion 4–6 times the previous calibrated baseline', () => {
    const initialCurrent = sampleRC(p, charge, 0).i;
    const previousInitialSpeed = 36 * initialCurrent / (.001 + initialCurrent);
    const speedup = currentVisualSpeed(initialCurrent, reference) / previousInitialSpeed;
    expect(speedup).toBeGreaterThanOrEqual(4); expect(speedup).toBeLessThanOrEqual(6);
    // First 200 ms now travels about 16 SVG units, rather than about 4.
    expect(currentPhase(p, charge, .2)).toBeGreaterThan(15);
    expect(currentPhase(p, charge, .2)).toBeLessThan(17);
  });
  it('uses the fixed trial reference and decays by exactly the same fraction as current', () => {
    const segments = transition(p, charge, 1, false);
    const initialDischarge = sampleRC(p, segments, 1).i;
    expect(Math.abs(currentVisualSpeed(initialDischarge, reference))).toBeCloseTo(MAX_CURRENT_SPEED * (1 - Math.exp(-1)), 12);
    expect(Math.abs(currentVisualSpeed(initialDischarge, reference))).toBeLessThan(MAX_CURRENT_SPEED);
    for (const interval of [charge, [{ start: 0, initial: 12, target: 0 }]]) {
      const initial = sampleRC(p, interval, 0).i, speed = currentVisualSpeed(initial, reference);
      for (const t of [.25, 1, 3, 5, 8]) {
        const current = sampleRC(p, interval, t).i;
        expect(currentVisualSpeed(current, reference) / speed).toBeCloseTo(current / initial, 12);
      }
    }
    expect(Math.abs(currentVisualSpeed(sampleRC(p, charge, 8).i, reference))).toBeLessThan(.03);
  });
  it('integrates above-reference capped inputs consistently without changing engine current', () => {
    const overReference = [{ start: 0, initial: 24, target: 0 }];
    for (const t of [.1, .4, .8, 2]) {
      const h = 1e-5, state = sampleRC(p, overReference, t);
      const derivative = (currentPhase(p, overReference, t + h) - currentPhase(p, overReference, t - h)) / (2 * h);
      expect(derivative).toBeCloseTo(currentVisualSpeed(state.i, reference), 6);
      expect(Math.abs(currentVisualSpeed(state.i, reference))).toBeLessThanOrEqual(MAX_CURRENT_SPEED);
    }
  });
});

describe('conducting paths and signed wrapping', () => {
  it('quadruples the actual eight-marker baseline in both conducting modes', () => {
    expect(CURRENT_PARTICLE_DENSITY).toBe(4);
    for (const charging of [true, false]) {
      const count = activeCurrentPaths(charging).reduce((sum, path) => sum + currentMarkers(path, 0).length, 0);
      expect(count).toBe(32);
    }
    for (const name of Object.keys(CURRENT_PATHS) as (keyof typeof CURRENT_PATHS)[]) {
      const baseline = Math.max(1, Math.floor(CURRENT_PATHS[name].length / CURRENT_MARKER_SPACING));
      expect(currentMarkers(name, 0)).toHaveLength(baseline * 4);
    }
  });
  it('keeps equal arc-length spacing including the seam, for either signed phase', () => {
    for (const name of Object.keys(CURRENT_PATHS) as (keyof typeof CURRENT_PATHS)[]) {
      const length = CURRENT_PATHS[name].length;
      for (const phase of [-1000, -1, 0, 1, 1000]) {
        const markers = currentMarkers(name, phase).sort((a, b) => a.distance - b.distance);
        const spacing = length / markers.length;
        expect(spacing).toBeGreaterThan(29); // More than five particle diameters.
        markers.forEach((marker, index) => {
          expect(wrapDistance(markers[(index + 1) % markers.length].distance - marker.distance, length)).toBeCloseTo(spacing, 10);
        });
      }
    }
  });
  it('moves every dense marker at the unchanged integrated speed and retains them near equilibrium', () => {
    for (const segments of [charge, [{ start: 0, initial: 12, target: 0 }]]) {
      for (const time of [0, .25, 1, 3, 5, 8, 50]) {
        const delta = currentPhase(p, segments, time + .001) - currentPhase(p, segments, time);
        for (const name of activeCurrentPaths(segments[0].target !== 0)) {
          const before = currentMarkers(name, currentPhase(p, segments, time));
          const after = currentMarkers(name, currentPhase(p, segments, time + .001));
          expect(after).toHaveLength(before.length);
          after.forEach((marker, index) => {
            const length = CURRENT_PATHS[name].length;
            const displacement = wrapDistance(marker.distance - before[index].distance + length / 2, length) - length / 2;
            expect(displacement).toBeCloseTo(delta, 10);
          });
        }
      }
    }
    expect(currentPhase(p, charge, .2)).toBeCloseTo(88 * (1 - Math.exp(-.2)), 12);
  });
  it('uses the shunt instead of the disconnected battery branch during discharge', () => {
    expect(activeCurrentPaths(true)).toEqual(['upper', 'lower', 'supply', 'return']);
    expect(activeCurrentPaths(false)).toEqual(['upper', 'lower', 'shunt']);
    expect(pointOnCurrentPath('shunt', 0)).toMatchObject({ x: 160, y: 250 });
    expect(pointOnCurrentPath('shunt', CURRENT_PATHS.shunt.length)).toMatchObject({ x: 250, y: 65 });
  });
  it('never places a marker in the capacitor gap or a battery branch during discharge', () => {
    for (const charging of [true, false]) for (const path of activeCurrentPaths(charging)) {
      for (let phase = -1000; phase < 1000; phase += 7) for (const marker of currentMarkers(path, phase)) {
        expect(marker.x >= 507 && marker.x <= 593 && marker.y > 139 && marker.y < 161).toBe(false);
        if (!charging) expect(marker.x).toBeGreaterThanOrEqual(160);
      }
    }
  });
  it('wraps in either signed direction without bouncing or changing speed', () => {
    for (const path of activeCurrentPaths(true)) for (const phase of [-1000, -1, 0, 1, 1000]) for (const delta of [-.3, .3]) {
      const a = currentMarkers(path, phase), b = currentMarkers(path, phase + delta), length = CURRENT_PATHS[path].length;
      a.forEach((marker, index) => {
        const signedDistance = delta > 0 ? wrapDistance(b[index].distance - marker.distance, length) : -wrapDistance(marker.distance - b[index].distance, length);
        expect(signedDistance).toBeCloseTo(delta, 10);
      });
    }
  });
  it('bounds normal-playback stalled travel below half the dense spacing and 5× travel below half a path', () => {
    const maxStep = MAX_CURRENT_SPEED * (.1 + 1 / 30);
    for (const name of Object.keys(CURRENT_PATHS) as (keyof typeof CURRENT_PATHS)[]) {
      const length = CURRENT_PATHS[name].length, spacing = length / currentMarkers(name, 0).length;
      expect(maxStep).toBeLessThan(spacing / 2);
      // At 5×, missing frames can span several dense spacings. Track stable
      // identities and signed phase, rather than relabeling the nearest dot.
      expect(maxStep * 5).toBeLessThan(length / 2);
    }
  });
});
