import type { AuditResult } from "../types/audit";
import { AuditResultSchema } from "../types/audit";
import { AuditJsonContractSchema, CONTRACT_NAMES } from "../types/contracts";

export function formatJsonReport(result: AuditResult): string {
  const contract = AuditJsonContractSchema.parse({
    contract: CONTRACT_NAMES.audit,
    ...AuditResultSchema.parse(result),
  });
  return `${JSON.stringify(contract, null, 2)}\n`;
}
