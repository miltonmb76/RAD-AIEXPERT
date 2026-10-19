import { describe, expect, it } from "vitest";
import { isDynamicImportFetchError } from "./lazyRetry";

describe("lazyRetry", () => {
  it("detects stale Vite chunk fetch errors", () => {
    expect(
      isDynamicImportFetchError(
        new Error(
          "Failed to fetch dynamically imported module: https://example.com/assets/Breast3DModule-i3VSkbbp.js"
        )
      )
    ).toBe(true);
    expect(
      isDynamicImportFetchError(new Error("Importing a module script failed."))
    ).toBe(true);
    expect(isDynamicImportFetchError(new Error("TypeError: x is not a function"))).toBe(
      false
    );
  });
});
