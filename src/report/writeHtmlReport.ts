import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { UiReport } from "../types/uiReport";
import { formatHtmlReport } from "./formatHtmlReport";

export async function writeHtmlReport(report: UiReport, outputFile: string): Promise<string> {
  const outputPath = resolve(outputFile);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, formatHtmlReport(report), "utf8");
  return outputPath;
}
