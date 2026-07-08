import {
  CONTRACT_NAMES,
  StatusJsonContractSchema,
  type StatusJsonContract,
} from "../types/contracts";
import { WRITE_POLICY_V1 } from "../types/writeFix";
import { MCP_READ_ONLY_TOOL_NAMES, MCP_WRITE_TOOL_NAMES } from "../mcp/toolNames";
import { SHIPREADY_VERSION } from "../version";

export const STATUS_CLI_COMMANDS = [
  "status",
  "doctor",
  "search-console status",
  "dns status",
  "recheck",
  "crawl",
  "social-preview",
  "smells",
  "patch-export",
  "audit",
  "inspect-repo",
  "plan-fixes",
  "fix --dry-run",
  "fix --write --allow-create",
  "ui-report",
  "html-report",
  "gui",
  "mcp",
] as const;

export function createStatus(): StatusJsonContract {
  return StatusJsonContractSchema.parse({
    contract: CONTRACT_NAMES.status,
    version: SHIPREADY_VERSION,
    mode: {
      cliFirst: true,
      mcpSecond: true,
      guiThird: true,
    },
    capabilities: {
      cli: [...STATUS_CLI_COMMANDS],
      mcp: {
        stdio: true,
        readOnlyTools: [...MCP_READ_ONLY_TOOL_NAMES],
        writeTools: [...MCP_WRITE_TOOL_NAMES],
        remoteTransport: false,
      },
      gui: {
        local: true,
        writeEndpoint: false,
      },
    },
    writePolicy: {
      name: "WRITE_POLICY_V1",
      id: WRITE_POLICY_V1,
      summary: "Creation-only, all-or-nothing writes for eligible missing robots and sitemap files.",
      allowed: [
        "Create eligible missing robots files at framework-allowlisted paths",
        "Create eligible missing sitemap files at framework-allowlisted paths",
      ],
      forbidden: [
        "Overwrite, delete, rename, or format existing files",
        "Write metadata, content, JSON-LD, packages, or configuration",
        "Run Git, GitHub, deployment, DNS, or Search Console mutations",
      ],
    },
    integrations: {
      boundedMultiPageCrawl: "read_only_bounded_sample",
      fullSiteCrawler: "not_implemented",
      monitoring: "not_implemented",
      scheduledCrawls: "not_implemented",
      patchExport: "review_only_export",
      patchApply: "not_implemented",
      generatedSiteSmells: "read_only_detector",
      aiAuthorshipDetection: "not_implemented",
      smellDetectorAutoFixes: "not_implemented",
      socialPreview: "read_only_simulator",
      socialPlatformApis: "not_implemented",
      exactSocialRenderingGuarantee: false,
      searchConsole: "mock_prototype",
      dns: "read_only_status",
      dnsProviderWrites: "not_implemented",
      dnsProviderIntegrations: "not_implemented",
      github: "not_implemented",
      deployment: "not_implemented",
      postWriteRecheck: "read_only",
      deploymentAutomation: "not_implemented",
      deployProviderIntegrations: "not_implemented",
    },
    demos: {
      fodmappShare: "validation/demo-fodmapp-share/",
      fodmappVoiceover: "validation/demo-fodmapp-voiceover-final/",
    },
    nextRecommendedCommand: "pnpm shipready doctor",
    nextRecommendedPass: "GitHub PR integration",
  });
}

export function formatStatusJson(status = createStatus()): string {
  return `${JSON.stringify(StatusJsonContractSchema.parse(status), null, 2)}\n`;
}

export function formatStatusHuman(status = createStatus()): string {
  return [
    `ShipReady status (v${status.version})`,
    "Mode: CLI first -> MCP second -> GUI third",
    "",
    "Capabilities",
    `  CLI: ${status.capabilities.cli.join(", ")}`,
    `  MCP: stdio; ${status.capabilities.mcp.readOnlyTools.length} read-only tools; write tool: ${status.capabilities.mcp.writeTools.join(", ")}`,
    "  GUI: local, preview/copy-only, no write endpoint",
    "",
    "Safety",
    `  ${status.writePolicy.name}: ${status.writePolicy.summary}`,
    "  Search Console: spec exists, mock prototype available, live integration not implemented",
    "  DNS readiness: read-only status checks implemented; provider writes/integrations not implemented",
    "  Post-write recheck: implemented read-only; local changes still require external deployment",
    "  Bounded multi-page crawl: implemented read-only; exhaustive crawler and scheduled monitoring not implemented",
    "  Patch export: implemented as review-only artifact generation; patch application is not implemented",
    "  Social preview simulator: implemented read-only; social platform APIs and exact rendering guarantees not implemented",
    "  Generated-site implementation smell detector: implemented read-only; authorship identification and auto-fixes not implemented",
    "  Deployment automation and deploy provider integrations: not implemented",
    "  Remote MCP and GitHub integrations: not implemented",
    "",
    "Demo artifacts",
    `  ${status.demos.fodmappShare}`,
    `  ${status.demos.fodmappVoiceover}`,
    "",
    `Next: ${status.nextRecommendedCommand}`,
    "",
  ].join("\n");
}
