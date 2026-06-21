import type { RepoInspectionResult } from "../types/repoInspection";
import { RepoInspectionResultSchema } from "../types/repoInspection";
import { CONTRACT_NAMES, RepoInspectionJsonContractSchema } from "../types/contracts";

export function formatRepoInspectionJsonReport(result: RepoInspectionResult): string {
  const contract = RepoInspectionJsonContractSchema.parse({
    contract: CONTRACT_NAMES.repoInspection,
    ...RepoInspectionResultSchema.parse(result),
  });
  return `${JSON.stringify(contract, null, 2)}\n`;
}
