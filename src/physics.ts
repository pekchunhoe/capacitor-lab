/** All inputs and outputs are SI. Rendering never owns a physics formula. */
export const EPSILON_0 = 8.8541878128e-12;
export function positive(value: number, name = 'Value'): number {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be finite and greater than zero.`);
  return value;
}
export function nonnegative(value: number, name = 'Value'): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be finite and nonnegative.`);
  return value;
}
function finite(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError('The result exceeds the supported numerical range.');
  return value;
}
export function capacitance(q: number, v: number) { return finite(nonnegative(q, 'Charge') / positive(v, 'Voltage')); }
export function charge(c: number, v: number) { return finite(positive(c, 'Capacitance') * nonnegative(v, 'Voltage')); }
export function energy(c: number, v: number) { return finite(0.5 * charge(c, v) * v); }
export function energyQV(q: number, v: number) { return finite(0.5 * nonnegative(q) * nonnegative(v)); }
export function energyQC(q: number, c: number) { return finite(nonnegative(q) / positive(c) * q / 2); }
export function equivalent(cs: number[], topology: 'series' | 'parallel') {
  if (!cs.length) throw new RangeError('At least one capacitor is required.');
  cs.forEach(c => positive(c, 'Capacitance'));
  // Scaling by the smallest capacitor avoids overflow in reciprocal sums.
  const min = Math.min(...cs);
  return positive(finite(topology === 'series' ? min / cs.reduce((s, c) => s + min / c, 0) : cs.reduce((s, c) => s + c, 0)));
}
export function network(cs: number[], v: number, topology: 'series' | 'parallel') {
  const c = equivalent(cs, topology), q = charge(c, v);
  const branches = cs.map(ci => { const qi = topology === 'series' ? q : charge(ci, v); const vi = topology === 'series' ? qi / ci : v; return { c: ci, q: qi, v: vi, u: energy(ci, vi) }; });
  return { c, q, v, u: energy(c, v), branches };
}
export function timeConstant(r: number, c: number) { return positive(finite(positive(r, 'Resistance') * positive(c, 'Capacitance')), 'Time constant'); }
export type RCParameters = { r: number; c: number; source: number };
export type Segment = { start: number; initial: number; target: number };
export function rcState(p: RCParameters, s: Segment, time: number) {
  nonnegative(p.source, 'Source voltage'); nonnegative(s.initial, 'Initial voltage'); nonnegative(s.target, 'Target voltage');
  nonnegative(s.start, 'Segment start'); nonnegative(time, 'Time');
  const tau = timeConstant(p.r, p.c), dt = Math.max(0, time - s.start);
  // Stable even when dt/tau is very small; exact analytical solution.
  const v = s.target === 0 ? s.initial * Math.exp(-dt / tau) : s.initial + (s.target - s.initial) * -Math.expm1(-dt / tau);
  const i = finite((s.target - s.initial) / p.r * Math.exp(-dt / tau));
  return { v, i, q: charge(p.c, v), u: energy(p.c, v), tau };
}
export function transition(p: RCParameters, segments: Segment[], time: number, charging: boolean): Segment[] {
  const v = sampleRC(p, segments, time).v;
  const previous = segments.filter(s => s.start < time);
  return [...previous, { start: time, initial: v, target: charging ? p.source : 0 }];
}
export function sampleRC(p: RCParameters, segments: Segment[], time: number) {
  if (!segments.length) throw new RangeError('A circuit segment is required.');
  let segment = segments[0];
  for (const s of segments) { if (s.start <= time) segment = s; else break; }
  return rcState(p, segment, time);
}
export function plateCapacitance(area: number, gap: number, er = 1, fraction = 1) {
  positive(area, 'Plate area'); positive(gap, 'Plate separation');
  if (!Number.isFinite(er) || er < 1) throw new RangeError('Relative permittivity must be at least 1.');
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) throw new RangeError('Insertion must be between 0 and 1.');
  // Lateral insertion: air and dielectric regions act in parallel, with no fringing.
  return positive(finite(EPSILON_0 * area / gap * (1 + fraction * (er - 1))));
}
export function dielectric(c: number, source: number, isolatedQ: number | null, gap: number) {
  positive(c); positive(gap); nonnegative(source);
  const q = isolatedQ === null ? charge(c, source) : nonnegative(isolatedQ);
  const v = finite(q / c);
  return { c, q, v, u: energy(c, v), field: finite(v / gap) };
}
export function measuredCapacitance(tau: number, r: number) { return finite(positive(tau, 'Measured time constant') / positive(r, 'Resistance')); }
export function percentError(measured: number, reference: number) { return finite(Math.abs(nonnegative(measured) - positive(reference)) / reference * 100); }
export function closeAnswer(answer: number, expected: number, tolerance = 0.02) { return Number.isFinite(answer) && Math.abs(answer - expected) <= Math.max(Math.abs(expected) * tolerance, 1e-15); }
const units: Record<string, number> = { F: 1, mF: 1e-3, 'µF': 1e-6, uF: 1e-6, nF: 1e-9, pF: 1e-12, C: 1, mC: 1e-3, 'µC': 1e-6, uC: 1e-6, nC: 1e-9, V: 1, mV: 1e-3, J: 1, mJ: 1e-3, 'µJ': 1e-6, uJ: 1e-6, nJ: 1e-9, s: 1, ms: 1e-3, A: 1, mA: 1e-3, 'µA': 1e-6, uA: 1e-6, 'Ω': 1, 'kΩ': 1e3 };
export function fromUnit(value: number, unit: string) {
  if (!(unit in units)) throw new RangeError('Unrecognized unit.');
  return finite(value * units[unit]);
}
export function format(value: number, unit: string, digits = 3): string {
  if (!Number.isFinite(value)) return '—';
  const a = Math.abs(value);
  const [scale, prefix] = a === 0 ? [1, ''] : a >= 1e3 ? [1e3, 'k'] : a >= 1 ? [1, ''] : a >= 1e-3 ? [1e-3, 'm'] : a >= 1e-6 ? [1e-6, 'µ'] : a >= 1e-9 ? [1e-9, 'n'] : [1e-12, 'p'];
  return `${Number((value / Number(scale)).toPrecision(digits))} ${prefix}${unit}`;
}
