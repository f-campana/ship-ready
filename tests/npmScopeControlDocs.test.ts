import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");

describe("npm scope control documentation", () => {
  it("records ownership evidence without claiming publication", async () => {
    const doc = await readFile(join(root, "docs", "NPM_SCOPE_CONTROL.md"), "utf8");
    expect(doc).toContain("`kobol909`");
    expect(doc).toContain("`@ship-ready/cli`");
    expect(doc).toContain("`@f-campana/shipready`");
    expect(doc).toContain("`private: true`");
    expect(doc).toContain("npm usage is not live");
    expect(doc).toContain("not a reservation");
  });
});
