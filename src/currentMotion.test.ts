import { describe, expect, it } from 'vitest';
import { rcState, sampleRC, transition } from './physics';
import { activeCurrentPaths, CURRENT_PATHS, CURRENT_STOP, MAX_CURRENT_SPEED, currentMarkers, currentPhase, currentVisualSpeed, pointOnCurrentPath, wrapDistance } from './currentMotion';

const p = { r: 1e4, c: 100e-6, source: 12 };
const charge = [{ start: 0, initial: 0, target: 12 }];
describe('current-driven visual phase', () => {
  it('has a fixed signed monotonic mapping with a bounded visual speed', () => {
    const currents = [0, CURRENT_STOP, 1e-8, 1e-6, 1e-4, .0012, .024];
    const speeds = currents.map(currentVisualSpeed);
    expect(speeds[0]).toBe(0); expect(speeds[1]).toBe(0);
    for (let index = 2; index < speeds.length; index++) {
      expect(speeds[index]).toBeGreaterThan(speeds[index - 1]);
      expect(speeds[index]).toBeLessThan(MAX_CURRENT_SPEED);
      expect(currentVisualSpeed(-currents[index])).toBe(-speeds[index]);
    }
  });
  it.each([['charging', charge], ['discharging', [{ start: 0, initial: 12, target: 0 }]]] as const)('keeps %s direction and slows throughout five time constants', (_, segments) => {
    const direction = Math.sign(sampleRC(p, [...segments], 0).i);
    let previousCurrent = Infinity, previousSpeed = Infinity, previousPhase = 0;
    for (let t = 0; t <= 5; t += .05) {
      const current = sampleRC(p, [...segments], t).i, speed = currentVisualSpeed(current), phase = currentPhase(p, [...segments], t);
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
      expect(derivative).toBeCloseTo(currentVisualSpeed(sampleRC(p, segments, t).i), 6);
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
    expect(currentPhase(p, empty, 10)).toBe(0); expect(currentVisualSpeed(rcState(p, empty[0], 1).i)).toBe(0);
    expect(currentPhase(p, charge, 50)).toBe(currentPhase(p, charge, 100));
    expect(currentVisualSpeed(sampleRC(p, charge, 50).i)).toBe(0);
  });
});

describe('conducting paths and signed wrapping', () => {
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
  it('bounds travel below half a marker spacing even with 5× playback and a capped frame stall', () => {
    const maxStep = MAX_CURRENT_SPEED * 5 * (.1 + 1 / 30);
    for (const path of Object.values(CURRENT_PATHS)) {
      const spacing = path.length / Math.max(1, Math.floor(path.length / 48));
      expect(maxStep).toBeLessThan(spacing / 2);
    }
  });
});
