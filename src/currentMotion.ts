import { rcState, type RCParameters, type Segment } from './physics';

// Presentation units only: SVG units per simulated second, not carrier drift speed.
export const MAX_CURRENT_SPEED = 88;
// Density is independent of phase and velocity. Retain the calibrated layout
// as a reference and subdivide each path's spacing into four equal parts.
export const CURRENT_MARKER_SPACING = 120;
export const CURRENT_PARTICLE_DENSITY = 4;
export const CURRENT_STOP = 1e-9;
// A fixed reference for the entire parameter trial, not the decaying current
// or the charge at the latest switch. Partial-charge switches retain their scale.
export function currentReference(p: RCParameters): number {
  return Math.max(CURRENT_STOP, p.source / p.r);
}
export function currentVisualSpeed(current: number, referenceCurrent: number): number {
  const magnitude = Math.abs(current);
  return magnitude <= CURRENT_STOP ? 0 : Math.sign(current) * MAX_CURRENT_SPEED * Math.min(1, magnitude / referenceCurrent);
}

/** Exact integral of the visual speed mapping over existing engine intervals.
 * Samples come exclusively from rcState; this does not calculate a second current.
 * Phase is a function of simulation history/time, with no independent animation clock.
 */
export function currentPhase(p: RCParameters, segments: Segment[], time: number): number {
  let phase = 0; const reference = currentReference(p);
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index], end = Math.min(time, segments[index + 1]?.start ?? time);
    if (segment.start >= time) break;
    if (end <= segment.start) continue;
    const startState = rcState(p, segment, segment.start), endState = rcState(p, segment, end);
    const start = Math.max(CURRENT_STOP, Math.abs(startState.i)), finish = Math.max(CURRENT_STOP, Math.abs(endState.i));
    // In supported trials |I| <= source/R, so displacement is the exact
    // integral of linear normalized current. Also handle above-reference
    // inputs consistently with the visual cap, without changing engine values.
    const cappedTime = startState.tau * Math.log(Math.max(1, start / reference) / Math.max(1, finish / reference));
    const linearTime = startState.tau * (Math.min(start, reference) - Math.min(finish, reference)) / reference;
    phase += Math.sign(startState.i) * MAX_CURRENT_SPEED * (cappedTime + linearTime);
  }
  return phase;
}

type Point = readonly [number, number];
function wire(points: readonly Point[]) {
  const lengths = points.slice(1).map((point, index) => Math.hypot(point[0] - points[index][0], point[1] - points[index][1]));
  return { points, lengths, length: lengths.reduce((sum, length) => sum + length, 0),
    d: points.map((point, index) => `${index ? 'L' : 'M'}${point[0]} ${point[1]}`).join(' ') };
}
// All wires are oriented in the positive charging reference direction.
// Common wires keep their marker positions when the switch changes topology.
export const CURRENT_PATHS = {
  upper: wire([[250, 65], [550, 65], [550, 139]]),
  lower: wire([[550, 161], [550, 250], [160, 250]]),
  supply: wire([[110, 140], [110, 65], [200, 65], [250, 65]]),
  return: wire([[160, 250], [110, 250], [110, 181]]),
  shunt: wire([[160, 250], [160, 105], [200, 105], [250, 65]]),
} as const;
export type CurrentPath = keyof typeof CURRENT_PATHS;
// Allocate the fixed layout once, not on each simulation update. React retains
// each path/index identity; only coordinates and endpoint fading change.
const markerOffsets = Object.fromEntries(Object.entries(CURRENT_PATHS).map(([name, path]) => {
  const count = Math.max(1, Math.floor(path.length / CURRENT_MARKER_SPACING)) * CURRENT_PARTICLE_DENSITY;
  return [name, Object.freeze(Array.from({ length: count }, (_, index) => (index + .5) * path.length / count))];
})) as Record<CurrentPath, readonly number[]>;
export function activeCurrentPaths(charging: boolean): CurrentPath[] {
  return charging ? ['upper', 'lower', 'supply', 'return'] : ['upper', 'lower', 'shunt'];
}
export function wrapDistance(distance: number, length: number): number {
  return ((distance % length) + length) % length;
}
export function pointOnCurrentPath(name: CurrentPath, distance: number) {
  const path = CURRENT_PATHS[name]; let remaining = Math.max(0, Math.min(path.length, distance));
  for (let index = 0; index < path.lengths.length; index++) {
    const length = path.lengths[index];
    if (remaining <= length || index === path.lengths.length - 1) {
      const [x, y] = path.points[index], [endX, endY] = path.points[index + 1];
      return { x: x + (endX - x) * remaining / length, y: y + (endY - y) * remaining / length,
        angle: Math.atan2(endY - y, endX - x) * 180 / Math.PI };
    }
    remaining -= length;
  }
  throw new Error('A current path requires a conducting segment.');
}
export function currentMarkers(name: CurrentPath, phase: number) {
  const length = CURRENT_PATHS[name].length;
  return markerOffsets[name].map(offset => {
    const distance = wrapDistance(offset + phase, length);
    return { ...pointOnCurrentPath(name, distance), distance,
      // Drawn path endpoints fade, rather than implying transport across the gap.
      opacity: Math.min(1, distance / 10, (length - distance) / 10) * .95 };
  });
}
