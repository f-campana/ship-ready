import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");

describe("license and public package docs", () => {
  it("uses MIT while keeping publication blocked", async () => {
    const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
      private?: boolean;
      license?: string;
      files?: string[];
    };
    const license = await readFile(join(root, "LICENSE"), "utf8");

    expect(packageJson.private).toBe(true);
    expect(packageJson.license).toBe("MIT");
    expect(packageJson.files).toContain("LICENSE");
    expect(license).toContain("MIT License");
    expect(license).toContain("Copyright (c) 2026 Fabien Campana");
  });

  it("documents why MIT was selected and publication remains blocked", async () => {
    const decision = await readFile(join(root, "docs", "PACKAGE_PUBLISH_DECISION.md"), "utf8");
    const blockers = await readFile(join(root, "docs", "PACKAGE_PUBLISH_BLOCKERS.md"), "utf8");
    const readme = await readFile(join(root, "README.md"), "utf8");

    expect(decision).toContain("Decision: MIT.");
    expect(decision).toContain("No concrete patent-grant requirement");
    expect(blockers).toContain("MIT license selected");
    expect(blockers).toContain("Actual npm publish remains unauthorized");
    expect(readme).toContain("Issues are welcome");
    expect(readme).toContain("support is limited");
  });
});
