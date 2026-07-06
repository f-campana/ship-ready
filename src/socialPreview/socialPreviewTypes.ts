import type { CliErrorCode, SocialPreviewJsonContract } from "../types/contracts";

export const SOCIAL_PREVIEW_SOURCE_MODES = ["raw", "rendered", "both"] as const;

export const SOCIAL_PREVIEW_MOCK_SCENARIOS = [
  "complete",
  "missing-image",
  "rendered-only-metadata",
  "twitter-fallback",
  "missing-description",
  "missing-og-url",
  "raw-rendered-different",
  "image-unreachable",
  "minimal-title-only",
] as const;

export type SocialPreviewSourceMode = (typeof SOCIAL_PREVIEW_SOURCE_MODES)[number];
export type SocialPreviewMockScenario = (typeof SOCIAL_PREVIEW_MOCK_SCENARIOS)[number];
export type SocialPreviewResult = SocialPreviewJsonContract;

export type SocialPreviewInput = {
  url: string;
  source?: string;
  checkAssets?: boolean;
  mock?: string;
  timeoutMs?: number;
  userAgent?: string;
};

export class SocialPreviewError extends Error {
  constructor(
    readonly code: CliErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SocialPreviewError";
  }
}
