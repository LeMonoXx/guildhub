/** @vitest-environment jsdom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { NebulaFog } from "./nebula-fog";

afterEach(() => {
  cleanup();
});

describe("NebulaFog", () => {
  test("renders a decorative canvas hidden from assistive technology", () => {
    const { container } = render(<NebulaFog />);
    const canvas = container.querySelector("canvas.nebula-fog");
    expect(canvas).not.toBeNull();
    expect(canvas?.getAttribute("aria-hidden")).toBe("true");
  });

  test("leaves the page usable when WebGL is unavailable", () => {
    expect(typeof globalThis.WebGLRenderingContext).toBe("undefined");
    expect(() => render(<NebulaFog />)).not.toThrow();
  });
});
