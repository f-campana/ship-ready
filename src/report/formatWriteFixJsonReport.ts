import { WriteFixResultSchema, type WriteFixResult } from "../types/writeFix";
import {
  CONTRACT_NAMES,
  WriteFixJsonContractSchema,
  type WriteFixJsonContract,
} from "../types/contracts";

export function toWriteFixJsonContract(result: WriteFixResult): WriteFixJsonContract {
  return WriteFixJsonContractSchema.parse({
    contract: CONTRACT_NAMES.writeFix,
    ...WriteFixResultSchema.parse(result),
  });
}

export function formatWriteFixJsonReport(result: WriteFixResult): string {
  return `${JSON.stringify(toWriteFixJsonContract(result), null, 2)}\n`;
}
