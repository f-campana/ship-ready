import { WriteFixResultSchema, type WriteFixResult } from "../types/writeFix";

export function formatWriteFixJsonReport(result: WriteFixResult): string {
  return `${JSON.stringify(WriteFixResultSchema.parse(result), null, 2)}\n`;
}
