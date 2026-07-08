import type { z } from "zod";
import type { GithubPrDraftJsonContractSchema } from "../types/contracts";

export const GITHUB_PR_DRAFT_POLICY = "review_handoff_only" as const;
export const DEFAULT_GITHUB_PR_BASE_BRANCH = "main" as const;
export const DEFAULT_GITHUB_PR_SUGGESTED_BRANCH = "shipready/launch-readiness" as const;

export type GithubPrDraftResult = z.infer<typeof GithubPrDraftJsonContractSchema>;

export type GithubPrDraftOutputRequest =
  | {
      kind: "file";
      path: string;
      wroteArtifact: true;
    }
  | {
      kind: "stdout" | "inline";
      wroteArtifact: false;
    };

export type GithubPrDraftExecution = {
  result: GithubPrDraftResult;
  artifactContent: string;
};
