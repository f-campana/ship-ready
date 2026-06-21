import { DryRunFixResultSchema, type DryRunFixResult } from "../types/dryRunFix";
import { CONTRACT_NAMES, DryRunFixJsonContractSchema } from "../types/contracts";

export function formatDryRunFixJsonReport(result: DryRunFixResult): string {
  const contract = DryRunFixJsonContractSchema.parse({
    contract: CONTRACT_NAMES.dryRunFix,
    ...DryRunFixResultSchema.parse(result),
  });
  return `${JSON.stringify(contract, null, 2)}\n`;
}
