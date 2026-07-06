import type { CliErrorCode, GeneratedSiteSmellsJsonContract } from "../types/contracts";

export const GENERATED_SITE_SMELL_MOCK_SCENARIOS = [
  "clean",
  "vite-client-only-metadata",
  "placeholder-content",
  "missing-social-assets",
  "hardcoded-localhost",
  "unsupported-framework",
  "repo-plus-url-rendered-only",
  "multiple-smells",
] as const;

export const GENERATED_SITE_SMELL_CATEGORIES = [
  "metadata",
  "crawlability",
  "preview",
  "routing",
  "assets",
  "content_placeholders",
  "configuration",
  "framework",
  "generated_boilerplate",
  "unknown",
] as const;

export const GENERATED_SITE_SMELL_SEVERITIES = ["high", "medium", "low", "info"] as const;
export const GENERATED_SITE_SMELL_CONFIDENCES = ["high", "medium", "low"] as const;
export const GENERATED_SITE_SMELL_STATUSES = ["needs_attention", "manual_review", "info"] as const;

export const DEFAULT_GENERATED_SITE_SMELL_LIMITS = {
  maxFiles: 250,
  maxBytes: 512 * 1024,
  maxFileBytes: 48 * 1024,
  maxFindings: 40,
  maxEvidencePerFinding: 5,
  maxValuePreviewLength: 120,
} as const;

export type GeneratedSiteSmellMockScenario = (typeof GENERATED_SITE_SMELL_MOCK_SCENARIOS)[number];
export type GeneratedSiteSmellsResult = GeneratedSiteSmellsJsonContract;

export type GeneratedSiteSmellsInput = {
  repoPath: string;
  url?: string;
  mock?: string;
  maxFiles?: number;
  maxBytes?: number;
  timeoutMs?: number;
  render?: boolean;
  userAgent?: string;
  checkedAt?: string;
  cwd?: string;
};

export class GeneratedSiteSmellsError extends Error {
  constructor(
    readonly code: CliErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GeneratedSiteSmellsError";
  }
}
