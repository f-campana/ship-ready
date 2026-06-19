import type { AuditResult } from "../types/audit";
import { AuditResultSchema } from "../types/audit";

export function formatJsonReport(result: AuditResult): string {
  return `${JSON.stringify(AuditResultSchema.parse(result), null, 2)}\n`;
}

