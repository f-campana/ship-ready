import {
  CONTRACT_NAMES,
  StatusJsonContractSchema,
  type StatusJsonContract,
} from "../types/contracts";
import { WRITE_POLICY_V1 } from "../types/writeFix";
import { MCP_READ_ONLY_TOOL_NAMES, MCP_WRITE_TOOL_NAMES } from "../mcp/toolNames";
import { SHIPREADY_VERSION } from "../version";
import { formatTerminalReviewHeader } from "../report/terminalReview";

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
  "github-pr-draft",
  "audit",
  "inspect-repo",
  "plan-fixes",
  "fix --dry-run",
  "fix --write --allow-create",
  "ui-report",
  "tui",
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
      githubPrDraft: "review_only_handoff",
      liveGithubPrCreation: "not_implemented",
      gitCommandsExecution: "not_implemented",
      branchCreation: "not_implemented",
      commitPush: "not_implemented",
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
    nextRecommendedPass: "publish execution plan",
  });
}

export function formatStatusJson(status = createStatus()): string {
  return `${JSON.stringify(StatusJsonContractSchema.parse(status), null, 2)}\n`;
}

export function formatStatusHuman(status = createStatus()): string {
  return [
    ...formatTerminalReviewHeader(`ShipReady status (v${status.version})`, {
      mode: "CLI first -> MCP second -> GUI third",
      status: "Ready",
      next: status.nextRecommendedCommand,
    }),
    "",
    "Capabilities",
    `  CLI commands: ${status.capabilities.cli.length} implemented`,
    `  Core workflow: audit, inspect-repo, plan-fixes, fix --dry-run, patch-export, github-pr-draft, ui-report, gui, mcp`,
    `  Evidence checks: crawl, social-preview, smells, recheck, dns status, search-console status`,
    `  MCP: stdio; ${status.capabilities.mcp.readOnlyTools.length} read-only tools; write tool: ${status.capabilities.mcp.writeTools.join(", ")}`,
    "  GUI: local, preview/copy-only, no write endpoint",
    "",
    "Terminal review",
    "  Human CLI output uses verdict/target/next-action headers and compact safety labels.",
    "  TUI viewer: implemented read-only; it reuses ui-report data and falls back to plain output in CI/non-TTY streams.",
    "",
    "Safety",
    `  ${status.writePolicy.name}: ${status.writePolicy.summary}`,
    "  Search Console: mock-backed only; live Google API/OAuth/token storage not implemented",
    "  DNS readiness: read-only resolver evidence; provider writes/integrations not implemented",
    "  Patch export: review-only; not applied to the target repository",
    "  GitHub PR draft: draft only; no PR, GitHub API call, Git command, branch, commit, push, or deploy",
    "  Crawl/social/smells/recheck: read-only evidence surfaces with explicit limitations",
    "  Distribution: repository-local now; future npm direction is @ship-ready/cli, but publication remains blocked",
    "  Deployment automation, live GitHub integration, DNS writes, live Search Console, remote MCP, telemetry, auth, accounts, and billing: not implemented",
    "",
    "Demo artifacts",
    `  ${status.demos.fodmappShare}`,
    `  ${status.demos.fodmappVoiceover}`,
    "",
    `Next pass: ${status.nextRecommendedPass}`,
    "",
  ].join("\n");
}
