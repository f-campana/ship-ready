import { FixPlanResultSchema, type FixPlanResult } from "../types/fixPlan";

export function formatFixPlanJsonReport(result: FixPlanResult): string {
  return `${JSON.stringify(FixPlanResultSchema.parse(result), null, 2)}\n`;
}
