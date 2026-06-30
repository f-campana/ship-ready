import type { CliErrorCode } from "../types/contracts";

export class DnsStatusError extends Error {
  constructor(
    readonly code: CliErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DnsStatusError";
  }
}
