import { FixPlanResultSchema, type FixPlanResult } from "../types/fixPlan";
import { CONTRACT_NAMES, FixPlanJsonContractSchema } from "../types/contracts";

export function formatFixPlanJsonReport(result: FixPlanResult): string {
  const contract = FixPlanJsonContractSchema.parse({
    contract: CONTRACT_NAMES.fixPlan,
    ...FixPlanResultSchema.parse(result),
  });
  return `${JSON.stringify(contract, null, 2)}\n`;
}
