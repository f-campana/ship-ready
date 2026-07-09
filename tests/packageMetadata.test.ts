import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");

describe("package metadata", () => {
  it("keeps package publishing explicitly disabled while preparing packability", async () => {
    const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
      private?: unknown;
      scripts?: Record<string, string>;
      repository?: { type?: string; url?: string };
      engines?: Record<string, string>;
      license?: string;
      files?: string[];
    };

    expect(packageJson.private).toBe(true);
    expect(packageJson.license).toBe("UNLICENSED");
    expect(packageJson.repository).toEqual({
      type: "git",
      url: "git+https://github.com/f-campana/ship-ready.git",
    });
    expect(packageJson.engines?.node).toBe(">=20");
    expect(packageJson.scripts?.postinstall).toBeUndefined();
  });
});
