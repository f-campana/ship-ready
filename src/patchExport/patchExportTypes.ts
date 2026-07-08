import type { z } from "zod";
import type {
  PatchExportJsonContractSchema,
  PatchExportOutputKindSchema,
  PatchExportFormatSchema,
} from "../types/contracts";

export const PATCH_EXPORT_POLICY = "review_export_only" as const;

export type PatchExportFormat = z.infer<typeof PatchExportFormatSchema>;
export type PatchExportOutputKind = z.infer<typeof PatchExportOutputKindSchema>;
export type PatchExportResult = z.infer<typeof PatchExportJsonContractSchema>;

export type PatchExportOutputRequest = {
  kind: PatchExportOutputKind;
  path?: string;
  wroteArtifact: boolean;
  includeContent?: boolean;
};

export type PatchExportSkippedChange = {
  kind: "file_change" | "dry_run_action";
  path?: string;
  actionId?: string;
  title?: string;
  changeType?: "create" | "update";
  risk: "low" | "medium" | "high";
  reviewStatus?: "auto_candidate" | "review_required";
  requiresHumanReview?: boolean;
  included: false;
  reason: string;
  sourceActionIds: string[];
};

export type PatchExportExecution = {
  result: PatchExportResult;
  artifactContent: string;
};
