import type { FrameworkId, MetadataLocation } from "../types/repoInspection";
import {
  appRouterLayoutFiles,
  metadataExportFiles,
  nextHeadFiles,
  reactHelmetFiles,
  remixMetaExportFiles,
} from "./detectFramework";
import { hasDirectory, hasFile, type RepoSnapshot } from "./repoSnapshot";

export function findMetadataLocations(snapshot: RepoSnapshot, frameworkId: FrameworkId): MetadataLocation[] {
  const locations: MetadataLocation[] = [];
  const add = createLocationAdder(locations);

  if (frameworkId === "next_app_router") {
    const appDir = hasDirectory(snapshot, "src/app") ? "src/app" : "app";
    for (const path of appRouterLayoutFiles(snapshot)) {
      add(path, "file", true, "App Router layout can define shared metadata");
    }
    for (const path of metadataExportFiles(snapshot)) {
      add(path, "source_pattern", true, "Exports metadata or generateMetadata");
    }
    add(`${appDir}/**/page.tsx`, "pattern", false, "Route-level pages can define metadata");
    add(`${appDir}/**/layout.tsx`, "pattern", false, "Nested layouts can define section metadata");
    addKnownOrLikelyFile(snapshot, add, `${appDir}/sitemap.ts`, "App Router sitemap route");
    addKnownOrLikelyFile(snapshot, add, `${appDir}/robots.ts`, "App Router robots route");
    addKnownOrLikelyFile(snapshot, add, `${appDir}/opengraph-image.tsx`, "Open Graph image route");
    return locations;
  }

  if (frameworkId === "next_pages_router") {
    const pagesDir = hasDirectory(snapshot, "src/pages") ? "src/pages" : "pages";
    add(`${pagesDir}/**/*.{tsx,jsx,ts,js}`, "pattern", false, "Route files may define next/head metadata");
    for (const path of nextHeadFiles(snapshot)) {
      add(path, "source_pattern", true, "Imports next/head");
    }
    for (const path of [`${pagesDir}/_app.tsx`, `${pagesDir}/_app.jsx`, `${pagesDir}/_document.tsx`, `${pagesDir}/_document.jsx`]) {
      if (hasFile(snapshot, path)) {
        add(path, "file", true, "Shared Pages Router wrapper");
      }
    }
    addKnownOrLikelyFile(snapshot, add, "public/robots.txt", "Static robots file");
    addKnownOrLikelyFile(snapshot, add, "public/sitemap.xml", "Static sitemap file");
    return locations;
  }

  if (frameworkId === "vite_react") {
    addKnownOrLikelyFile(snapshot, add, "index.html", "Static fallback metadata for the SPA shell");
    for (const path of reactHelmetFiles(snapshot)) {
      add(path, "source_pattern", true, "Uses React Helmet metadata");
    }
    for (const path of ["src/App.tsx", "src/App.jsx", "src/main.tsx", "src/main.jsx"]) {
      if (hasFile(snapshot, path)) {
        add(path, "file", true, "App-level component or entry point");
      }
    }
    addKnownOrLikelyFile(snapshot, add, "public/robots.txt", "Static robots file");
    addKnownOrLikelyFile(snapshot, add, "public/sitemap.xml", "Static sitemap file");
    return locations;
  }

  if (frameworkId === "astro") {
    add("src/layouts/", "directory", hasDirectory(snapshot, "src/layouts"), "Astro layouts often centralize metadata");
    add("src/pages/", "directory", hasDirectory(snapshot, "src/pages"), "Astro pages can define page metadata");
    addKnownOrLikelyFile(snapshot, add, "public/robots.txt", "Static robots file");
    addKnownOrLikelyFile(snapshot, add, "public/sitemap.xml", "Static sitemap file");
    return locations;
  }

  if (frameworkId === "remix") {
    addKnownOrLikelyFile(snapshot, add, "app/root.tsx", "Remix root links and metadata");
    add("app/routes/", "directory", hasDirectory(snapshot, "app/routes"), "Route modules may export meta or links");
    for (const path of remixMetaExportFiles(snapshot)) {
      add(path, "source_pattern", true, "Exports meta or links");
    }
    addKnownOrLikelyFile(snapshot, add, "public/robots.txt", "Static robots file");
    addKnownOrLikelyFile(snapshot, add, "public/sitemap.xml", "Static sitemap file");
    return locations;
  }

  if (frameworkId === "static_html") {
    for (const path of snapshot.fileList.filter((file) => file.endsWith(".html")).slice(0, 20)) {
      add(path, "file", true, "Static HTML head can be edited directly");
    }
    addKnownOrLikelyFile(snapshot, add, "robots.txt", "Static robots file");
    addKnownOrLikelyFile(snapshot, add, "sitemap.xml", "Static sitemap file");
    return locations;
  }

  add("manual inspection required", "pattern", false, "No supported metadata convention detected");
  return locations;
}

type AddLocation = (
  path: string,
  kind: MetadataLocation["kind"],
  exists: boolean,
  reason: string,
) => void;

function createLocationAdder(locations: MetadataLocation[]): AddLocation {
  const seen = new Set<string>();
  return (path, kind, exists, reason) => {
    if (seen.has(path)) {
      return;
    }
    seen.add(path);
    locations.push({ path, kind, exists, reason });
  };
}

function addKnownOrLikelyFile(
  snapshot: RepoSnapshot,
  add: AddLocation,
  path: string,
  reason: string,
): void {
  add(path, "file", hasFile(snapshot, path), reason);
}
