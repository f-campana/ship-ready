import { readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { ZodType } from "zod";
import {
  AuditJsonContractSchema,
  CliErrorContractSchema,
  CrawlJsonContractSchema,
  DnsStatusJsonContractSchema,
  DryRunFixJsonContractSchema,
  FixPlanJsonContractSchema,
  GeneratedSiteSmellsJsonContractSchema,
  GithubPrDraftJsonContractSchema,
  PatchExportJsonContractSchema,
  RepoInspectionJsonContractSchema,
  SearchConsoleStatusJsonContractSchema,
  UiReportJsonContractSchema,
  WriteFixJsonContractSchema,
  StatusJsonContractSchema,
  DoctorJsonContractSchema,
  RecheckJsonContractSchema,
  SocialPreviewJsonContractSchema,
} from "../types/contracts";
import { ShipReadyMcpError } from "./errors";

const MAX_CANONICAL_READ_BYTES = 1024 * 1024;

export const FIXTURE_NAMES = [
  "audit.clean.json",
  "audit.needs-work.json",
  "crawl.clean-small-site.json",
  "crawl.missing-descriptions.json",
  "crawl.canonical-inconsistent.json",
  "crawl.social-images-missing.json",
  "crawl.start-unreachable.json",
  "crawl.limit-reached.json",
  "crawl.mixed-readiness.json",
  "error.invalid-url.json",
  "fix-dry-run.review-required.json",
  "fix-dry-run.safe-apply.json",
  "fix-dry-run.skipped.json",
  "fix-write.blocked.json",
  "fix-write.safe-create.json",
  "fix-write.skipped.json",
  "inspect-repo.next-app.json",
  "inspect-repo.vite.json",
  "plan-fixes.review-required.json",
  "plan-fixes.safe-apply.json",
  "search-console.not-configured.json",
  "search-console.unauthorized.json",
  "search-console.property-not-found.json",
  "search-console.ready-sitemap-ok.json",
  "search-console.ready-sitemap-warning.json",
  "search-console.inspection-canonical-mismatch.json",
  "search-console.inspection-not-indexed.json",
  "dns.ready.json",
  "dns.apex-ok-www-missing.json",
  "dns.www-cname-ok.json",
  "dns.nxdomain.json",
  "dns.nodata.json",
  "dns.timeout.json",
  "dns.cname-chain-issue.json",
  "dns.caa-present.json",
  "dns.txt-found.json",
  "dns.txt-missing.json",
  "dns.canonical-mismatch.json",
  "ui-report.safe-apply.json",
  "ui-report.url-only.json",
  "status.default.json",
  "doctor.default.json",
  "recheck.url-only-ready.json",
  "recheck.url-only-needs-attention.json",
  "recheck.repo-backed-appears-deployed.json",
  "recheck.repo-backed-needs-deploy.json",
  "recheck.repo-backed-partial.json",
  "recheck.unknown.json",
  "social-preview.complete.json",
  "social-preview.missing-image.json",
  "social-preview.rendered-only-metadata.json",
  "social-preview.twitter-fallback.json",
  "social-preview.missing-description.json",
  "social-preview.missing-og-url.json",
  "social-preview.raw-rendered-different.json",
  "social-preview.image-unreachable.json",
  "social-preview.minimal-title-only.json",
  "generated-site-smells.clean.json",
  "generated-site-smells.vite-client-only-metadata.json",
  "generated-site-smells.placeholder-content.json",
  "generated-site-smells.missing-social-assets.json",
  "generated-site-smells.hardcoded-localhost.json",
  "generated-site-smells.unsupported-framework.json",
  "generated-site-smells.repo-plus-url-rendered-only.json",
  "patch-export.safe-creations.json",
  "patch-export.review-required.json",
  "patch-export.no-changes.json",
  "patch-export.skipped.json",
  "patch-export.stdout.json",
  "github-pr-draft.safe-creations.json",
  "github-pr-draft.review-required.json",
  "github-pr-draft.no-changes.json",
  "github-pr-draft.stdout.json",
] as const;

export type FixtureName = (typeof FIXTURE_NAMES)[number];

export const POLICY_DOCS = {
  "write-policy-v1": { uri: "shipready://docs/write-policy-v1", path: "docs/WRITE_POLICY_V1.md" },
  "claims-policy": { uri: "shipready://docs/claims-policy", path: "docs/CLAIMS_POLICY.md" },
  commands: { uri: "shipready://docs/commands", path: "docs/COMMANDS.md" },
  contracts: { uri: "shipready://docs/contracts", path: "docs/CONTRACTS.md" },
  "agent-runbook": { uri: "shipready://docs/agent-runbook", path: "docs/AGENT_RUNBOOK.md" },
  status: { uri: "shipready://docs/status", path: "docs/STATUS.md" },
  roadmap: { uri: "shipready://docs/roadmap", path: "docs/ROADMAP.md" },
  distribution: { uri: "shipready://docs/distribution", path: "docs/DISTRIBUTION.md" },
  "mcp-plan": { uri: "shipready://docs/mcp-plan", path: "docs/MCP_PLAN.md" },
  "search-console-readiness-spec": { uri: "shipready://docs/search-console-readiness-spec", path: "docs/SEARCH_CONSOLE_READINESS_SPEC.md" },
  "dns-readiness-spec": { uri: "shipready://docs/dns-readiness-spec", path: "docs/DNS_READINESS_SPEC.md" },
  "post-write-recheck": { uri: "shipready://docs/post-write-recheck", path: "docs/POST_WRITE_RECHECK.md" },
} as const;

export type PolicyDocName = keyof typeof POLICY_DOCS;

export const DOC_RESOURCES = {
  "shipready://docs/readme": "README.md",
  ...Object.fromEntries(Object.values(POLICY_DOCS).map(({ uri, path }) => [uri, path])),
} as Readonly<Record<string, string>>;

export type CanonicalContent = {
  uri: string;
  mediaType: "text/markdown" | "application/json";
  text: string;
};

export async function resolvePackageRoot(): Promise<string> {
  let current = dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 4; depth += 1) {
    const packageJson = resolve(current, "package.json");
    try {
      const parsed = JSON.parse(await readFile(packageJson, "utf8")) as { name?: string };
      if (parsed.name === "shipready") return current;
    } catch {
      // Continue the bounded search from source and bundled entry locations.
    }
    current = dirname(current);
  }
  throw new Error("ShipReady MCP could not locate its installed canonical content root.");
}

export async function validateCanonicalContent(packageRoot: string): Promise<void> {
  try {
    await Promise.all(Object.values(DOC_RESOURCES).map((path) => readCanonicalFile(packageRoot, path)));
    await Promise.all(FIXTURE_NAMES.map((name) => readContractFixture(packageRoot, name)));
  } catch {
    throw new Error("ShipReady MCP canonical content validation failed.");
  }
}

export async function readPolicyDoc(
  packageRoot: string,
  name: string,
): Promise<CanonicalContent> {
  const entry = POLICY_DOCS[name as PolicyDocName];
  if (!entry) {
    throw new ShipReadyMcpError("doc_not_found", "Requested policy document is not available.", {
      stage: "input",
      retryable: false,
    });
  }
  try {
    return {
      uri: entry.uri,
      mediaType: "text/markdown",
      text: await readCanonicalFile(packageRoot, entry.path),
    };
  } catch (error) {
    if (error instanceof ShipReadyMcpError) throw error;
    throw new ShipReadyMcpError("doc_not_found", "Requested policy document is not available.", {
      stage: "contract",
      retryable: false,
    });
  }
}

export async function readResource(packageRoot: string, uri: string): Promise<CanonicalContent> {
  const docPath = DOC_RESOURCES[uri];
  if (docPath) {
    return { uri, mediaType: "text/markdown", text: await readCanonicalFile(packageRoot, docPath) };
  }

  const prefix = "shipready://validation/contracts/";
  if (uri.startsWith(prefix)) {
    const name = decodeURIComponent(uri.slice(prefix.length));
    const fixture = await readContractFixture(packageRoot, name);
    return { uri, mediaType: "application/json", text: JSON.stringify(fixture, null, 2) };
  }

  throw new ShipReadyMcpError("doc_not_found", "Requested MCP resource is not available.", {
    stage: "input",
    retryable: false,
  });
}

export async function readContractFixture(
  packageRoot: string,
  fixtureName: string,
): Promise<Record<string, unknown>> {
  if (!(FIXTURE_NAMES as readonly string[]).includes(fixtureName)) {
    throw new ShipReadyMcpError("fixture_not_found", "Requested contract fixture is not available.", {
      stage: "input",
      retryable: false,
    });
  }

  let fixtureRoot: string;
  let canonical: string;
  try {
    fixtureRoot = await realpath(resolve(packageRoot, "validation/contracts"));
    const candidate = resolve(fixtureRoot, fixtureName);
    canonical = await realpath(candidate);
  } catch {
    throw new ShipReadyMcpError("fixture_not_found", "Requested contract fixture is not available.", {
      stage: "contract",
      retryable: false,
    });
  }
  if (!isContained(fixtureRoot, canonical)) {
    throw new ShipReadyMcpError("fixture_not_found", "Requested contract fixture is not available.", {
      stage: "authorization",
      retryable: false,
    });
  }

  let text: string;
  try {
    text = await readBoundedFile(canonical);
  } catch (error) {
    if (error instanceof ShipReadyMcpError) throw error;
    throw new ShipReadyMcpError("fixture_not_found", "Requested contract fixture is not available.", {
      stage: "contract",
      retryable: false,
    });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ShipReadyMcpError("contract_error", "Contract fixture is not valid JSON.", {
      stage: "contract",
      retryable: false,
    });
  }
  const contract = typeof parsed === "object" && parsed !== null && "contract" in parsed
    ? (parsed as { contract?: unknown }).contract
    : undefined;
  const schema = FIXTURE_SCHEMAS[typeof contract === "string" ? contract : ""];
  if (!schema) {
    throw new ShipReadyMcpError("contract_error", "Contract fixture has an unknown contract discriminator.", {
      stage: "contract",
      retryable: false,
    });
  }
  return schema.parse(parsed) as Record<string, unknown>;
}

export function listResources() {
  return [
    ...Object.keys(DOC_RESOURCES).map((uri) => ({
      uri,
      name: uri.replace("shipready://docs/", ""),
      mimeType: "text/markdown",
    })),
    ...FIXTURE_NAMES.map((name) => ({
      uri: `shipready://validation/contracts/${name}`,
      name,
      mimeType: "application/json",
    })),
  ];
}

const FIXTURE_SCHEMAS: Readonly<Record<string, ZodType>> = {
  "shipready.audit.v1": AuditJsonContractSchema,
  "shipready.crawl.v1": CrawlJsonContractSchema,
  "shipready.repoInspection.v1": RepoInspectionJsonContractSchema,
  "shipready.fixPlan.v1": FixPlanJsonContractSchema,
  "shipready.dryRunFix.v1": DryRunFixJsonContractSchema,
  "shipready.writeFix.v1": WriteFixJsonContractSchema,
  "shipready.uiReport.v1": UiReportJsonContractSchema,
  "shipready.searchConsoleStatus.v1": SearchConsoleStatusJsonContractSchema,
  "shipready.dnsStatus.v1": DnsStatusJsonContractSchema,
  "shipready.error.v1": CliErrorContractSchema,
  "shipready.status.v1": StatusJsonContractSchema,
  "shipready.doctor.v1": DoctorJsonContractSchema,
  "shipready.recheck.v1": RecheckJsonContractSchema,
  "shipready.socialPreview.v1": SocialPreviewJsonContractSchema,
  "shipready.generatedSiteSmells.v1": GeneratedSiteSmellsJsonContractSchema,
  "shipready.patchExport.v1": PatchExportJsonContractSchema,
  "shipready.githubPrDraft.v1": GithubPrDraftJsonContractSchema,
};

async function readCanonicalFile(packageRoot: string, relativePath: string): Promise<string> {
  const canonicalRoot = await realpath(packageRoot);
  const candidate = resolve(canonicalRoot, relativePath);
  const canonical = await realpath(candidate);
  if (!isContained(canonicalRoot, canonical)) throw new Error("Canonical content escaped package root.");
  return readBoundedFile(canonical);
}

async function readBoundedFile(path: string): Promise<string> {
  const content = await readFile(path);
  if (content.byteLength > MAX_CANONICAL_READ_BYTES) {
    throw new ShipReadyMcpError("contract_error", "Canonical content exceeds the MCP response limit.", {
      stage: "contract",
      retryable: false,
    });
  }
  return content.toString("utf8");
}

function isContained(root: string, candidate: string): boolean {
  if (root === candidate) return true;
  const fromRoot = relative(root, candidate);
  return Boolean(fromRoot) && !isAbsolute(fromRoot) && !fromRoot.startsWith(`..${sep}`) && fromRoot !== "..";
}
