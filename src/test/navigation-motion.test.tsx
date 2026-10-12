import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import { drawerProgress, settleDrawer, springStep, requestDrawer, requestSearch, setClickDirection, consumeClickDirection } from "@/lib/navigation-motion";
import { pageTransitionTypes } from "@/lib/app-motion";

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), canGoBack: vi.fn(() => true) }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { id: "test" } }) }));
vi.mock("@/lib/router-compat", () => ({ useLocation: () => ({ pathname: "/chat", searchStr: "" }), useNavigate: () => mocks.navigate }));
vi.mock("@tanstack/react-router", () => ({ useRouter: () => ({ history: { canGoBack: mocks.canGoBack } }) }));
vi.mock("@/components/app-drawer", () => ({ default: ({ onClose }: { onClose: () => void }) => <button onClick={onClose}>Close drawer</button> }));
import NavigationGestures from "@/components/navigation-gestures";

afterEach(() => { cleanup(); vi.clearAllMocks(); document.documentElement.classList.remove("reduce-motion"); });

describe("direction and spring rules", () => {
  it("tracks the finger across the full drawer width and clamps at both edges", () => {
    expect(drawerProgress(0, 180, 360)).toBe(0.5);
    expect(drawerProgress(1, -90, 360)).toBe(0.75);
    expect(drawerProgress(0, -90, 360)).toBe(0);
    expect(drawerProgress(1, 90, 360)).toBe(1);
  });
  it("settles with distance and momentum, including reverse flicks", () => {
    expect(settleDrawer(0.7, 0)).toBe(true);
    expect(settleDrawer(0.3, 0)).toBe(false);
    expect(settleDrawer(0.3, 2)).toBe(true);
    expect(settleDrawer(0.7, -2)).toBe(false);
  });
  it("converges without overflow and allows an interrupted close", () => {
    let state = { position: 0, velocity: 0 };
    for (let i = 0; i < 90; i++) state = springStep(state.position, state.velocity, 1, 1 / 60);
    expect(state.position).toBeCloseTo(1, 3);
    for (let i = 0; i < 90; i++) state = springStep(state.position, state.velocity, 0, 1 / 60);
    expect(state.position).toBeCloseTo(0, 3);
  });
  it("Library enters forward and its explicit back button reverses", () => {
    expect(pageTransitionTypes({ fromLocation: { pathname: "/drawer", state: { __TSR_index: 1 } }, toLocation: { pathname: "/library", state: { __TSR_index: 2 } }, pathChanged: true })).toEqual(["page-forward"]);
    expect(pageTransitionTypes({ fromLocation: { pathname: "/library", state: { __TSR_index: 2 } }, toLocation: { pathname: "/drawer", state: { __TSR_index: 3, __visionDirection: "back" } }, pathChanged: true })).toEqual(["page-back"]);
  });
  it("does not leak back intent to an unrelated later action", async () => {
    setClickDirection("back");
    expect(consumeClickDirection()).toBe("back");
    expect(consumeClickDirection()).toBeUndefined();
    setClickDirection("back");
    await Promise.resolve();
    expect(consumeClickDirection()).toBeUndefined();
  });
});

describe("persistent drawer", () => {
  it("opens and closes without navigation or removing the underlying composer", () => {
    document.documentElement.classList.add("reduce-motion");
    render(<><input aria-label="Composer" defaultValue="Keep my draft" /><NavigationGestures /></>);
    const composer = screen.getByRole("textbox");
    act(() => { expect(requestDrawer()).toBe(true); });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close drawer" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBe(composer);
    expect(composer).toHaveValue("Keep my draft");
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it("closes the overlay on back intent without triggering a second navigation", () => {
    document.documentElement.classList.add("reduce-motion");
    render(<NavigationGestures />);
    act(() => { requestDrawer(); });
    let accepted = true;
    act(() => { accepted = document.dispatchEvent(new CustomEvent("vision:open-drawer:back", { cancelable: true })); });
    expect(accepted).toBe(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it("morphs the open drawer into Search on a pull-down request", () => {
    document.documentElement.classList.add("reduce-motion");
    render(<NavigationGestures />);
    act(() => { requestDrawer(); });
    act(() => { expect(requestSearch()).toBe(true); });
    expect(screen.getByRole("searchbox", { name: "Search anything" })).toBeInTheDocument();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
import { gestureSurface, swipeAction } from "@/lib/navigation-motion";
import { shouldShowTutorial } from "@/lib/usage-guide";
import { pageTransitionTypes as types2 } from "@/lib/app-motion";
describe("gesture flow", () => {
  it("chat: right opens drawer, left opens projects", () => {
    expect(swipeAction(gestureSurface("/chat/abc"), 50)).toBe("drawer");
    expect(swipeAction(gestureSurface("/chat"), -50)).toBe("projects");
  });
  it("projects returns to chat only left-to-right", () => {
    expect(swipeAction(gestureSurface("/projects"), 50)).toBe("to-chat");
    expect(swipeAction(gestureSurface("/projects"), -50)).toBeNull();
  });
  it("drawer pages close right-to-left and never reopen by gesture", () => {
    for (const p of ["/library", "/integrations", "/settings"]) {
      expect(swipeAction(gestureSurface(p), -50)).toBe("to-drawer");
      expect(swipeAction(gestureSurface(p), 50)).toBeNull();
    }
    expect(swipeAction(gestureSurface("/settings/ai"), -50)).toBeNull();
  });
  it("drawer pages open from the left and close to the left", () => {
    expect(types2({ fromLocation: { pathname: "/chat", state: { __TSR_index: 1 } }, toLocation: { pathname: "/library", state: { __TSR_index: 2, __visionDirection: "left" } }, pathChanged: true })).toEqual(["page-from-left"]);
    expect(types2({ fromLocation: { pathname: "/library", state: { __TSR_index: 2, __visionDirection: "left" } }, toLocation: { pathname: "/chat", state: { __TSR_index: 1 } }, pathChanged: true })).toEqual(["page-to-left"]);
  });
  it("tutorial only for new, unseen accounts", () => {
    const now = Date.parse("2026-10-12T12:00:00Z");
    expect(shouldShowTutorial({ id: "u", created_at: "2026-10-12T11:00:00Z" }, false, now)).toBe(true);
    expect(shouldShowTutorial({ id: "u", created_at: "2026-10-12T11:00:00Z" }, true, now)).toBe(false);
    expect(shouldShowTutorial({ id: "u", created_at: "2026-10-01T11:00:00Z" }, false, now)).toBe(false);
  });
});
