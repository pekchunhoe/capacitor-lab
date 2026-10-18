import { describe, it, expect } from 'vitest';
import * as p from './physics';
const params = { r: 1e4, c: 100e-6, source: 12 };
const start = [{ start: 0, initial: 0, target: 12 }];
describe('capacitance and networks', () => {
  it('defines capacitance as Q/V', () => expect(p.capacitance(24e-6, 12)).toBeCloseTo(2e-6, 12));
  it('calculates the prescribed 2 µF / 3 µF example', () => {
    expect(p.equivalent([2e-6, 3e-6], 'series')).toBeCloseTo(1.2e-6, 12);
    expect(p.equivalent([2e-6, 3e-6], 'parallel')).toBeCloseTo(5e-6, 12);
  });
  for (const cs of [[2e-6, 3e-6], [1e-6, 4e-6, 9e-6, 7e-6]]) {
    it(`conserves series voltage and equal charge (${cs.length})`, () => {
      const n = p.network(cs, 12, 'series');
      n.branches.forEach(b => expect(b.q).toBeCloseTo(n.q, 12));
      expect(n.branches.reduce((s, b) => s + b.v, 0)).toBeCloseTo(12, 12);
      expect(n.branches.reduce((s, b) => s + b.u, 0)).toBeCloseTo(n.u, 12);
    });
    it(`conserves parallel charge and equal voltage (${cs.length})`, () => {
      const n = p.network(cs, 12, 'parallel');
      n.branches.forEach(b => expect(b.v).toBe(12));
      expect(n.branches.reduce((s, b) => s + b.q, 0)).toBeCloseTo(n.q, 12);
    });
  }
  it('agrees across all three energy equations; doubled V quadruples U', () => {
    const c = 100e-6, v = 9, q = p.charge(c, v);
    expect(p.energy(c, v)).toBeCloseTo(p.energyQV(q, v), 12);
    expect(p.energy(c, v)).toBeCloseTo(p.energyQC(q, c), 12);
    expect(p.energy(c, v * 2)).toBeCloseTo(4 * p.energy(c, v), 12);
  });
});
describe('exact RC trajectories', () => {
  it('has τ = 1 second and correct charging fractions and limits', () => {
    expect(p.timeConstant(params.r, params.c)).toBe(1);
    expect(p.sampleRC(params, start, 0).q).toBe(0);
    expect(p.sampleRC(params, start, 0).i).toBe(12 / 1e4);
    expect(p.sampleRC(params, start, 1).q / (params.c * 12)).toBeCloseTo(0.63212056, 7);
    expect(p.sampleRC(params, start, 5).q / (params.c * 12)).toBeCloseTo(0.99326205, 7);
    expect(p.sampleRC(params, start, 100).v).toBe(12);
    expect(p.sampleRC(params, start, 100).i).toBeCloseTo(0, 12);
  });
  it('has correct discharge values and signed current', () => {
    const s = [{ start: 0, initial: 7, target: 0 }];
    expect(p.sampleRC(params, s, 0).q).toBeCloseTo(params.c * 7, 12);
    expect(p.sampleRC(params, s, 1).v / 7).toBeCloseTo(0.36787944, 7);
    expect(p.sampleRC(params, s, 0).i).toBe(-7 / params.r);
  });
  it('preserves charge and voltage at arbitrary switching instants in both directions', () => {
    let segments = start;
    for (const [t, charging] of [[0.378, false], [0.942, true], [2.123, false]] as const) {
      const before = p.sampleRC(params, segments, t);
      segments = p.transition(params, segments, t, charging);
      const after = p.sampleRC(params, segments, t);
      expect(after.v).toBeCloseTo(before.v, 12);
      expect(after.q).toBeCloseTo(before.q, 12);
      expect(charging ? after.i >= 0 : after.i <= 0).toBe(true);
    }
    expect(segments).toHaveLength(4);
  });
  it('supports deterministic restart when R, C or source changes', () => {
    for (const next of [{ ...params, r: 2e4 }, { ...params, c: 200e-6 }, { ...params, source: 6 }]) {
      const fresh = [{ start: 0, initial: 0, target: next.source }];
      expect(p.sampleRC(next, fresh, 0).q).toBe(0);
      expect(p.sampleRC(next, fresh, p.timeConstant(next.r, next.c)).v / next.source).toBeCloseTo(1 - Math.exp(-1), 12);
    }
  });
  it('continues a partial-charge recharge from its actual state over the next interval', () => {
    let segments = p.transition(params, start, .4, false);
    const beforeRecharge = p.sampleRC(params, segments, .7);
    segments = p.transition(params, segments, .7, true);
    const afterOneTau = p.sampleRC(params, segments, 1.7);
    const expectedVoltage = params.source + (beforeRecharge.v - params.source) * Math.exp(-1);
    expect(afterOneTau.v).toBeCloseTo(expectedVoltage, 12);
    expect(afterOneTau.q).toBeCloseTo(params.c * expectedVoltage, 12);
    expect(afterOneTau.i).toBeCloseTo((params.source - expectedVoltage) / params.r, 12);
    // The zero-start teaching equation must not replace this switched trajectory.
    expect(afterOneTau.v).toBeGreaterThan(params.source * (1 - Math.exp(-1)));
  });
  it('does not lose tiny-time charge growth', () => expect(p.sampleRC(params, start, 1e-17).q).toBeGreaterThan(0));
});
describe('geometry, dielectrics and boundary conditions', () => {
  const c0 = p.plateCapacitance(0.02, 0.001);
  it('uses the specified ε0 and geometry scaling', () => {
    expect(c0).toBe(p.EPSILON_0 * 0.02 / 0.001);
    expect(p.plateCapacitance(0.04, 0.001)).toBe(2 * c0);
    expect(p.plateCapacitance(0.02, 0.002)).toBe(c0 / 2);
    expect(p.plateCapacitance(0.02, 0.001, 1)).toBe(c0);
    expect(p.plateCapacitance(0.02, 0.001, 4, 0.5)).toBe(2.5 * c0);
  });
  it('quadruples C, Q and U at constant source voltage, retaining net field', () => {
    const air = p.dielectric(c0, 12, null, 0.001), filled = p.dielectric(c0 * 4, 12, null, 0.001);
    expect(filled.v).toBe(air.v); expect(filled.q).toBe(4 * air.q); expect(filled.u).toBe(4 * air.u); expect(filled.field).toBe(air.field);
  });
  it('preserves actual charge on isolation; quarters V, U and E with εr=4', () => {
    const air = p.dielectric(c0, 9, null, 0.001), isolated = p.dielectric(c0 * 4, 12, air.q, 0.001);
    expect(isolated.q).toBe(air.q); expect(isolated.v).toBe(air.v / 4); expect(isolated.u).toBe(air.u / 4); expect(isolated.field).toBe(air.field / 4);
    const reconnected = p.dielectric(c0 * 4, 12, null, 0.001);
    expect(reconnected.v).toBe(12);
  });
});
describe('experimental calculations, units and input domains', () => {
  it('determines C and percentage error', () => { expect(p.measuredCapacitance(1, 1e4)).toBe(100e-6); expect(p.percentError(98, 100)).toBe(2); });
  it('converts engineering units and tolerates rounded student answers', () => {
    expect(p.fromUnit(100, 'µF')).toBeCloseTo(1e-4, 14); expect(p.fromUnit(10, 'kΩ')).toBe(1e4);
    expect(p.closeAnswer(1.19e-6, 1.2e-6)).toBe(true); expect(p.closeAnswer(1e-6, 1.2e-6)).toBe(false);
    expect(p.format(1.2e-6, 'F')).toBe('1.2 µF'); expect(p.format(-0.0012, 'A')).toBe('-1.2 mA');
  });
  const invalid = [() => p.timeConstant(0, 1), () => p.timeConstant(1, NaN), () => p.charge(-1, 2), () => p.energy(1, Infinity), () => p.equivalent([], 'series'), () => p.plateCapacitance(0, 1), () => p.plateCapacitance(1, 0), () => p.plateCapacitance(1, 1, 0.9), () => p.plateCapacitance(1, 1, 4, 2), () => p.measuredCapacitance(-1, 2), () => p.fromUnit(1, 'watts'), () => p.energy(1e300, 1e300)];
  invalid.forEach((fn, i) => it(`rejects invalid or overflowing values ${i + 1}`, () => expect(fn).toThrow(RangeError)));
});
