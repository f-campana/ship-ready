import type { FrameworkId, ImportantFile } from "../types/repoInspection";
import {
  appRouterLayoutFiles,
  appRouterPageFiles,
  astroPageFiles,
  pagesRouterRouteFiles,
  remixRouteFiles,
} from "./detectFramework";
import { hasDirectory, hasFile, type RepoSnapshot } from "./repoSnapshot";

export function collectImportantFiles(snapshot: RepoSnapshot, frameworkId: FrameworkId): ImportantFile[] {
  const files: ImportantFile[] = [];
  const add = createImportantFileAdder(files);

  if (hasFile(snapshot, "package.json")) {
    add("package.json", "package_file", "Project package manifest");
  }

  for (const lockfile of ["pnpm-lock.yaml", "package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "bun.lock", "bun.lockb"]) {
    if (hasFile(snapshot, lockfile)) {
      add(lockfile, "lockfile", "Package manager lockfile");
    }
  }

  for (const config of [
    "next.config.js",
    "next.config.mjs",
    "next.config.ts",
    "vite.config.ts",
    "vite.config.js",
    "vite.config.mts",
    "vite.config.mjs",
    "astro.config.js",
    "astro.config.mjs",
    "astro.config.ts",
    "remix.config.js",
    "remix.config.mjs",
    "tsconfig.json",
  ]) {
    if (hasFile(snapshot, config)) {
      add(config, "config_file", "Framework or TypeScript config");
    }
  }

  for (const directory of ["app", "src/app", "pages", "src/pages", "src", "public", "app/routes", "src/layouts"]) {
    if (hasDirectory(snapshot, directory)) {
      add(`${directory}/`, "directory", "Important project directory");
    }
  }

  if (frameworkId === "next_app_router") {
    for (const path of [...appRouterLayoutFiles(snapshot), ...appRouterPageFiles(snapshot)].slice(0, 12)) {
      add(path, path.includes("layout.") ? "metadata_file" : "route_file", "Next.js App Router file");
    }
    for (const path of ["app/robots.ts", "src/app/robots.ts", "app/sitemap.ts", "src/app/sitemap.ts", "app/opengraph-image.tsx", "src/app/opengraph-image.tsx"]) {
      if (hasFile(snapshot, path)) {
        add(path, "metadata_file", "App Router metadata or asset route");
      }
    }
  } else if (frameworkId === "next_pages_router") {
    for (const path of pagesRouterRouteFiles(snapshot).slice(0, 12)) {
      add(path, "route_file", "Next.js Pages Router file");
    }
    for (const path of ["pages/_app.tsx", "pages/_document.tsx", "src/pages/_app.tsx", "src/pages/_document.tsx"]) {
      if (hasFile(snapshot, path)) {
        add(path, "source_file", "Shared Pages Router wrapper");
      }
    }
  } else if (frameworkId === "vite_react") {
    for (const path of ["index.html", "src/main.tsx", "src/main.jsx", "src/App.tsx", "src/App.jsx"]) {
      if (hasFile(snapshot, path)) {
        add(path, path === "index.html" ? "metadata_file" : "source_file", "Vite React entry file");
      }
    }
  } else if (frameworkId === "astro") {
    for (const path of astroPageFiles(snapshot).slice(0, 12)) {
      add(path, "route_file", "Astro page file");
    }
  } else if (frameworkId === "remix") {
    for (const path of ["app/root.tsx", "app/root.jsx", "app/root.ts", "app/root.js"]) {
      if (hasFile(snapshot, path)) {
        add(path, "metadata_file", "Remix root module");
      }
    }
    for (const path of remixRouteFiles(snapshot).slice(0, 12)) {
      add(path, "route_file", "Remix route module");
    }
  } else if (frameworkId === "static_html") {
    for (const path of snapshot.fileList.filter((file) => file.endsWith(".html")).slice(0, 12)) {
      add(path, "metadata_file", "Static HTML page");
    }
  }

  for (const path of ["public/robots.txt", "public/sitemap.xml", "robots.txt", "sitemap.xml"]) {
    if (hasFile(snapshot, path)) {
      add(path, "public_asset", "Crawlability asset");
    }
  }

  return files;
}

function createImportantFileAdder(files: ImportantFile[]): (path: string, kind: ImportantFile["kind"], reason: string) => void {
  const seen = new Set<string>();
  return (path, kind, reason) => {
    if (seen.has(path)) {
      return;
    }
    seen.add(path);
    files.push({ path, kind, reason });
  };
}
