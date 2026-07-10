import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");

describe("package metadata", () => {
  it("keeps package publishing explicitly disabled while preparing public metadata", async () => {
    const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
      name?: unknown;
      private?: unknown;
      bin?: Record<string, string>;
      scripts?: Record<string, string>;
      repository?: { type?: string; url?: string };
      bugs?: { url?: string };
      homepage?: string;
      engines?: Record<string, string>;
      license?: string;
      files?: string[];
    };

    expect(packageJson.name).toBe("@ship-ready/cli");
    expect(packageJson.private).toBe(true);
    expect(packageJson.bin).toEqual({ shipready: "./dist/index.js" });
    expect(packageJson.license).toBe("MIT");
    expect(packageJson.repository).toEqual({
      type: "git",
      url: "git+https://github.com/f-campana/ship-ready.git",
    });
    expect(packageJson.bugs?.url).toBe("https://github.com/f-campana/ship-ready/issues");
    expect(packageJson.homepage).toBe("https://github.com/f-campana/ship-ready#readme");
    expect(packageJson.engines?.node).toBe(">=20");
    expect(packageJson.scripts?.["package:smoke"]).toBe("node scripts/package-smoke.mjs");
    expect(packageJson.scripts?.["publish:preflight"]).toBe("node scripts/publish-preflight.mjs");
    expect(packageJson.scripts?.postinstall).toBeUndefined();
    expect(packageJson).not.toHaveProperty("main");
    expect(packageJson).not.toHaveProperty("exports");
  });
});
