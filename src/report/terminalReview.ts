export type TerminalReviewStatus = "Ready" | "Needs attention" | "Manual review" | "Unknown";

export type TerminalReviewHeaderInput = {
  target?: string;
  repo?: string;
  mode?: string;
  status: TerminalReviewStatus;
  next: string;
};

export function formatTerminalReviewHeader(
  title: string,
  input: TerminalReviewHeaderInput,
): string[] {
  return [
    title,
    ...(input.target ? [`Target: ${input.target}`] : []),
    ...(input.repo ? [`Repo: ${input.repo}`] : []),
    ...(input.mode ? [`Mode: ${input.mode}`] : []),
    `Status: ${input.status}`,
    `Next: ${input.next}`,
  ];
}

export function formatJsonMoreLine(): string {
  return "More: Run with --json for full contract output.";
}

export function truncateTerminalValue(value: string, maxLength = 88): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
}

export function formatCountSummary(
  total: number,
  noun: string,
  shown: number,
): string {
  if (total === 0) return `0 ${noun}`;
  if (total <= shown) return `${total} ${noun}`;
  return `${total} ${noun}; showing top ${shown}`;
}

export function listOrNone(values: string[], empty = "- None"): string[] {
  return values.length === 0 ? [empty] : values;
}
