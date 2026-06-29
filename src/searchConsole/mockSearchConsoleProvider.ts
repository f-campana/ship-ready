import {
  CONTRACT_NAMES,
  SearchConsoleStatusJsonContractSchema,
  type SearchConsoleStatusJsonContract,
} from "../types/contracts";
import { SearchConsoleStatusError } from "./searchConsoleErrors";
import {
  SEARCH_CONSOLE_MOCK_SCENARIOS,
  type SearchConsoleMockScenario,
  type SearchConsoleStatusProvider,
  type SearchConsoleStatusProviderInput,
} from "./searchConsoleTypes";

export const SEARCH_CONSOLE_MOCK_GENERATED_AT = "2026-06-29T12:00:00.000Z";

const MOCK_LIMITATIONS = [
  "Deterministic mock data only; no Google account, OAuth token, or live Search Console API was used.",
  "This read-only prototype does not create properties, verify ownership, submit sitemaps, request indexing, or change DNS.",
  "Search Console and sitemap evidence cannot guarantee crawling, indexing, ranking, or future Google behavior.",
] as const;

export const mockSearchConsoleProvider: SearchConsoleStatusProvider = {
  async getStatus(input) {
    const scenario = parseScenario(input.scenario ?? "not_configured");
    return SearchConsoleStatusJsonContractSchema.parse(buildScenario(scenario, input));
  },
};

function buildScenario(
  scenario: SearchConsoleMockScenario,
  input: SearchConsoleStatusProviderInput,
): SearchConsoleStatusJsonContract {
  const requested = new URL(input.url);
  const siteUrl = `${requested.origin}/`;
  const sitemapUrl = new URL("/sitemap.xml", requested.origin).toString();
  const base = {
    contract: CONTRACT_NAMES.searchConsoleStatus,
    generatedAt: SEARCH_CONSOLE_MOCK_GENERATED_AT,
    mode: "mock" as const,
    requestedUrl: input.url,
    authorization: { status: "authorized" as const },
    propertyMatch: {
      status: "matched" as const,
      strategy: "most_specific_accessible" as const,
      property: {
        siteUrl,
        type: "url_prefix" as const,
        permissionLevel: "siteFullUser" as const,
      },
    },
    sitemaps: {
      status: "available" as const,
      entries: [{
        path: sitemapUrl,
        lastSubmitted: "2026-06-27T08:00:00.000Z",
        lastDownloaded: "2026-06-28T09:30:00.000Z",
        isPending: false,
        isSitemapsIndex: false,
        type: "sitemap" as const,
        warnings: 0,
        errors: 0,
        contents: [{ type: "web" as const, submitted: 12 }],
      }],
    },
    inspection: inspectionNotRequested(),
    limitations: [...MOCK_LIMITATIONS],
    nextActions: [
      "Review this mock shape only; a separate pass must design live OAuth and token custody before Google access is possible.",
    ],
  };

  if (scenario === "not_configured") {
    return {
      ...base,
      authorization: { status: "not_configured" },
      propertyMatch: { status: "not_checked", strategy: "most_specific_accessible" },
      sitemaps: { status: "not_checked", entries: [] },
      inspection: inspectionUnavailable(input.inspect),
      nextActions: [
        "Use --mock <scenario> to inspect deterministic prototype states.",
        "Live Google OAuth and token custody are deferred to a separate reviewed pass.",
      ],
    };
  }

  if (scenario === "unauthorized") {
    return {
      ...base,
      authorization: { status: "authorization_required" },
      propertyMatch: { status: "not_checked", strategy: "most_specific_accessible" },
      sitemaps: { status: "not_checked", entries: [] },
      inspection: inspectionUnavailable(input.inspect),
      nextActions: [
        "Treat this as mock authorization state; ShipReady does not provide a live sign-in flow in Pass 9.",
      ],
    };
  }

  if (scenario === "property_not_found") {
    return {
      ...base,
      propertyMatch: { status: "not_accessible", strategy: "most_specific_accessible" },
      sitemaps: { status: "not_checked", entries: [] },
      inspection: inspectionUnavailable(input.inspect),
      nextActions: [
        "In a future live provider, confirm the authorized account and exact property scope without assuming that the property does not exist.",
      ],
    };
  }

  if (scenario === "ready_sitemap_warning") {
    return {
      ...base,
      sitemaps: {
        ...base.sitemaps,
        entries: [{ ...base.sitemaps.entries[0]!, warnings: 2 }],
      },
      inspection: input.inspect ? indexedInspection(input.url, sitemapUrl) : inspectionNotRequested(),
      nextActions: [
        "Review the mock sitemap warning count; it does not prove that listed URLs were or were not indexed.",
      ],
    };
  }

  if (scenario === "inspection_canonical_mismatch") {
    return {
      ...base,
      inspection: input.inspect
        ? {
            requested: true,
            status: "available",
            source: "google_index",
            result: {
              verdict: "PASS",
              coverageState: "Submitted and indexed",
              robotsTxtState: "ALLOWED",
              indexingState: "INDEXING_ALLOWED",
              lastCrawlTime: "2026-06-28T10:15:00.000Z",
              pageFetchState: "SUCCESSFUL",
              userCanonical: input.url,
              googleCanonical: new URL("/canonical/", requested.origin).toString(),
              crawledAs: "MOBILE",
              sitemaps: [sitemapUrl],
            },
          }
        : inspectionNotRequested(),
      nextActions: [
        "Compare the mock user-declared and Google-selected canonicals; this is indexed-version mock evidence, not a live-page test.",
      ],
    };
  }

  if (scenario === "inspection_not_indexed") {
    return {
      ...base,
      inspection: input.inspect
        ? {
            requested: true,
            status: "available",
            source: "google_index",
            result: {
              verdict: "FAIL",
              coverageState: "Crawled - currently not indexed",
              robotsTxtState: "ALLOWED",
              indexingState: "INDEXING_ALLOWED",
              lastCrawlTime: "2026-06-26T07:00:00.000Z",
              pageFetchState: "SUCCESSFUL",
              userCanonical: input.url,
              crawledAs: "MOBILE",
              sitemaps: [sitemapUrl],
            },
          }
        : inspectionNotRequested(),
      nextActions: [
        "Treat this only as the selected mock indexed-version state; no indexing request or remediation was performed.",
      ],
    };
  }

  return {
    ...base,
    inspection: input.inspect ? indexedInspection(input.url, sitemapUrl) : inspectionNotRequested(),
  };
}

function indexedInspection(requestedUrl: string, sitemapUrl: string) {
  return {
    requested: true,
    status: "available" as const,
    source: "google_index" as const,
    result: {
      verdict: "PASS" as const,
      coverageState: "Submitted and indexed",
      robotsTxtState: "ALLOWED" as const,
      indexingState: "INDEXING_ALLOWED" as const,
      lastCrawlTime: "2026-06-28T10:15:00.000Z",
      pageFetchState: "SUCCESSFUL" as const,
      userCanonical: requestedUrl,
      googleCanonical: requestedUrl,
      crawledAs: "MOBILE" as const,
      sitemaps: [sitemapUrl],
    },
  };
}

function inspectionNotRequested() {
  return {
    requested: false,
    status: "not_requested" as const,
    source: "google_index" as const,
  };
}

function inspectionUnavailable(inspect: boolean | undefined) {
  return inspect
    ? { requested: true, status: "not_checked" as const, source: "google_index" as const }
    : inspectionNotRequested();
}

function parseScenario(value: string): SearchConsoleMockScenario {
  if ((SEARCH_CONSOLE_MOCK_SCENARIOS as readonly string[]).includes(value)) {
    return value as SearchConsoleMockScenario;
  }
  throw new SearchConsoleStatusError(
    "invalid_mode",
    `Unsupported Search Console mock scenario: ${value}. Use one of: ${SEARCH_CONSOLE_MOCK_SCENARIOS.join(", ")}.`,
  );
}
