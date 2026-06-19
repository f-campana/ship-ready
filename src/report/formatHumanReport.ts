import type { AuditCheck, AuditResult } from "../types/audit";

export function formatHumanReport(result: AuditResult): string {
  const critical = result.checks.filter((check) => check.severity === "critical");
  const warnings = result.checks.filter((check) => check.severity === "warning");
  const info = result.checks.filter((check) => check.severity === "info");
  const passed = result.checks.filter((check) => check.severity === "passed");

  const lines: string[] = [
    `ShipReady audit: ${result.url}`,
    "",
    `Score: ${result.score}/100`,
    `Status: ${formatStatus(result.status)}`,
  ];

  if (result.finalUrl !== result.url) {
    lines.push(`Final URL: ${result.finalUrl}`);
  }

  lines.push("", "Critical", ...formatChecks(critical));
  lines.push("", "Warnings", ...formatChecks(warnings));
  lines.push("", "Notes", ...formatChecks(info));
  lines.push("", "Passed", ...formatChecks(passed));
  lines.push("", "Raw vs rendered", ...formatRawRendered(result));
  lines.push("", "Recommended next action", formatRecommendedNextAction(critical, warnings, info));

  return `${lines.join("\n")}\n`;
}

function formatChecks(checks: AuditCheck[]): string[] {
  if (checks.length === 0) {
    return ["- None"];
  }

  return checks.map((check) => {
    const suffix = evidenceSuffix(check);
    return `- ${check.title}${suffix}`;
  });
}

function evidenceSuffix(check: AuditCheck): string {
  if (check.id === "structure.h1.multiple" && Array.isArray(check.evidence?.h1)) {
    return `: ${check.evidence.h1.map((value) => JSON.stringify(value)).join(", ")}`;
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

    const rawValue = comparison.rawValue ?? "missing";
    const renderedValue = comparison.renderedValue ?? "missing";
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

function formatStatus(status: AuditResult["status"]): string {
  if (status === "good") return "Good";
  if (status === "needs_work") return "Needs work";
  return "Critical";
}
