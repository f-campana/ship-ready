import { UiReportSchema, type UiReport } from "../types/uiReport";

export function formatUiReportJsonReport(result: UiReport): string {
  return `${JSON.stringify(UiReportSchema.parse(result), null, 2)}\n`;
}
