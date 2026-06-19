import { DryRunFixResultSchema, type DryRunFixResult } from "../types/dryRunFix";

export function formatDryRunFixJsonReport(result: DryRunFixResult): string {
  return `${JSON.stringify(DryRunFixResultSchema.parse(result), null, 2)}\n`;
}
