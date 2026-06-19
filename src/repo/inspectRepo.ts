import type { FrameworkId, SupportedFix } from "../types/repoInspection";
import { RepoInspectionResultSchema, type RepoInspectionResult } from "../types/repoInspection";
import { collectImportantFiles } from "./collectImportantFiles";
import { detectFramework } from "./detectFramework";
import { detectPackageManager } from "./detectPackageManager";
import { findMetadataLocations } from "./findMetadataLocations";
import { findRouteCandidates } from "./findRouteCandidates";
import { createRepoSnapshot } from "./repoSnapshot";

export type InspectRepoOptions = {
  cwd?: string;
  maxDepth?: number;
  maxFiles?: number;
};

export function inspectRepo(path: string, options: InspectRepoOptions = {}): RepoInspectionResult {
  const snapshot = createRepoSnapshot(path, options);
  const packageManager = detectPackageManager(snapshot);
  const frameworkDetection = detectFramework(snapshot);
  const frameworkId = frameworkDetection.framework.id;
  const importantFiles = collectImportantFiles(snapshot, frameworkId);
  const routes = findRouteCandidates(snapshot, frameworkId);
  const metadataLocations = findMetadataLocations(snapshot, frameworkId);
  const warnings = buildWarnings({
    snapshotWarnings: snapshot.warnings,
    detectionWarnings: frameworkDetection.warnings,
    frameworkId,
    packageManager: packageManager.packageManager,
    hasPackageJson: Boolean(snapshot.packageJson),
    routeCount: routes.length,
  });

  return RepoInspectionResultSchema.parse({
    path: snapshot.displayPath,
    inspectedAt: new Date().toISOString(),
    packageManager: packageManager.packageManager,
    framework: frameworkDetection.framework,
    importantFiles,
    routes,
    metadataLocations,
    supportedFixes: supportedFixesForFramework(frameworkId),
    limitations: limitationsForFramework(frameworkId),
    warnings,
  });
}

function buildWarnings(input: {
  snapshotWarnings: string[];
  detectionWarnings: string[];
  frameworkId: FrameworkId;
  packageManager: string;
  hasPackageJson: boolean;
  routeCount: number;
}): string[] {
  const warnings = [...input.snapshotWarnings, ...input.detectionWarnings];

  if (input.frameworkId === "unknown") {
    warnings.push("Unsupported or unknown project type. Future automated fixes should not run without manual inspection.");
  }

  if (input.packageManager === "unknown" && input.hasPackageJson) {
    warnings.push("Package manager could not be inferred from a lockfile or packageManager field.");
  }

  if (input.routeCount === 0) {
    warnings.push("No likely route or page files were found within the scan limits.");
  }

  return Array.from(new Set(warnings));
}

function supportedFixesForFramework(frameworkId: FrameworkId): SupportedFix[] {
  if (frameworkId === "next_app_router") {
    return [
      fix("next_app.metadata_export", "Add/update static metadata export", "Add or update App Router metadata exports where simple and local.", "review_required"),
      fix("next_app.route_metadata", "Add route-level metadata", "Add metadata to route page or layout files.", "review_required"),
      fix("next_app.generate_metadata", "Add/update generateMetadata", "Plan generateMetadata changes when route metadata is dynamic.", "review_required"),
      fix("next_app.json_ld", "Add JSON-LD component", "Add conservative structured data in a layout or page.", "review_required"),
      fix("next_app.robots", "Add robots.ts", "Add an App Router robots route.", "review_required"),
      fix("next_app.sitemap", "Add sitemap.ts", "Add an App Router sitemap route.", "review_required"),
      fix("next_app.og_image", "Add Open Graph image route", "Add an opengraph-image route where appropriate.", "review_required"),
    ];
  }

  if (frameworkId === "next_pages_router") {
    return [
      fix("next_pages.next_head", "Add/update next/head", "Add or update route-level head metadata.", "review_required"),
      fix("next_pages.route_metadata", "Add route-level metadata", "Plan metadata changes in Pages Router route files.", "review_required"),
      fix("next_pages.json_ld", "Add JSON-LD script tags", "Add conservative JSON-LD script tags where safe.", "review_required"),
      fix("next_pages.robots_txt", "Add static robots.txt", "Add public/robots.txt.", "review_required"),
      fix("next_pages.sitemap_xml", "Add static sitemap.xml", "Add public/sitemap.xml.", "review_required"),
    ];
  }

  if (frameworkId === "vite_react") {
    return [
      fix("vite.index_html_metadata", "Update static index.html metadata", "Improve fallback metadata in index.html.", "review_required"),
      fix("vite.robots_txt", "Add static robots.txt", "Add public/robots.txt.", "review_required"),
      fix("vite.sitemap_xml", "Add static sitemap.xml", "Add public/sitemap.xml.", "review_required"),
      fix("vite.json_ld_fallback", "Add JSON-LD fallback", "Add static JSON-LD where it accurately describes the app shell.", "review_required"),
      fix("vite.helmet_future", "Recommend React Helmet integration", "Plan a route-aware metadata strategy when client-side routes need distinct metadata.", "review_required"),
    ];
  }

  if (frameworkId === "astro") {
    return [
      fix("astro.layout_metadata", "Update layout-level metadata", "Update shared metadata in Astro layouts.", "review_required"),
      fix("astro.page_metadata", "Update page-level metadata", "Update metadata in Astro page files.", "review_required"),
      fix("astro.json_ld", "Add JSON-LD", "Add conservative structured data to pages or layouts.", "review_required"),
      fix("astro.sitemap", "Add sitemap integration or static sitemap", "Add Astro sitemap support or a static sitemap.", "review_required"),
    ];
  }

  if (frameworkId === "remix") {
    return [
      fix("remix.meta_exports", "Update route meta exports", "Update route-level meta exports.", "review_required"),
      fix("remix.root_links", "Update root links/meta behavior", "Plan changes to root links and document metadata.", "review_required"),
      fix("remix.robots_sitemap", "Add static robots/sitemap", "Add public crawlability assets where safe.", "review_required"),
    ];
  }

  if (frameworkId === "static_html") {
    return [
      fix("static.head_metadata", "Update HTML head metadata", "Update title, description, canonical, and social tags directly in HTML.", "review_required"),
      fix("static.json_ld", "Add JSON-LD", "Add conservative JSON-LD to static HTML.", "review_required"),
      fix("static.robots_sitemap", "Add robots/sitemap", "Add static robots.txt and sitemap.xml.", "review_required"),
    ];
  }

  return [
    fix("unsupported.none", "None yet", "No automated fix type is supported until the project is manually classified.", "unsupported"),
  ];
}

function limitationsForFramework(frameworkId: FrameworkId): string[] {
  const generic = [
    "File writing is disabled; use `shipready fix --dry-run` for supported patch previews.",
    "This command is read-only and does not modify repository files.",
  ];

  if (frameworkId === "next_app_router") {
    return [
      ...generic,
      "Dynamic route metadata may require human review.",
      "Existing complex metadata logic should not be overwritten blindly.",
    ];
  }

  if (frameworkId === "next_pages_router") {
    return [
      ...generic,
      "Metadata may be spread across shared layout components.",
      "Future fixes should avoid duplicating existing next/head tags.",
    ];
  }

  if (frameworkId === "vite_react") {
    return [
      ...generic,
      "Route-specific metadata in a Vite SPA may only appear after JavaScript rendering.",
      "Future fixes may need to recommend prerendering or SSG instead of relying on JS-injected metadata for crawler visibility.",
    ];
  }

  if (frameworkId === "astro") {
    return [
      ...generic,
      "Project-specific layout conventions may vary.",
    ];
  }

  if (frameworkId === "remix") {
    return [
      ...generic,
      "Route metadata can be function-based and data-dependent.",
      "Future fixes should avoid rewriting custom meta logic blindly.",
    ];
  }

  if (frameworkId === "static_html") {
    return [
      ...generic,
      "There are no framework conventions; file layout may be arbitrary.",
    ];
  }

  return [
    ...generic,
    "Unsupported project type.",
    "Manual inspection is recommended before planning automated fixes.",
  ];
}

function fix(
  id: string,
  title: string,
  description: string,
  safety: SupportedFix["safety"],
): SupportedFix {
  return { id, title, description, safety };
}
