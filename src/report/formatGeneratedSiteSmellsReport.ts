import {
  GeneratedSiteSmellsJsonContractSchema,
  type GeneratedSiteSmellsJsonContract,
} from "../types/contracts";

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
    "Generated-site implementation smells",
    "Heuristic implementation signals only; this is not proof of who or what produced the site.",
    "",
    "Summary",
    `  Status: ${result.summary.status}`,
    `  Mode: ${result.mode}`,
    `  Repo: ${result.repoPath}`,
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
    "Limitations",
    ...result.limitations.map((item) => `  - ${item}`),
    "",
    "Next actions",
    ...result.nextActions.map((item) => `  - ${item}`),
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
  const preview = evidence.valuePreview ? ` "${evidence.valuePreview}"` : "";
  return `${location}${field}${preview}`;
}
