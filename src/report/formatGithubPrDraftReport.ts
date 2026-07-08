import {
  CONTRACT_NAMES,
  GithubPrDraftJsonContractSchema,
  type GithubPrDraftJsonContract,
} from "../types/contracts";
import { formatGithubPrDraftMarkdown } from "../githubPrDraft/githubPrDraft";

export function formatGithubPrDraftJsonReport(result: GithubPrDraftJsonContract): string {
  const contract = GithubPrDraftJsonContractSchema.parse({
    ...result,
    contract: CONTRACT_NAMES.githubPrDraft,
  });
  return `${JSON.stringify(contract, null, 2)}\n`;
}

export function formatGithubPrDraftHumanReport(result: GithubPrDraftJsonContract): string {
  return formatGithubPrDraftMarkdown(result);
}
