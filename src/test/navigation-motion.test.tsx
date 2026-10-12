import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import { drawerProgress, settleDrawer, springStep, requestDrawer, setClickDirection, consumeClickDirection } from "@/lib/navigation-motion";
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
});