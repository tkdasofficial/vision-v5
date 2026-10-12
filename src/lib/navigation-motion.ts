export type NavigationDirection = "forward" | "back" | "left" | "to-left";
export const DRAWER_EVENT = "vision:open-drawer";

/** Gesture surfaces: Chat (drawer ← → Projects), Projects (→ Chat), drawer pages (← drawer). */
export type GestureSurface = "chat" | "projects" | "drawer-page" | "other";
export const DRAWER_PAGES = ["/library", "/integrations", "/settings"] as const;
export function gestureSurface(pathname: string): GestureSurface {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (p === "/chat" || /^\/chat\/[^/]+$/.test(p)) return "chat";
  if (p === "/projects") return "projects";
  if ((DRAWER_PAGES as readonly string[]).includes(p)) return "drawer-page";
  return "other";
}
/** Which navigation a horizontal swipe (dx > 0 = left→right) performs on a surface; null = none. */
export function swipeAction(surface: GestureSurface, dx: number): "drawer" | "projects" | "to-chat" | "to-drawer" | null {
  if (surface === "chat") return dx > 0 ? "drawer" : "projects";
  if (surface === "projects") return dx > 0 ? "to-chat" : null;
  if (surface === "drawer-page") return dx < 0 ? "to-drawer" : null;
  return null;
}
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