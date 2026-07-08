import type { AuditCheck, AuditResult } from "../types/audit";
import {
  formatCountSummary,
  formatJsonMoreLine,
  formatTerminalReviewHeader,
  truncateTerminalValue,
  type TerminalReviewStatus,
} from "./terminalReview";

export function formatHumanReport(result: AuditResult): string {
  const critical = result.checks.filter((check) => check.severity === "critical");
  const warnings = result.checks.filter((check) => check.severity === "warning");
  const info = result.checks.filter((check) => check.severity === "info");
  const passed = result.checks.filter((check) => check.severity === "passed");
  const nextAction = formatRecommendedNextAction(critical, warnings, info);

  const lines: string[] = [
    ...formatTerminalReviewHeader("ShipReady audit", {
      target: result.url,
      status: formatReviewStatus(result.status),
      next: nextAction,
    }),
    `Score: ${result.score}/100`,
  ];

  if (result.finalUrl !== result.url) {
    lines.push(`Final URL: ${result.finalUrl}`);
  }

  lines.push("", "Top findings", ...formatTopFindings(critical, warnings, info));
  lines.push("", "Evidence");
  lines.push(`- Critical issues: ${critical.length}`);
  lines.push(`- Warnings: ${warnings.length}`);
  lines.push(`- Notes: ${info.length}`);
  lines.push("", "Critical", ...formatChecks(critical, 5));
  lines.push("", "Warnings", ...formatChecks(warnings, 6));
  lines.push("", "Notes", ...formatChecks(info, 4));
  lines.push("", "Passed checks", ...formatPassedChecks(passed));
  lines.push("", "Raw vs rendered", ...formatRawRendered(result));
  lines.push(
    "",
    "Safety",
    "- Read-only single-page audit. No files were modified.",
    "- This is not a full-site crawl, Search Console proof, DNS proof, deployment proof, indexing guarantee, or ranking claim.",
    "",
    formatJsonMoreLine(),
  );

  return `${lines.join("\n")}\n`;
}

function formatTopFindings(
  critical: AuditCheck[],
  warnings: AuditCheck[],
  info: AuditCheck[],
): string[] {
  const top = [...critical, ...warnings, ...info].slice(0, 5);
  if (top.length === 0) {
    return ["- No metadata or crawlability findings need attention."];
  }

  const hidden = critical.length + warnings.length + info.length - top.length;
  return [
    ...top.map((check) => `- ${formatSeverity(check)}: ${check.title}${evidenceSuffix(check)}`),
    ...(hidden > 0 ? [`- ${hidden} additional finding(s) hidden from this summary.`] : []),
  ];
}

function formatChecks(checks: AuditCheck[], maxVisible: number): string[] {
  if (checks.length === 0) {
    return ["- None"];
  }

  const visible = checks.slice(0, maxVisible).map((check) => {
    const suffix = evidenceSuffix(check);
    return `- ${check.title}${suffix}`;
  });

  if (checks.length > maxVisible) {
    visible.push(`- ${checks.length - maxVisible} more not shown in the human summary.`);
  }

  return visible;
}

function formatPassedChecks(checks: AuditCheck[]): string[] {
  if (checks.length === 0) {
    return ["- None"];
  }

  const visible = checks.slice(0, 5).map((check) => `- ${check.title}`);
  return [
    `- ${formatCountSummary(checks.length, "passed", 5)}`,
    ...visible,
    ...(checks.length > 5 ? ["- Remaining passed checks are available with --json."] : []),
  ];
}

function evidenceSuffix(check: AuditCheck): string {
  if (check.id === "structure.h1.multiple" && Array.isArray(check.evidence?.h1)) {
    return `: ${check.evidence.h1.map((value) => JSON.stringify(truncateTerminalValue(value))).join(", ")}`;
  }

  if (check.id === "crawl.raw_render.metadata_render_only" && Array.isArray(check.evidence?.fields)) {
    return `: ${check.evidence.fields.join(", ")}`;
  }

  return "";
}

function formatRawRendered(result: AuditResult): string[] {
  const fields = [
    "title",
    "description",
    "canonical",
    "robots",
    "viewport",
    "theme-color",
    "favicon",
    "og:image",
    "twitter:image",
  ];

  return fields.map((field) => {
    const comparison = result.comparison.fields.find((item) => item.field === field);
    if (!comparison || comparison.status === "missing_in_both") {
      return `- ${formatFieldLabel(field)}: not set in raw or rendered HTML`;
    }

    const rawValue = comparison.rawValue ? truncateTerminalValue(comparison.rawValue) : "missing";
    const renderedValue = comparison.renderedValue ? truncateTerminalValue(comparison.renderedValue) : "missing";
    if (rawValue === renderedValue) {
      return `- ${formatFieldLabel(field)}: raw/rendered=${rawValue}`;
    }
    return `- ${formatFieldLabel(field)}: raw=${rawValue}; rendered=${renderedValue}`;
  });
}

function formatFieldLabel(field: string): string {
  if (field === "robots") return "robots meta";
  return field;
}

function formatRecommendedNextAction(
  critical: AuditCheck[],
  warnings: AuditCheck[],
  info: AuditCheck[],
): string {
  if (critical.length > 0) {
    return "Fix the critical production-readiness issues first, then rerun the audit.";
  }

  if (warnings.length > 0) {
    return "Review the warnings and prioritize the ones that affect crawlability, share-preview readiness, or metadata completeness.";
  }

  if (info.length > 0) {
    return "No launch-blocking metadata or crawlability issues were detected. Review the notes only if you want extra polish.";
  }

  return "No immediate metadata or crawlability action is needed. Keep this report as a baseline and rerun before launch.";
}

function formatReviewStatus(status: AuditResult["status"]): TerminalReviewStatus {
  if (status === "good") return "Ready";
  if (status === "needs_work") return "Needs attention";
  return "Needs attention";
}

function formatSeverity(check: AuditCheck): string {
  if (check.severity === "critical") return "critical";
  if (check.severity === "warning") return "warning";
  if (check.severity === "info") return "note";
  return "passed";
}
