import type { FrameworkId, RouteCandidate } from "../types/repoInspection";
import {
  appRouterPageFiles,
  astroPageFiles,
  htmlPageFiles,
  pagesRouterRouteFiles,
  remixRouteFiles,
} from "./detectFramework";
import { hasFile, type RepoSnapshot } from "./repoSnapshot";

export function findRouteCandidates(snapshot: RepoSnapshot, frameworkId: FrameworkId): RouteCandidate[] {
  if (frameworkId === "next_app_router") {
    return appRouterPageFiles(snapshot).map((path) => ({
      path,
      route: routeFromAppRouterPage(path),
      kind: "page",
      confidence: "high",
      reason: "App Router page file",
    }));
  }

  if (frameworkId === "next_pages_router") {
    return pagesRouterRouteFiles(snapshot).map((path) => ({
      path,
      route: routeFromPagesRouterFile(path),
      kind: "page",
      confidence: "high",
      reason: "Pages Router route file",
    }));
  }

  if (frameworkId === "vite_react") {
    const routes: RouteCandidate[] = [];
    for (const path of ["src/main.tsx", "src/main.jsx", "src/App.tsx", "src/App.jsx"]) {
      if (hasFile(snapshot, path)) {
        routes.push({
          path,
          kind: "app_entry",
          confidence: "low",
          reason: "SPA entry or root component; route-to-URL mapping requires source review",
        });
      }
    }
    return routes;
  }

  if (frameworkId === "astro") {
    return astroPageFiles(snapshot).map((path) => ({
      path,
      route: routeFromAstroPage(path),
      kind: "page",
      confidence: "high",
      reason: "Astro page file",
    }));
  }

  if (frameworkId === "remix") {
    return remixRouteFiles(snapshot).map((path) => ({
      path,
      route: routeFromRemixRoute(path),
      kind: "route_module",
      confidence: "medium",
      reason: "Remix route module; route conventions may need human review",
    }));
  }

  if (frameworkId === "static_html") {
    return htmlPageFiles(snapshot).map((path) => ({
      path,
      route: routeFromHtmlPage(path),
      kind: "html_page",
      confidence: "high",
      reason: "Static HTML file",
    }));
  }

  return [];
}

function routeFromAppRouterPage(path: string): string {
  const withoutPrefix = path.replace(/^(src\/)?app\//, "").replace(/\/?page\.(tsx|jsx|ts|js)$/, "");
  return routeFromSegments(withoutPrefix.split("/"));
}

function routeFromPagesRouterFile(path: string): string {
  const withoutPrefix = path.replace(/^(src\/)?pages\//, "").replace(/\.(tsx|jsx|ts|js)$/, "");
  return routeFromSegments(withoutPrefix.split("/"));
}

function routeFromAstroPage(path: string): string {
  const withoutPrefix = path.replace(/^src\/pages\//, "").replace(/\.(astro|md|mdx|tsx|jsx|ts|js)$/, "");
  return routeFromSegments(withoutPrefix.split("/"));
}

function routeFromRemixRoute(path: string): string {
  const withoutPrefix = path.replace(/^app\/routes\//, "").replace(/\.(tsx|jsx|ts|js)$/, "");
  if (withoutPrefix === "_index") {
    return "/";
  }

  return routeFromSegments(withoutPrefix.replace(/\./g, "/").split("/"));
}

function routeFromHtmlPage(path: string): string {
  const withoutExtension = path.replace(/\.html$/, "");
  return routeFromSegments(withoutExtension.split("/"));
}

function routeFromSegments(inputSegments: string[]): string {
  const segments = inputSegments
    .filter(Boolean)
    .filter((segment) => segment !== "index")
    .filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")))
    .filter((segment) => !segment.startsWith("@"));

  return segments.length > 0 ? `/${segments.join("/")}` : "/";
}
