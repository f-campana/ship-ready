import {
  CliErrorContractSchema,
  CONTRACT_NAMES,
  type CliErrorCode,
} from "../types/contracts";
import type { WriteFixResult } from "../types/writeFix";
import { toWriteFixJsonContract } from "./formatWriteFixJsonReport";

export type FormatCliErrorJsonInput = {
  code: CliErrorCode;
  message: string;
  result?: WriteFixResult;
};

export function formatCliErrorJson(input: FormatCliErrorJsonInput): string {
  const error = CliErrorContractSchema.parse({
    contract: CONTRACT_NAMES.error,
    ok: false,
    code: input.code,
    message: input.message,
    // Compatibility alias retained for existing JSON consumers.
    error: input.message,
    result: input.result ? toWriteFixJsonContract(input.result) : undefined,
  });

  return `${JSON.stringify(error, null, 2)}\n`;
}
