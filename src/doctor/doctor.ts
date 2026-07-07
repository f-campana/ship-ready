import { spawnSync } from "node:child_process";
import * as dns from "node:dns/promises";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import {
  DoctorJsonContractSchema,
  type DoctorCheck,
  type DoctorJsonContract,
  CONTRACT_NAMES,
} from "../types/contracts";
import { WRITE_POLICY_V1 } from "../types/writeFix";
import {
  DOC_RESOURCES,
  FIXTURE_NAMES,
  readContractFixture,
  resolvePackageRoot,
} from "../mcp/resources";
import { resolveAllowedRoots } from "../mcp/config";

const MINIMUM_NODE_MAJOR = 20;
const REQUIRED_DEMO_ARTIFACTS = [
  "validation/demo-fodmapp-share/final-demo.mp4",
  "validation/demo-fodmapp-share/thumbnail.png",
  "validation/demo-fodmapp-voiceover-final/final-demo-silent.mp4",
  "validation/demo-fodmapp-voiceover-final/final-demo-with-voice.mp4",
] as const;

type DoctorDependencies = {
  resolvePackageRoot: () => Promise<string>;
  nodeVersion: string;
  commandVersion: (command: string, args: string[]) => string | undefined;
  pathExists: (path: string) => boolean;
  readText: (path: string) => Promise<string>;
  dependencyAvailable: (packageRoot: string, specifier: string) => boolean;
  nodeDnsApisAvailable: () => boolean;
  validateFixtures: (packageRoot: string) => Promise<void>;
  playwrightExecutablePath: () => string;
};

const DEFAULT_DEPENDENCIES: DoctorDependencies = {
  resolvePackageRoot,
  nodeVersion: process.versions.node,
  commandVersion,
  pathExists: existsSync,
  readText: (path) => readFile(path, "utf8"),
  dependencyAvailable,
  nodeDnsApisAvailable: () =>
    typeof dns.resolve4 === "function" &&
    typeof dns.resolve6 === "function" &&
    typeof dns.resolveCname === "function" &&
    typeof dns.resolveTxt === "function" &&
    typeof dns.resolveNs === "function" &&
    typeof dns.resolveCaa === "function",
  validateFixtures: async (packageRoot) => {
    await Promise.all(FIXTURE_NAMES.map((name) => readContractFixture(packageRoot, name)));
  },
  playwrightExecutablePath: () => chromium.executablePath(),
};

export async function runDoctor(
  overrides: Partial<DoctorDependencies> = {},
): Promise<DoctorJsonContract> {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...overrides };
  const checks: DoctorCheck[] = [];

  const nodeMajor = Number(dependencies.nodeVersion.split(".")[0]);
  checks.push({
    id: "node-version",
    label: "Node.js",
    status: Number.isInteger(nodeMajor) && nodeMajor >= MINIMUM_NODE_MAJOR ? "pass" : "fail",
    message: Number.isInteger(nodeMajor) && nodeMajor >= MINIMUM_NODE_MAJOR
      ? `Node.js ${dependencies.nodeVersion} is supported.`
      : `Node.js ${MINIMUM_NODE_MAJOR}+ is required; install a supported Node.js release.`,
    details: { version: dependencies.nodeVersion, minimumMajor: MINIMUM_NODE_MAJOR },
  });

  const pnpmVersion = dependencies.commandVersion("pnpm", ["--version"]);
  checks.push({
    id: "pnpm",
    label: "pnpm",
    status: pnpmVersion ? "pass" : "fail",
    message: pnpmVersion
      ? `pnpm ${pnpmVersion} is available.`
      : "pnpm is unavailable; enable Corepack or install the package manager declared by ShipReady.",
    ...(pnpmVersion ? { details: { version: pnpmVersion } } : {}),
  });

  let browserPath = "";
  try {
    browserPath = dependencies.playwrightExecutablePath();
  } catch {
    browserPath = "";
  }
  const browserInstalled = Boolean(browserPath) && dependencies.pathExists(browserPath);
  checks.push({
    id: "playwright-browser",
    label: "Playwright Chromium",
    status: browserInstalled ? "pass" : "fail",
    message: browserInstalled
      ? "The Playwright Chromium executable is installed."
      : "The Playwright Chromium executable is missing; run `pnpm playwright:install`.",
  });

  const ffmpegVersion = dependencies.commandVersion("ffmpeg", ["-version"]);
  checks.push({
    id: "ffmpeg",
    label: "FFmpeg",
    status: ffmpegVersion ? "pass" : "warn",
    message: ffmpegVersion
      ? `FFmpeg is available (${ffmpegVersion}).`
      : "FFmpeg is optional and only needed for demo composition.",
  });

  let packageRoot: string | undefined;
  try {
    packageRoot = await dependencies.resolvePackageRoot();
    checks.push({
      id: "package-root",
      label: "Package content",
      status: "pass",
      message: "The ShipReady package content root is available.",
    });
  } catch {
    checks.push({
      id: "package-root",
      label: "Package content",
      status: "fail",
      message: "ShipReady could not locate package.json; reinstall or run from a complete checkout.",
    });
  }

  if (!packageRoot) {
    for (const [id, label] of [
      ["mcp-sdk", "MCP SDK"],
      ["mcp-configuration", "MCP configuration"],
      ["contract-fixtures", "Contract fixtures"],
      ["canonical-docs", "Canonical docs"],
      ["search-console-prototype", "Search Console mock prototype"],
      ["dns-readiness", "DNS readiness"],
      ["post-write-recheck", "Post-write recheck"],
      ["social-preview-simulator", "Social preview simulator"],
      ["generated-site-smells", "Generated-site smell detector"],
      ["bounded-crawl", "Bounded multi-page crawl"],
      ["write-policy", "WRITE_POLICY_V1"],
      ["local-gui-spec", "LOCAL_FIRST_GUI_SPEC"],
      ["demo-artifacts", "Demo artifacts"],
    ] as const) {
      checks.push({
        id,
        label,
        status: "skip",
        message: "Skipped because the ShipReady package content root is unavailable.",
      });
    }
    return createDoctorReport(checks);
  }

  const mcpSdkInstalled = dependencies.dependencyAvailable(
    packageRoot,
    "@modelcontextprotocol/sdk/server/index.js",
  );
  checks.push({
    id: "mcp-sdk",
    label: "MCP SDK",
    status: mcpSdkInstalled ? "pass" : "fail",
    message: mcpSdkInstalled
      ? "The MCP SDK dependency is installed."
      : "The MCP SDK dependency is missing; run `pnpm install`.",
  });

  let mcpConfigurationValid = false;
  try {
    mcpConfigurationValid = resolveAllowedRoots([packageRoot]).length === 1;
  } catch {
    mcpConfigurationValid = false;
  }
  checks.push({
    id: "mcp-configuration",
    label: "MCP configuration",
    status: mcpConfigurationValid ? "pass" : "fail",
    message: mcpConfigurationValid
      ? "The local stdio MCP command can accept an explicit allowed root; no server was started."
      : "The MCP allowed-root configuration could not be validated.",
  });

  try {
    await dependencies.validateFixtures(packageRoot);
    checks.push({
      id: "contract-fixtures",
      label: "Contract fixtures",
      status: "pass",
      message: `${FIXTURE_NAMES.length} canonical contract fixtures exist and parse.`,
      details: { count: FIXTURE_NAMES.length },
    });
  } catch {
    checks.push({
      id: "contract-fixtures",
      label: "Contract fixtures",
      status: "fail",
      message: "Canonical contract fixtures are missing or invalid; run `pnpm contracts:fixtures` and reinstall if needed.",
    });
  }

  const canonicalDocPaths = [...new Set(Object.values(DOC_RESOURCES))];
  const missingDocs = canonicalDocPaths.filter((path) => !dependencies.pathExists(join(packageRoot, path)));
  checks.push({
    id: "canonical-docs",
    label: "Canonical docs",
    status: missingDocs.length === 0 ? "pass" : "fail",
    message: missingDocs.length === 0
      ? `${canonicalDocPaths.length} canonical documentation files are present.`
      : `Canonical documentation is incomplete; missing: ${missingDocs.join(", ")}.`,
    details: { checked: canonicalDocPaths.length, missing: missingDocs },
  });

  const searchConsoleSpec = "docs/SEARCH_CONSOLE_READINESS_SPEC.md";
  const searchConsoleFixtures = FIXTURE_NAMES.filter((name) => name.startsWith("search-console."));
  const missingSearchConsoleContent = [
    ...(!dependencies.pathExists(join(packageRoot, searchConsoleSpec)) ? [searchConsoleSpec] : []),
    ...searchConsoleFixtures
      .map((name) => `validation/contracts/${name}`)
      .filter((path) => !dependencies.pathExists(join(packageRoot, path))),
  ];
  checks.push({
    id: "search-console-prototype",
    label: "Search Console mock prototype",
    status: missingSearchConsoleContent.length === 0 ? "pass" : "fail",
    message: missingSearchConsoleContent.length === 0
      ? `The Search Console specification and ${searchConsoleFixtures.length} deterministic mock fixtures are present; no Google credentials are required.`
      : `Search Console prototype content is incomplete; missing: ${missingSearchConsoleContent.join(", ")}.`,
    details: {
      liveIntegration: false,
      oauthRequired: false,
      fixtures: searchConsoleFixtures.length,
      missing: missingSearchConsoleContent,
    },
  });

  const dnsSpec = "docs/DNS_READINESS_SPEC.md";
  const dnsFixtures = FIXTURE_NAMES.filter((name) => name.startsWith("dns."));
  const missingDnsContent = [
    ...(!dependencies.pathExists(join(packageRoot, dnsSpec)) ? [dnsSpec] : []),
    ...dnsFixtures
      .map((name) => `validation/contracts/${name}`)
      .filter((path) => !dependencies.pathExists(join(packageRoot, path))),
  ];
  const dnsApisAvailable = dependencies.nodeDnsApisAvailable();
  checks.push({
    id: "dns-readiness",
    label: "DNS readiness",
    status: missingDnsContent.length === 0 && dnsApisAvailable ? "pass" : "fail",
    message: missingDnsContent.length === 0 && dnsApisAvailable
      ? `The DNS specification, Node DNS APIs, and ${dnsFixtures.length} deterministic mock fixtures are present; no DNS provider credentials are required.`
      : `DNS readiness content is incomplete or Node DNS APIs are unavailable; missing: ${missingDnsContent.join(", ") || "Node DNS API support"}.`,
    details: {
      readOnly: true,
      providerWrites: false,
      providerIntegrations: false,
      fixtures: dnsFixtures.length,
      nodeDnsApisAvailable: dnsApisAvailable,
      missing: missingDnsContent,
    },
  });

  const recheckDoc = "docs/POST_WRITE_RECHECK.md";
  const recheckSkill = "skills/shipready-launch-readiness/SKILL.md";
  const recheckFixtures = FIXTURE_NAMES.filter((name) => name.startsWith("recheck."));
  const missingRecheckContent = [
    ...(!dependencies.pathExists(join(packageRoot, recheckDoc)) ? [recheckDoc] : []),
    ...(!dependencies.pathExists(join(packageRoot, recheckSkill)) ? [recheckSkill] : []),
    ...recheckFixtures
      .map((name) => `validation/contracts/${name}`)
      .filter((path) => !dependencies.pathExists(join(packageRoot, path))),
  ];
  let skillReferencesRecheck = false;
  if (missingRecheckContent.length === 0) {
    try {
      const skill = await dependencies.readText(join(packageRoot, recheckSkill));
      skillReferencesRecheck = skill.includes("shipready recheck") && skill.includes("Do not deploy");
    } catch {
      skillReferencesRecheck = false;
    }
  }
  checks.push({
    id: "post-write-recheck",
    label: "Post-write recheck",
    status: missingRecheckContent.length === 0 && skillReferencesRecheck ? "pass" : "fail",
    message: missingRecheckContent.length === 0 && skillReferencesRecheck
      ? `The read-only recheck guide, skill workflow, and ${recheckFixtures.length} deterministic fixtures are present; no network or deployment credentials are required by doctor.`
      : `Post-write recheck content is incomplete or inconsistent; missing: ${missingRecheckContent.join(", ") || "safe skill guidance"}.`,
    details: {
      readOnly: true,
      networkRequired: false,
      deploymentCredentialsRequired: false,
      fixtures: recheckFixtures.length,
      missing: missingRecheckContent,
      skillReferencesRecheck,
    },
  });

  const socialPreviewSkill = "skills/shipready-launch-readiness/SKILL.md";
  const socialPreviewFixtures = FIXTURE_NAMES.filter((name) => name.startsWith("social-preview."));
  const missingSocialPreviewContent = [
    ...(!dependencies.pathExists(join(packageRoot, socialPreviewSkill)) ? [socialPreviewSkill] : []),
    ...socialPreviewFixtures
      .map((name) => `validation/contracts/${name}`)
      .filter((path) => !dependencies.pathExists(join(packageRoot, path))),
  ];
  let skillReferencesSocialPreview = false;
  if (missingSocialPreviewContent.length === 0) {
    try {
      const skill = await dependencies.readText(join(packageRoot, socialPreviewSkill));
      skillReferencesSocialPreview =
        skill.includes("shipready social-preview") &&
        skill.includes("simulated preview") &&
        skill.includes("No social platform APIs");
    } catch {
      skillReferencesSocialPreview = false;
    }
  }
  checks.push({
    id: "social-preview-simulator",
    label: "Social preview simulator",
    status: missingSocialPreviewContent.length === 0 && skillReferencesSocialPreview ? "pass" : "fail",
    message: missingSocialPreviewContent.length === 0 && skillReferencesSocialPreview
      ? `The read-only social preview simulator guidance and ${socialPreviewFixtures.length} deterministic fixtures are present; no social platform credentials or network checks are required by doctor.`
      : `Social preview simulator content is incomplete or inconsistent; missing: ${missingSocialPreviewContent.join(", ") || "safe skill guidance"}.`,
    details: {
      readOnly: true,
      socialPlatformApis: false,
      exactRenderingGuarantee: false,
      networkRequired: false,
      fixtures: socialPreviewFixtures.length,
      missing: missingSocialPreviewContent,
      skillReferencesSocialPreview,
    },
  });

  const smellSkill = "skills/shipready-launch-readiness/SKILL.md";
  const smellDocs = ["docs/COMMANDS.md", "docs/CONTRACTS.md", "docs/CLAIMS_POLICY.md"];
  const smellFixtures = FIXTURE_NAMES.filter((name) => name.startsWith("generated-site-smells."));
  const missingSmellContent = [
    ...(!dependencies.pathExists(join(packageRoot, smellSkill)) ? [smellSkill] : []),
    ...smellDocs.filter((path) => !dependencies.pathExists(join(packageRoot, path))),
    ...smellFixtures
      .map((name) => `validation/contracts/${name}`)
      .filter((path) => !dependencies.pathExists(join(packageRoot, path))),
  ];
  let smellDocsReferenceLimitations = false;
  if (missingSmellContent.length === 0) {
    try {
      const [skill, commands, contracts, claims] = await Promise.all([
        dependencies.readText(join(packageRoot, smellSkill)),
        dependencies.readText(join(packageRoot, "docs/COMMANDS.md")),
        dependencies.readText(join(packageRoot, "docs/CONTRACTS.md")),
        dependencies.readText(join(packageRoot, "docs/CLAIMS_POLICY.md")),
      ]);
      const combined = `${skill}\n${commands}\n${contracts}\n${claims}`;
      smellDocsReferenceLimitations =
        combined.includes("shipready smells") &&
        combined.includes("generated-site implementation") &&
        combined.includes("heuristic implementation signals") &&
        combined.includes("not proof");
    } catch {
      smellDocsReferenceLimitations = false;
    }
  }
  checks.push({
    id: "generated-site-smells",
    label: "Generated-site smell detector",
    status: missingSmellContent.length === 0 && smellDocsReferenceLimitations ? "pass" : "fail",
    message: missingSmellContent.length === 0 && smellDocsReferenceLimitations
      ? `The read-only generated-site smell detector guidance and ${smellFixtures.length} deterministic fixtures are present; no repo input or network is required by doctor.`
      : `Generated-site smell detector content is incomplete or inconsistent; missing: ${missingSmellContent.join(", ") || "safe detector guidance"}.`,
    details: {
      readOnly: true,
      autoFixes: false,
      authorshipIdentification: false,
      networkRequired: false,
      fixtures: smellFixtures.length,
      missing: missingSmellContent,
      docsReferenceLimitations: smellDocsReferenceLimitations,
    },
  });

  const crawlSkill = "skills/shipready-launch-readiness/SKILL.md";
  const crawlDocs = ["docs/COMMANDS.md", "docs/CONTRACTS.md", "docs/CLAIMS_POLICY.md"];
  const crawlFixtures = FIXTURE_NAMES.filter((name) => name.startsWith("crawl."));
  const missingCrawlContent = [
    ...(!dependencies.pathExists(join(packageRoot, crawlSkill)) ? [crawlSkill] : []),
    ...crawlDocs.filter((path) => !dependencies.pathExists(join(packageRoot, path))),
    ...crawlFixtures
      .map((name) => `validation/contracts/${name}`)
      .filter((path) => !dependencies.pathExists(join(packageRoot, path))),
  ];
  let crawlDocsReferenceLimitations = false;
  if (missingCrawlContent.length === 0) {
    try {
      const [skill, commands, contracts, claims] = await Promise.all([
        dependencies.readText(join(packageRoot, crawlSkill)),
        dependencies.readText(join(packageRoot, "docs/COMMANDS.md")),
        dependencies.readText(join(packageRoot, "docs/CONTRACTS.md")),
        dependencies.readText(join(packageRoot, "docs/CLAIMS_POLICY.md")),
      ]);
      const combined = `${skill}\n${commands}\n${contracts}\n${claims}`;
      crawlDocsReferenceLimitations =
        combined.includes("shipready crawl") &&
        combined.includes("bounded multi-page crawl") &&
        combined.includes("same-origin") &&
        combined.includes("not a full-site crawler");
    } catch {
      crawlDocsReferenceLimitations = false;
    }
  }
  checks.push({
    id: "bounded-crawl",
    label: "Bounded multi-page crawl",
    status: missingCrawlContent.length === 0 && crawlDocsReferenceLimitations ? "pass" : "fail",
    message: missingCrawlContent.length === 0 && crawlDocsReferenceLimitations
      ? `The read-only bounded crawl guidance and ${crawlFixtures.length} deterministic fixtures are present; doctor performs no network crawl.`
      : `Bounded crawl content is incomplete or inconsistent; missing: ${missingCrawlContent.join(", ") || "safe crawl guidance"}.`,
    details: {
      readOnly: true,
      networkRequired: false,
      fullSiteCrawler: false,
      monitoring: false,
      fixtures: crawlFixtures.length,
      missing: missingCrawlContent,
      docsReferenceLimitations: crawlDocsReferenceLimitations,
    },
  });

  const writePolicyPath = join(packageRoot, "docs/WRITE_POLICY_V1.md");
  let writePolicyValid = false;
  if (dependencies.pathExists(writePolicyPath)) {
    try {
      const text = await dependencies.readText(writePolicyPath);
      writePolicyValid = text.includes("# ShipReady Write Policy V1") && text.includes(WRITE_POLICY_V1);
    } catch {
      writePolicyValid = false;
    }
  }
  checks.push({
    id: "write-policy",
    label: "WRITE_POLICY_V1",
    status: writePolicyValid ? "pass" : "fail",
    message: writePolicyValid
      ? `The canonical ${WRITE_POLICY_V1} policy document is present.`
      : "The canonical WRITE_POLICY_V1 document is missing or inconsistent; restore docs/WRITE_POLICY_V1.md.",
  });

  const guiSpecPresent = dependencies.pathExists(join(packageRoot, "docs/LOCAL_FIRST_GUI_SPEC.md"));
  checks.push({
    id: "local-gui-spec",
    label: "LOCAL_FIRST_GUI_SPEC",
    status: guiSpecPresent ? "pass" : "fail",
    message: guiSpecPresent
      ? "The canonical local-first GUI specification is present."
      : "The canonical LOCAL_FIRST_GUI_SPEC is missing; restore docs/LOCAL_FIRST_GUI_SPEC.md.",
  });

  const missingDemoArtifacts = REQUIRED_DEMO_ARTIFACTS.filter(
    (path) => !dependencies.pathExists(join(packageRoot, path)),
  );
  checks.push({
    id: "demo-artifacts",
    label: "Demo artifacts",
    status: missingDemoArtifacts.length === 0 ? "pass" : "warn",
    message: missingDemoArtifacts.length === 0
      ? "The expected Fodmapp share and voiceover artifacts are present."
      : "Optional demo artifacts are incomplete; core CLI operation is unaffected.",
    details: { missing: missingDemoArtifacts },
  });

  return createDoctorReport(checks);
}

export function createDoctorReport(checks: DoctorCheck[]): DoctorJsonContract {
  const summary = { pass: 0, warn: 0, fail: 0, skip: 0 };
  for (const check of checks) summary[check.status] += 1;
  return DoctorJsonContractSchema.parse({
    contract: CONTRACT_NAMES.doctor,
    ok: summary.fail === 0,
    checks,
    summary,
  });
}

export function formatDoctorJson(report: DoctorJsonContract): string {
  return `${JSON.stringify(DoctorJsonContractSchema.parse(report), null, 2)}\n`;
}

export function formatDoctorHuman(report: DoctorJsonContract): string {
  const lines = ["ShipReady doctor"];
  for (const check of report.checks) {
    lines.push(`[${check.status.toUpperCase()}] ${check.label}: ${check.message}`);
  }
  lines.push(
    "",
    `Summary: ${report.summary.pass} pass, ${report.summary.warn} warn, ${report.summary.fail} fail, ${report.summary.skip} skip`,
    report.ok ? "Ready: yes" : "Ready: no; resolve failed checks and run `pnpm shipready doctor` again.",
    "",
  );
  return lines.join("\n");
}

function commandVersion(command: string, args: string[]): string | undefined {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 2_000,
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.error || result.status !== 0) return undefined;
  const firstLine = result.stdout.trim().split(/\r?\n/, 1)[0];
  return firstLine || undefined;
}

function dependencyAvailable(packageRoot: string, specifier: string): boolean {
  try {
    createRequire(join(packageRoot, "package.json")).resolve(specifier);
    return true;
  } catch {
    return false;
  }
}
