import {
  SocialPreviewJsonContractSchema,
  type SocialPreviewJsonContract,
} from "../types/contracts";
import {
  formatJsonMoreLine,
  formatTerminalReviewHeader,
  type TerminalReviewStatus,
} from "./terminalReview";

type Surface = SocialPreviewJsonContract["previews"][keyof SocialPreviewJsonContract["previews"]];

export function formatSocialPreviewJson(result: SocialPreviewJsonContract): string {
  return `${JSON.stringify(SocialPreviewJsonContractSchema.parse(result), null, 2)}\n`;
}

export function formatSocialPreviewHuman(result: SocialPreviewJsonContract): string {
  const report = SocialPreviewJsonContractSchema.parse(result);
  const lines = [
    ...formatTerminalReviewHeader("ShipReady social preview", {
      target: report.url,
      mode: `${report.mode}; source ${report.sourceMode}`,
      status: formatStatus(report.verdict.status),
      next: report.nextActions[0],
    }),
    "",
    "Top findings",
    `  ${report.verdict.status}: ${report.verdict.summary}`,
    ...warningLines(report.warnings),
    "",
    ...surfaceLines(report.previews.google_search),
    "",
    ...surfaceLines(report.previews.generic_social),
    "",
    ...surfaceLines(report.previews.x_twitter),
    "",
    ...surfaceLines(report.previews.slack_discord),
    "",
    ...surfaceLines(report.previews.linkedin),
    "",
    "Raw vs rendered differences",
    ...differenceLines(report),
    "",
    "Safety",
    "  - Approximation from observed metadata. Platforms may differ.",
    "  - No social platform APIs, screenshots, image generation, deployment, or writes are used.",
    "",
    "Limitations",
    ...report.limitations.map((item) => `  - ${item}`),
    "",
    "Next actions",
    ...report.nextActions.map((item) => `  - ${item}`),
    "",
    formatJsonMoreLine(),
    "",
  ];

  return lines.join("\n");
}

function warningLines(warnings: string[]): string[] {
  if (warnings.length === 0) return ["  - No preview warnings in the selected source mode."];
  return warnings.slice(0, 5).map((warning) => `  - ${warning}`);
}

function surfaceLines(surface: Surface): string[] {
  const fields = surface.fields;
  return [
    surface.label,
    `  Title: ${formatField(fields.title)}`,
    `  Description: ${formatField(fields.description)}`,
    `  URL: ${formatField(fields.url)}`,
    ...(fields.cardType ? [`  Card type: ${formatField(fields.cardType)}`] : []),
    ...(fields.image ? [`  Image: ${formatField(fields.image)} (${fields.image.assetStatus})`] : []),
    "  Warnings:",
    ...(surface.warnings.length > 0
      ? surface.warnings.map((warning) => `    - ${warning}`)
      : ["    - none"]),
  ];
}

function formatField(field: Surface["fields"]["title"]): string {
  const value = field.value ? truncate(field.value) : "missing";
  const source = field.sourceField ? `; ${field.sourceField} from ${field.source}` : "";
  return `${value} [${field.status}${source}]`;
}

function differenceLines(report: SocialPreviewJsonContract): string[] {
  const differences = report.comparison.rawVsRendered.filter((field) =>
    field.status === "changed_after_render" || field.status === "present_after_render_only");
  if (differences.length === 0) return ["  - none observed"];
  return differences.map((field) => {
    const raw = field.rawValue ? truncate(field.rawValue) : "missing";
    const rendered = field.renderedValue ? truncate(field.renderedValue) : "missing";
    return `  - ${field.field}: ${field.status}; raw=${raw}; rendered=${rendered}`;
  });
}

function truncate(value: string, maxLength = 96): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
}

function formatStatus(status: SocialPreviewJsonContract["verdict"]["status"]): TerminalReviewStatus {
  if (status === "ready") return "Ready";
  if (status === "needs_attention") return "Needs attention";
  return "Unknown";
}
