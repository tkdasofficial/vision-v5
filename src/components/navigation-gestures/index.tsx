import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "@tanstack/react-router";
import { useAuth } from "@/context/AuthContext";
import { useLocation, useNavigate } from "@/lib/router-compat";
import AppDrawerView from "@/components/app-drawer";
import { isMotionReduced } from "@/lib/app-motion";
import { classifyRoute } from "@/lib/route-access";
import { DRAWER_EVENT, drawerProgress, settleDrawer, springStep } from "@/lib/navigation-motion";

type Drag = { id: number; x: number; y: number; lastX: number; time: number; start: number; velocity: number; kind: "drawer" | "back"; active: boolean };

/** Only the overlay moves; the routed workspace and its live stream stay mounted. */
export default function NavigationGestures() {
  const { user } = useAuth();
  const router = useRouter();
  const location = useLocation();
  const navigate = useNavigate();
  const enabled = Boolean(user) && classifyRoute(location.pathname) === "protected" && !location.pathname.startsWith("/admin") && location.pathname !== "/drawer";
  const [visible, setVisible] = useState(false);
  const layer = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const frame = useRef(0);
  const opened = useRef(false);
  const settleRef = useRef<(open: boolean, velocity?: number) => void>(() => {});
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const lastFocus = useRef<HTMLElement | null>(null);
  const current = useRef({ enabled, navigate, router });
  current.current = { enabled, navigate, router };
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

  useEffect(() => { cancelAnimationFrame(frame.current); drag.current = null; dismiss(); }, [location.pathname, location.searchStr]);
  useEffect(() => {
    const open = (event: Event) => {
      if (!current.current.enabled) return;
      event.preventDefault(); settleRef.current(true);
    };
    const down = (event: PointerEvent) => {
      if (!current.current.enabled || event.pointerType !== "touch" || !event.isPrimary || drag.current) return;
      if (document.querySelector("[role='dialog']:not([data-navigation-drawer]), [role='alertdialog'], [role='menu'][data-state='open']")) return;
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("input, textarea, select, [contenteditable=true], [role=slider], [data-navigation-gesture=off]")) return;
      const edge = event.clientX <= 24;
      if (!opened.current && !edge && event.target.closest("button, a, [role=button], pre, table, [role=tablist]")) return;
      if (!opened.current && !edge && !current.current.router.history.canGoBack()) return;
      cancelAnimationFrame(frame.current);
      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, time: performance.now(), start: opened.current ? progress.current : 0, velocity: 0, kind: opened.current || edge ? "drawer" : "back", active: false };
    };
    const move = (event: PointerEvent) => {
      const gesture = drag.current;
      if (!gesture || gesture.id !== event.pointerId) return;
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
      if (!gesture.active) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
        if (Math.abs(dy) >= Math.abs(dx) || (gesture.start === 0 && dx < 0)) {
          drag.current = null;
          if (opened.current) settleRef.current(gesture.start > 0.5);
          return;
        }
        gesture.active = true; suppressClick.current = true;
        if (gesture.kind === "drawer") show();
      }
      event.preventDefault();
      const now = performance.now();
      gesture.velocity = (event.clientX - gesture.lastX) / Math.max(1, now - gesture.time) * 1000 / window.innerWidth;
      gesture.time = now; gesture.lastX = event.clientX;
      if (gesture.kind === "drawer") paint(drawerProgress(gesture.start, dx, window.innerWidth));
    };
    const release = (event: PointerEvent) => {
      const gesture = drag.current;
      if (!gesture || gesture.id !== event.pointerId) return;
      drag.current = null;
      const cancelled = event.type === "pointercancel";
      if (performance.now() - gesture.time > 100) gesture.velocity = 0;
      if (gesture.kind === "back") {
        if (!cancelled && gesture.active && settleDrawer(drawerProgress(0, event.clientX - gesture.x, window.innerWidth), gesture.velocity)) current.current.navigate(-1);
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
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointermove", move, { capture: true, passive: false });
    document.addEventListener("pointerup", release, true);
    document.addEventListener("pointercancel", release, true);
    document.addEventListener("click", click, true);
    return () => {
      cancelAnimationFrame(frame.current);
      document.removeEventListener(DRAWER_EVENT, open);
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerup", release, true);
      document.removeEventListener("pointercancel", release, true);
      document.removeEventListener("click", click, true);
      media.removeEventListener("change", preference); observer.disconnect();
    };
  }, []);
  if (!enabled) return null;
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