import {
  GeneratedSiteSmellsJsonContractSchema,
  type GeneratedSiteSmellsJsonContract,
} from "../types/contracts";
import {
  formatJsonMoreLine,
  formatTerminalReviewHeader,
  truncateTerminalValue,
  type TerminalReviewStatus,
} from "./terminalReview";

const SECTION_CATEGORIES: Array<{
  title: string;
  categories: GeneratedSiteSmellsJsonContract["findings"][number]["category"][];
}> = [
  { title: "Metadata / preview risks", categories: ["metadata", "preview"] },
  { title: "Crawlability risks", categories: ["crawlability", "routing"] },
  { title: "Placeholder / boilerplate signals", categories: ["content_placeholders", "generated_boilerplate"] },
  { title: "Asset risks", categories: ["assets"] },
  { title: "Framework/configuration ambiguity", categories: ["framework", "configuration", "unknown"] },
];

export function formatGeneratedSiteSmellsJson(
  result: GeneratedSiteSmellsJsonContract,
): string {
  return `${JSON.stringify(GeneratedSiteSmellsJsonContractSchema.parse(result), null, 2)}\n`;
}

export function formatGeneratedSiteSmellsHuman(
  result: GeneratedSiteSmellsJsonContract,
): string {
  const lines = [
    ...formatTerminalReviewHeader("ShipReady implementation smell review", {
      target: result.url ?? result.repoPath,
      repo: result.repoPath,
      mode: result.mode,
      status: formatStatus(result.summary.status),
      next: result.nextActions[0],
    }),
    "",
    "Summary",
    ...(result.url ? [`  URL: ${result.url}`] : []),
    `  Framework: ${result.framework.name} (${result.framework.confidence} confidence)`,
    `  Findings: ${result.summary.findingCount} total; high ${result.summary.severityCounts.high}, medium ${result.summary.severityCounts.medium}, low ${result.summary.severityCounts.low}, info ${result.summary.severityCounts.info}`,
    `  Scanned: ${result.scanned.files} files, ${result.scanned.bytes} bytes${result.scanned.truncated ? " (truncated)" : ""}`,
    "",
    "Top findings",
    ...formatFindingList(result.findings.slice(0, 5)),
  ];

  for (const section of SECTION_CATEGORIES) {
    const findings = result.findings.filter((finding) => section.categories.includes(finding.category));
    lines.push("", section.title, ...formatFindingList(findings));
  }

  lines.push(
    "",
    "Safety",
    "  - Heuristic implementation signals only. Not authorship proof, generator identity, or site quality proof.",
    "  - Read-only. No fixes, Git/GitHub, deploy, DNS, Search Console, social platform, OAuth, or token behavior is used.",
    "",
    "Limitations",
    ...result.limitations.map((item) => `  - ${item}`),
    "",
    "Next actions",
    ...result.nextActions.map((item) => `  - ${item}`),
    "",
    formatJsonMoreLine(),
    "",
  );

  return lines.join("\n");
}

function formatFindingList(findings: GeneratedSiteSmellsJsonContract["findings"]): string[] {
  if (findings.length === 0) return ["  - None found in this section."];
  return findings.flatMap((finding) => {
    const evidence = finding.evidence.map(formatEvidence).join("; ");
    return [
      `  - [${finding.severity}; ${finding.confidence} confidence] ${finding.title}`,
      `    Evidence: ${evidence}`,
      `    Why it matters: ${finding.whyItMatters}`,
      `    Next action: ${finding.nextAction}`,
    ];
  });
}

function formatEvidence(evidence: GeneratedSiteSmellsJsonContract["findings"][number]["evidence"][number]): string {
  const location = evidence.path
    ? `${evidence.path}${evidence.line ? `:${evidence.line}` : ""}`
    : evidence.source;
  const field = evidence.field ? ` ${evidence.field}` : "";
  const preview = evidence.valuePreview ? ` "${truncateTerminalValue(evidence.valuePreview, 88)}"` : "";
  return `${location}${field}${preview}`;
}

function formatStatus(status: GeneratedSiteSmellsJsonContract["summary"]["status"]): TerminalReviewStatus {
  if (status === "clean") return "Ready";
  if (status === "manual_review") return "Manual review";
  if (status === "needs_attention") return "Needs attention";
  return "Unknown";
}
