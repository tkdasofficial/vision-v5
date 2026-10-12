// Thin adapter so pages ported from the original app keep their simple
// navigation calls while running on TanStack Router.
import { useCallback, useEffect } from "react";
import { consumeClickDirection, requestDrawer, DRAWER_EVENT, type NavigationDirection } from "@/lib/navigation-motion";
import {
  Outlet,
  useNavigate as useTsNavigate,
  useLocation as useTsLocation,
  useParams as useTsParams,
  useRouter,
} from "@tanstack/react-router";

type NavOpts = { replace?: boolean; state?: unknown; direction?: NavigationDirection };

export function useNavigate() {
  const navigate = useTsNavigate();
  const router = useRouter();
  // Stable identity so effects that depend on navigate don't re-run every render.
  return useCallback((to: string | number, opts?: NavOpts) => {
    if (typeof to === "number") {
      if (typeof document !== "undefined" && !document.dispatchEvent(new CustomEvent(`${DRAWER_EVENT}:back`, { cancelable: true }))) return;
      if (to < 0) router.history.go(to);
      return;
    }
    // Split "/path?a=b#h" so TanStack gets a real path plus a search object.
    const u = new URL(to, "http://x");
    const direction = opts?.direction ?? consumeClickDirection();
    if (u.pathname === "/drawer" && router.state.location.pathname !== "/drawer" && requestDrawer()) return;
    const search = Object.fromEntries(u.searchParams.entries());
    void navigate({
      to: u.pathname as never,
      search: (Object.keys(search).length ? search : undefined) as never,
      hash: u.hash ? u.hash.slice(1) : undefined,
      replace: opts?.replace,
      state: { ...(typeof opts?.state === "object" && opts.state ? opts.state : {}), __visionDirection: direction } as never,
    });
  }, [navigate, router]);
}

export function useLocation() {
  return useTsLocation();
}

export function useParams<T extends Record<string, string>>(): Partial<T> {
  return useTsParams({ strict: false } as never) as Partial<T>;
}

export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace });
  }, [to]);
  return null;
}

export { Outlet };
