type MotionLocation = { pathname: string; state?: { __TSR_index?: number; __visionDirection?: "forward" | "back" } };

/** A draft receiving its saved URL is not a page change. */
export function pageTransitionTypes({ fromLocation, toLocation, pathChanged }: {
  fromLocation?: MotionLocation; toLocation: MotionLocation; pathChanged: boolean;
}): string[] | false {
  if (!fromLocation || !pathChanged) return false;
  if (typeof document !== "undefined" && isMotionReduced()) return false;
  if (/^\/chat\/?$/.test(fromLocation.pathname) && /^\/chat\/[^/]+\/?$/.test(toLocation.pathname) && toLocation.pathname !== "/chat/incognito") return false;
  const previousIndex = fromLocation.state?.__TSR_index;
  const nextIndex = toLocation.state?.__TSR_index;
  const backward = previousIndex !== undefined && nextIndex !== undefined
    ? nextIndex < previousIndex
    : toLocation.pathname.split("/").length < fromLocation.pathname.split("/").length;
  return [backward || (nextIndex !== previousIndex && toLocation.state?.__visionDirection === "back") ? "page-back" : "page-forward"];
}

export function isMotionReduced(): boolean {
  return document.documentElement.classList.contains("reduce-motion") || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}