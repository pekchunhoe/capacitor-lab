import { rcState, type RCParameters, type Segment } from './physics';

// Presentation units only: SVG units per simulated second, not carrier drift speed.
// At 5× playback, even the existing 0.1 s frame-stall cap plus one pending
// 30 Hz commit advances less than half a marker spacing (avoids strobing).
export const MAX_CURRENT_SPEED = 36;
export const CURRENT_SCALE = 1e-3;
export const CURRENT_STOP = 1e-9;
export function currentVisualSpeed(current: number): number {
  const magnitude = Math.abs(current);
  return magnitude <= CURRENT_STOP ? 0 : Math.sign(current) * MAX_CURRENT_SPEED * magnitude / (CURRENT_SCALE + magnitude);
}

/** Exact integral of the visual speed mapping over existing engine intervals.
 * Samples come exclusively from rcState; this does not calculate a second current.
 * Phase is a function of simulation history/time, with no independent animation clock.
 */
export function currentPhase(p: RCParameters, segments: Segment[], time: number): number {
  let phase = 0;
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index], end = Math.min(time, segments[index + 1]?.start ?? time);
    if (segment.start >= time) break;
    if (end <= segment.start) continue;
    const startState = rcState(p, segment, segment.start), endState = rcState(p, segment, end);
    const start = Math.max(CURRENT_STOP, Math.abs(startState.i)), finish = Math.max(CURRENT_STOP, Math.abs(endState.i));
    phase += Math.sign(startState.i) * MAX_CURRENT_SPEED * startState.tau * Math.log1p((start - finish) / (CURRENT_SCALE + finish));
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
  const length = CURRENT_PATHS[name].length, count = Math.max(1, Math.floor(length / 48));
  return Array.from({ length: count }, (_, index) => {
    const distance = wrapDistance((index + .5) * length / count + phase, length);
    return { ...pointOnCurrentPath(name, distance), distance,
      // Drawn path endpoints fade, rather than implying transport across the gap.
      opacity: Math.min(1, distance / 10, (length - distance) / 10) * .95 };
  });
}
