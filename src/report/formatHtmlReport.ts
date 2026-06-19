import type { UiReport } from "../types/uiReport";
import { renderHtmlReport } from "./renderHtmlReport";

export function formatHtmlReport(report: UiReport): string {
  return renderHtmlReport(report);
}
