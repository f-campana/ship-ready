import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { validateWriteCandidates } from "../fix/writeFix";
import type { DryRunFixResult } from "../types/dryRunFix";
import {
  CONTRACT_NAMES,
  type DryRunFixJsonContract,
} from "../types/contracts";
import { WRITE_POLICY_V1 } from "../types/writeFix";

export const PREVIEW_RECEIPT_KIND = "shipready.mcp.previewReceipt.v1" as const;
export const PREVIEW_RECEIPT_TTL_MS = 10 * 60 * 1000;

export const McpPreviewReceiptSchema = z.object({
  kind: z.literal(PREVIEW_RECEIPT_KIND),
  policy: z.literal(WRITE_POLICY_V1),
  url: z.string(),
  repoRealPath: z.string(),
  dryRunContract: z.literal(CONTRACT_NAMES.dryRunFix),
  eligiblePaths: z.array(z.string()).min(1),
  dryRunDigest: z.string(),
  eligibleDigest: z.string(),
  issuedAt: z.string(),
  expiresAt: z.string(),
  nonce: z.string(),
  signature: z.string(),
}).strict();

export type McpPreviewReceipt = z.infer<typeof McpPreviewReceiptSchema>;

export type PreviewReceiptValidation =
  | { ok: true; receipt: McpPreviewReceipt }
  | { ok: false; message: string };

export type PreviewReceiptManager = {
  issue: (input: {
    url: string;
    repoRealPath: string;
    dryRunContract: DryRunFixJsonContract;
    dryRunResult: DryRunFixResult;
  }) => McpPreviewReceipt | undefined;
  validate: (receipt: unknown, expected: {
    url: string;
    repoRealPath: string;
    dryRunContract: DryRunFixJsonContract;
    dryRunResult: DryRunFixResult;
  }) => PreviewReceiptValidation;
};

type ReceiptUnsignedPayload = Omit<McpPreviewReceipt, "signature">;

type CandidateProof = {
  path: string;
  changeType: "create";
  afterSha256: string;
  sourceActionIds: string[];
  risk: "low";
  requiresHumanReview: false;
  reviewStatus: "auto_candidate";
};

export function createPreviewReceiptManager(options: {
  ttlMs?: number;
  signingKey?: Buffer;
  now?: () => number;
} = {}): PreviewReceiptManager {
  const ttlMs = options.ttlMs ?? PREVIEW_RECEIPT_TTL_MS;
  const signingKey = options.signingKey ?? randomBytes(32);
  const now = options.now ?? (() => Date.now());

  return {
    issue(input) {
      const proof = eligibleCandidateProof(input.dryRunResult, input.repoRealPath);
      if (!proof) return undefined;

      const issuedAtMs = now();
      const unsigned: ReceiptUnsignedPayload = {
        kind: PREVIEW_RECEIPT_KIND,
        policy: WRITE_POLICY_V1,
        url: input.url,
        repoRealPath: input.repoRealPath,
        dryRunContract: CONTRACT_NAMES.dryRunFix,
        eligiblePaths: proof.eligiblePaths,
        dryRunDigest: dryRunDigest(input.dryRunContract),
        eligibleDigest: digestJson(proof.candidates),
        issuedAt: new Date(issuedAtMs).toISOString(),
        expiresAt: new Date(issuedAtMs + ttlMs).toISOString(),
        nonce: randomBytes(16).toString("hex"),
      };

      return {
        ...unsigned,
        signature: sign(unsigned, signingKey),
      };
    },

    validate(receiptInput, expected) {
      const parsed = McpPreviewReceiptSchema.safeParse(receiptInput);
      if (!parsed.success) {
        return { ok: false, message: "Preview receipt is missing or malformed." };
      }

      const receipt = parsed.data;
      const unsigned = withoutSignature(receipt);
      if (!safeEqualHex(receipt.signature, sign(unsigned, signingKey))) {
        return { ok: false, message: "Preview receipt signature is invalid." };
      }

      if (receipt.url !== expected.url || receipt.repoRealPath !== expected.repoRealPath) {
        return { ok: false, message: "Preview receipt does not match the current URL and repository." };
      }

      const expiresAt = Date.parse(receipt.expiresAt);
      const issuedAt = Date.parse(receipt.issuedAt);
      if (!Number.isFinite(expiresAt) || !Number.isFinite(issuedAt) || issuedAt > expiresAt) {
        return { ok: false, message: "Preview receipt timestamps are invalid." };
      }

      if (expiresAt <= now()) {
        return { ok: false, message: "Preview receipt has expired." };
      }

      const currentProof = eligibleCandidateProof(expected.dryRunResult, expected.repoRealPath);
      if (!currentProof) {
        return { ok: false, message: "No eligible safe crawl-file creations are available now." };
      }

      if (receipt.dryRunDigest !== dryRunDigest(expected.dryRunContract)) {
        return { ok: false, message: "Current dry-run preview no longer matches the receipt." };
      }

      if (receipt.eligibleDigest !== digestJson(currentProof.candidates)) {
        return { ok: false, message: "Current eligible crawl-file candidates no longer match the receipt." };
      }

      if (JSON.stringify(receipt.eligiblePaths) !== JSON.stringify(currentProof.eligiblePaths)) {
        return { ok: false, message: "Current eligible crawl-file paths no longer match the receipt." };
      }

      return { ok: true, receipt };
    },
  };
}

function eligibleCandidateProof(
  dryRunResult: DryRunFixResult,
  repoRealPath: string,
): { eligiblePaths: string[]; candidates: CandidateProof[] } | undefined {
  const validation = validateWriteCandidates(dryRunResult, repoRealPath);
  if (!validation.ok || validation.candidates.length === 0) return undefined;

  const changes = new Map(dryRunResult.fileChanges.map((change) => [change.path, change]));
  const candidates = validation.candidates.map((candidate) => {
    const change = changes.get(candidate.path);
    if (!change || change.changeType !== "create" || change.risk !== "low" ||
      change.requiresHumanReview || change.reviewStatus !== "auto_candidate") {
      return undefined;
    }

    return {
      path: candidate.path,
      changeType: "create" as const,
      afterSha256: sha256(change.after),
      sourceActionIds: [...change.sourceActionIds].sort(),
      risk: "low" as const,
      requiresHumanReview: false as const,
      reviewStatus: "auto_candidate" as const,
    };
  });

  if (candidates.some((candidate) => candidate === undefined)) return undefined;
  const sorted = (candidates as CandidateProof[]).sort((a, b) => a.path.localeCompare(b.path));
  return {
    eligiblePaths: sorted.map((candidate) => candidate.path),
    candidates: sorted,
  };
}

function dryRunDigest(contract: DryRunFixJsonContract): string {
  const { generatedAt: _generatedAt, ...stableContract } = contract;
  return digestJson(stableContract);
}

function digestJson(value: unknown): string {
  return sha256(stableStringify(value));
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entryValue]) => [key, sortJson(entryValue)]),
    );
  }
  return value;
}

function withoutSignature(receipt: McpPreviewReceipt): ReceiptUnsignedPayload {
  const { signature: _signature, ...unsigned } = receipt;
  return unsigned;
}

function sign(payload: ReceiptUnsignedPayload, signingKey: Buffer): string {
  return createHmac("sha256", signingKey).update(stableStringify(payload), "utf8").digest("hex");
}

function safeEqualHex(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) return false;
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
