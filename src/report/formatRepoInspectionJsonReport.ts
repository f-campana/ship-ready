import type { RepoInspectionResult } from "../types/repoInspection";
import { RepoInspectionResultSchema } from "../types/repoInspection";

export function formatRepoInspectionJsonReport(result: RepoInspectionResult): string {
  return `${JSON.stringify(RepoInspectionResultSchema.parse(result), null, 2)}\n`;
}
