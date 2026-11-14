/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { FallbackImage } from "./fallback-image";

afterEach(() => {
  cleanup();
});

describe("FallbackImage", () => {
  test("swaps a failed image for the fallback", () => {
    render(
      <FallbackImage
        src="/api/characters/ann/avatar"
        alt="Ann"
        fallback={<span>emblem</span>}
      />,
    );
    fireEvent.error(screen.getByAltText("Ann"));
    expect(screen.queryByAltText("Ann")).toBeNull();
    expect(screen.getByText("emblem")).toBeTruthy();
  });

  test("shows the fallback when there is no source", () => {
    render(<FallbackImage src={undefined} fallback={<span>emblem</span>} />);
    expect(screen.getByText("emblem")).toBeTruthy();
  });
});
