import { UiReportSchema, type UiReport } from "../types/uiReport";
import { CONTRACT_NAMES, UiReportJsonContractSchema } from "../types/contracts";

export function formatUiReportJsonReport(result: UiReport): string {
  const contract = UiReportJsonContractSchema.parse({
    contract: CONTRACT_NAMES.uiReport,
    ...UiReportSchema.parse(result),
  });
  return `${JSON.stringify(contract, null, 2)}\n`;
}
