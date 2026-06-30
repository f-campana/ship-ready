import type { DnsStatusJsonContract } from "../types/contracts";

export const DNS_MOCK_SCENARIOS = [
  "ready",
  "apex-ok-www-missing",
  "www-cname-ok",
  "nxdomain",
  "nodata",
  "timeout",
  "cname-chain-issue",
  "caa-present",
  "txt-found",
  "txt-missing",
  "canonical-mismatch",
] as const;

export const EXPECTED_WWW_MODES = ["apex", "www", "either"] as const;

export type DnsMockScenario = (typeof DNS_MOCK_SCENARIOS)[number];
export type ExpectedWwwMode = (typeof EXPECTED_WWW_MODES)[number];

export type DnsStatusInput = {
  url: string;
  expectedCanonicalHost?: string;
  expectedWwwMode?: string;
  expectedSearchConsoleTxt?: string;
  checkHttp?: boolean;
  mock?: string;
  timeoutMs?: number;
  checkedAt?: string;
};

export type DnsStatus = DnsStatusJsonContract;

export type DnsCaaRecord = {
  flags?: number;
  tag?: string;
  value?: string;
};

export type DnsResolver = {
  resolveA(host: string): Promise<string[]>;
  resolveAAAA(host: string): Promise<string[]>;
  resolveCNAME(host: string): Promise<string[]>;
  resolveNS(host: string): Promise<string[]>;
  resolveTXT(host: string): Promise<string[][]>;
  resolveCAA(host: string): Promise<DnsCaaRecord[]>;
};
