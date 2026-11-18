/** @vitest-environment jsdom */
import { cleanup, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useDragScroll } from "./drag-scroll";

afterEach(cleanup);

function Panel({ onClick }: { readonly onClick: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDragScroll(ref);
  return (
    <div ref={ref} data-testid="panel">
      <button type="button" onClick={onClick}>
        mark
      </button>
    </div>
  );
}

const pointer = (type: string, clientX: number) =>
  Object.assign(new MouseEvent(type, { clientX, button: 0, bubbles: true }), {
    pointerType: "mouse",
    pointerId: 1,
  });

function setup() {
  const onClick = vi.fn();
  const view = render(<Panel onClick={onClick} />);
  const panel = view.getByTestId("panel");
  panel.setPointerCapture = () => undefined;
  panel.scrollLeft = 100;
  return { onClick, panel, button: view.getByRole("button") };
}

describe("useDragScroll", () => {
  test("pans by the distance dragged and swallows the click that ends it", () => {
    const { onClick, panel, button } = setup();
    button.dispatchEvent(pointer("pointerdown", 200));
    button.dispatchEvent(pointer("pointermove", 170));
    expect(panel.scrollLeft).toBe(130);
    expect(panel.dataset.dragging).toBe("true");
    button.dispatchEvent(pointer("pointerup", 170));
    button.click();
    expect(onClick).not.toHaveBeenCalled();
    expect(panel.dataset.dragging).toBeUndefined();
  });

  test("keeps a short press a click", () => {
    const { onClick, button } = setup();
    button.dispatchEvent(pointer("pointerdown", 200));
    button.dispatchEvent(pointer("pointermove", 197));
    button.dispatchEvent(pointer("pointerup", 197));
    button.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  test("lets a later click through when a drag ended without one", async () => {
    const { onClick, button } = setup();
    button.dispatchEvent(pointer("pointerdown", 200));
    button.dispatchEvent(pointer("pointermove", 150));
    button.dispatchEvent(pointer("pointercancel", 150));
    await new Promise((resolve) => setTimeout(resolve));
    button.click();
    expect(onClick).toHaveBeenCalledOnce();
  });
});
