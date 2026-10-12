import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "@tanstack/react-router";
import { useAuth } from "@/context/AuthContext";
import { useLocation, useNavigate } from "@/lib/router-compat";
import AppDrawerView from "@/components/app-drawer";
import { isMotionReduced } from "@/lib/app-motion";
import { classifyRoute, safeReturnPath } from "@/lib/route-access";
import { DRAWER_EVENT, drawerProgress, gestureSurface, settleDrawer, springStep, swipeAction } from "@/lib/navigation-motion";

type Drag = { id: number; x: number; y: number; lastX: number; time: number; start: number; velocity: number; kind: "drawer" | "back" | "pending" | "projects" | "to-chat" | "to-drawer"; active: boolean };

/** Only the overlay moves; the routed workspace and its live stream stay mounted. */
export default function NavigationGestures() {
  const { user } = useAuth();
  const router = useRouter();
  const location = useLocation();
  const navigate = useNavigate();
  const enabled = Boolean(user) && classifyRoute(location.pathname) === "protected" && !location.pathname.startsWith("/admin");
  const directDrawer = location.pathname === "/drawer";
  const [visible, setVisible] = useState(false);
  const layer = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const frame = useRef(0);
  const opened = useRef(false);
  const settleRef = useRef<(open: boolean, velocity?: number) => void>(() => {});
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const lastFocus = useRef<HTMLElement | null>(null);
  const current = useRef({ enabled, directDrawer, location, navigate, router });
  current.current = { enabled, directDrawer, location, navigate, router };
  const paint = (value: number) => {
    progress.current = value;
    layer.current?.style.setProperty("--drawer-progress", String(value));
  };
  const show = () => {
    if (opened.current) return;
    lastFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    opened.current = true;
    setVisible(true);
  };
  const dismiss = () => { opened.current = false; setVisible(false); paint(0); };
  const settle = (open: boolean, initialVelocity = 0) => {
    cancelAnimationFrame(frame.current);
    if (open) show();
    const target = open ? 1 : 0;
    let velocity = initialVelocity;
    let previous = performance.now();
    const finish = () => {
      paint(target);
      if (!open) dismiss();
      else layer.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    };
    if (isMotionReduced()) { finish(); return; }
    const tick = (now: number) => {
      const next = springStep(progress.current, velocity, target, (now - previous) / 1000);
      previous = now; velocity = next.velocity; paint(next.position);
      if (Math.abs(target - next.position) < 0.001 && Math.abs(velocity) < 0.01) finish();
      else frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };
  settleRef.current = settle;

  const previous = useRef<{ path: string; index?: number } | null>(null);
  useEffect(() => {
    const state = location.state as { __TSR_index?: number; __visionOpenDrawer?: boolean } | undefined;
    const prev = previous.current;
    previous.current = { path: location.pathname, index: state?.__TSR_index };
    cancelAnimationFrame(frame.current); drag.current = null; dismiss();
    // Closing Library/Plugins/Settings returns to the App Drawer, already open.
    const backFromDrawerPage = prev && gestureSurface(prev.path) === "drawer-page" && state?.__TSR_index !== undefined && prev.index !== undefined && state.__TSR_index < prev.index;
    if (enabled && gestureSurface(location.pathname) === "chat" && (state?.__visionOpenDrawer || backFromDrawerPage)) { show(); paint(1); }
  }, [location.pathname, location.searchStr]);
  useEffect(() => {
    const open = (event: Event) => {
      if (!current.current.enabled || current.current.directDrawer) return;
      event.preventDefault(); settleRef.current(true);
    };
    const back = (event: Event) => {
      if (!opened.current) return;
      event.preventDefault(); settleRef.current(false);
    };
    const historyBack = () => { if (opened.current) settleRef.current(false); };
    const down = (event: PointerEvent) => {
      if (!current.current.enabled || event.pointerType !== "touch" || !event.isPrimary || drag.current) return;
      if (document.querySelector("[role='dialog']:not([data-navigation-drawer]), [role='alertdialog'], [role='menu'][data-state='open']")) return;
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("input, textarea, select, [contenteditable=true], [role=slider], [data-navigation-gesture=off]")) return;
      const edge = event.clientX <= 24;
      const drawer = opened.current || current.current.directDrawer;
      if (!drawer && gestureSurface(current.current.location.pathname) !== "other") {
        // Chat, Projects and drawer pages: swipe from anywhere, except horizontally scrolling content.
        if (event.target.closest("pre, table, [role=tablist]")) return;
        for (let node: Element | null = event.target; node; node = node.parentElement) {
          if (node.scrollWidth > node.clientWidth + 2 && /auto|scroll/.test(getComputedStyle(node).overflowX)) return;
        }
        cancelAnimationFrame(frame.current);
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, time: performance.now(), start: 0, velocity: 0, kind: "pending", active: false };
        return;
      }
      if (!drawer && !edge && event.target.closest("button, a, [role=button], pre, table, [role=tablist]")) return;
      let ancestor: Element | null = event.target;
      while (ancestor && !edge && !drawer) {
        if (ancestor.scrollWidth > ancestor.clientWidth + 2 && /auto|scroll/.test(getComputedStyle(ancestor).overflowX)) return;
        ancestor = ancestor.parentElement;
      }
      if (!drawer && !edge && !current.current.router.history.canGoBack()) return;
      cancelAnimationFrame(frame.current);
      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, time: performance.now(), start: current.current.directDrawer ? 1 : opened.current ? progress.current : 0, velocity: 0, kind: drawer || edge ? "drawer" : "back", active: false };
    };
    const move = (event: PointerEvent) => {
      const gesture = drag.current;
      if (!gesture || gesture.id !== event.pointerId) return;
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
      if (!gesture.active) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
        if (gesture.kind === "pending") {
          const action = Math.abs(dy) >= Math.abs(dx) ? null : swipeAction(gestureSurface(current.current.location.pathname), dx);
          if (!action) { drag.current = null; return; }
          gesture.kind = action;
        }
        if (Math.abs(dy) >= Math.abs(dx) || (gesture.start === 0 && dx < 0 && (gesture.kind === "drawer" || gesture.kind === "back"))) {
          drag.current = null;
          if (opened.current) settleRef.current(gesture.start > 0.5);
          return;
        }
        gesture.active = true; suppressClick.current = true;
        if (gesture.kind === "drawer" && !current.current.directDrawer) show();
      }
      event.preventDefault();
      const now = performance.now();
      gesture.velocity = (event.clientX - gesture.lastX) / Math.max(1, now - gesture.time) * 1000 / window.innerWidth;
      gesture.time = now; gesture.lastX = event.clientX;
      if (gesture.kind === "drawer") {
        const value = drawerProgress(gesture.start, dx, window.innerWidth);
        if (current.current.directDrawer) document.querySelector<HTMLElement>("[aria-label='App drawer']")?.style.setProperty("translate", `${(value - 1) * 100}% 0`);
        else paint(value);
      }
    };
    const release = (event: PointerEvent) => {
      const gesture = drag.current;
      if (!gesture || gesture.id !== event.pointerId) return;
      drag.current = null;
      const cancelled = event.type === "pointercancel";
      if (performance.now() - gesture.time > 100) gesture.velocity = 0;
      const dx = event.clientX - gesture.x;
      const commit = (sign: 1 | -1) => !cancelled && gesture.active && settleDrawer(drawerProgress(0, sign * dx, window.innerWidth), sign * gesture.velocity);
      const nav = current.current.navigate;
      const canGoBack = current.current.router.history.canGoBack();
      if (gesture.kind === "pending") { /* never activated */ }
      else if (gesture.kind === "projects") { if (commit(-1)) nav("/projects", { direction: "forward" }); }
      else if (gesture.kind === "to-chat") { if (commit(1)) { if (canGoBack) nav(-1); else nav("/chat", { direction: "back", replace: true }); } }
      else if (gesture.kind === "to-drawer") { if (commit(-1)) { if (canGoBack) nav(-1); else nav("/chat", { direction: "to-left", replace: true, state: { __visionOpenDrawer: true } }); } }
      else if (gesture.kind === "back") {
        if (!cancelled && gesture.active && settleDrawer(drawerProgress(0, event.clientX - gesture.x, window.innerWidth), gesture.velocity)) current.current.navigate(-1);
      } else if (current.current.directDrawer) {
        const page = document.querySelector<HTMLElement>("[aria-label='App drawer']");
        page?.style.removeProperty("translate");
        if (!cancelled && gesture.active && !settleDrawer(drawerProgress(1, event.clientX - gesture.x, window.innerWidth), gesture.velocity)) {
          const target = safeReturnPath(new URLSearchParams(current.current.location.searchStr).get("returnTo"));
          current.current.navigate(target.startsWith("/drawer") ? "/chat" : target, { direction: "back", replace: true });
        } else if (gesture.active && !isMotionReduced()) page?.animate([{ translate: `${(drawerProgress(1, gesture.lastX - gesture.x, window.innerWidth) - 1) * 100}% 0` }, { translate: "0% 0" }], { duration: 260, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
      } else if (gesture.active || opened.current) settleRef.current(cancelled ? gesture.start > 0.5 : settleDrawer(progress.current, gesture.velocity), gesture.velocity);
      window.setTimeout(() => { suppressClick.current = false; }, 0);
    };
    const click = (event: MouseEvent) => {
      if (!suppressClick.current) return;
      event.preventDefault(); event.stopImmediatePropagation(); suppressClick.current = false;
    };
    const preference = () => { if (isMotionReduced() && opened.current) settleRef.current(progress.current >= 0.5); };
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const observer = new MutationObserver(preference);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    media.addEventListener("change", preference);
    document.addEventListener(DRAWER_EVENT, open);
    document.addEventListener(`${DRAWER_EVENT}:back`, back);
    window.addEventListener("popstate", historyBack);
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointermove", move, { capture: true, passive: false });
    document.addEventListener("pointerup", release, true);
    document.addEventListener("pointercancel", release, true);
    document.addEventListener("click", click, true);
    return () => {
      cancelAnimationFrame(frame.current);
      document.removeEventListener(DRAWER_EVENT, open);
      document.removeEventListener(`${DRAWER_EVENT}:back`, back);
      window.removeEventListener("popstate", historyBack);
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerup", release, true);
      document.removeEventListener("pointercancel", release, true);
      document.removeEventListener("click", click, true);
      media.removeEventListener("change", preference); observer.disconnect();
    };
  }, []);
  if (!enabled || directDrawer) return null;
  return <>
    {!visible && <div className="navigation-edge" aria-hidden="true" />}
    <Dialog.Root open={visible} onOpenChange={(open) => settleRef.current(open)}>
      {visible && <Dialog.Portal><div className="navigation-drawer" ref={(node) => { layer.current = node; node?.style.setProperty("--drawer-progress", String(progress.current)); }}>
        <Dialog.Overlay className="navigation-drawer-scrim" />
        <Dialog.Content className="navigation-drawer-panel" data-navigation-drawer aria-describedby={undefined} onOpenAutoFocus={(event) => event.preventDefault()} onCloseAutoFocus={(event) => { event.preventDefault(); if (lastFocus.current?.isConnected) lastFocus.current.focus({ preventScroll: true }); }}>
          <Dialog.Title className="sr-only">Workspace navigation</Dialog.Title>
          <AppDrawerView activeChatId={location.pathname.match(/^\/chat\/([^/]+)$/)?.[1]} onClose={() => settleRef.current(false)} onNewChat={() => { settleRef.current(false); navigate("/chat"); }} onSelectChat={(id) => { settleRef.current(false); navigate(`/chat/${id}`); }} />
        </Dialog.Content>
      </div></Dialog.Portal>}
    </Dialog.Root>
  </>;
}