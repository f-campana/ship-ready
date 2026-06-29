import type { CliErrorCode } from "../types/contracts";

export class SearchConsoleStatusError extends Error {
  constructor(
    readonly code: Extract<CliErrorCode, "invalid_mode" | "contract_error">,
    message: string,
  ) {
    super(message);
    this.name = "SearchConsoleStatusError";
  }
}
