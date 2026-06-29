import type { SearchConsoleStatusJsonContract } from "../types/contracts";

export const SEARCH_CONSOLE_MOCK_SCENARIOS = [
  "not_configured",
  "unauthorized",
  "property_not_found",
  "ready_sitemap_ok",
  "ready_sitemap_warning",
  "inspection_canonical_mismatch",
  "inspection_not_indexed",
] as const;

export type SearchConsoleMockScenario = (typeof SEARCH_CONSOLE_MOCK_SCENARIOS)[number];

export type SearchConsoleStatusProviderInput = {
  url: string;
  inspect?: boolean;
  scenario?: string;
};

export type SearchConsoleStatusProvider = {
  getStatus(input: SearchConsoleStatusProviderInput): Promise<SearchConsoleStatusJsonContract>;
};
