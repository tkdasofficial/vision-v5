export type NavigationDirection = "forward" | "back";
export const DRAWER_EVENT = "vision:open-drawer";
let clickDirection: NavigationDirection | undefined;

/** Consumed synchronously by the shared navigation adapter, never by a later unrelated navigation. */
export function setClickDirection(direction: NavigationDirection) {
  clickDirection = direction;
  queueMicrotask(() => { clickDirection = undefined; });
}
export function consumeClickDirection() {
  const direction = clickDirection;
  clickDirection = undefined;
  return direction;
}
export function requestDrawer(): boolean {
  if (typeof document === "undefined") return false;
  return !document.dispatchEvent(new CustomEvent(DRAWER_EVENT, { cancelable: true }));
}

export function drawerProgress(start: number, delta: number, width: number) {
  return Math.min(1, Math.max(0, start + delta / Math.max(width, 1)));
}
export function settleDrawer(progress: number, velocity: number): boolean {
  // Project 180ms ahead; a deliberate reverse flick can interrupt an opening spring.
  return progress + velocity * 0.18 > 0.5;
}
export function springStep(position: number, velocity: number, target: number, seconds: number) {
  const dt = Math.min(seconds, 0.032);
  const nextVelocity = velocity + ((target - position) * 320 - velocity * 34) * dt;
  return { position: Math.min(1, Math.max(0, position + nextVelocity * dt)), velocity: nextVelocity };
}