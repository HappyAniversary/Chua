/** Clamp stalled frames equally in movement and animation. */
export function motionDelta(delta: number): number {
  return Math.max(0, Math.min(Number.isFinite(delta) ? delta : 0, 0.1));
}

export function displacementIsWalking(distance: number, delta: number): boolean {
  return delta > 0 && distance / delta > 0.025;
}

/** Phase follows travelled metres, so a blocked avatar never runs in place. */
export function advanceWalkPhase(phase: number, distance: number): number {
  return (phase + Math.max(0, distance) * 3.1) % (Math.PI * 2);
}

export function resolveMotionInSteps(
  fromX: number, fromZ: number, toX: number, toZ: number,
  resolve: (x: number, z: number, nextX: number, nextZ: number) => { x: number; z: number },
): { x: number; z: number } {
  const distance = Math.hypot(toX - fromX, toZ - fromZ);
  const steps = Math.max(1, Math.ceil(distance / 0.12));
  const dx = (toX - fromX) / steps;
  const dz = (toZ - fromZ) / steps;
  let point = { x: fromX, z: fromZ };
  for (let i = 0; i < steps; i++) point = resolve(point.x, point.z, point.x + dx, point.z + dz);
  return point;
}
