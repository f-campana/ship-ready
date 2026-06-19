import {
  UiReportSchema,
  type UiActionGroups,
  type UiFixAction,
  type UiIssue,
  type UiPatchPreviewSummary,
  type UiPreviewCards,
  type UiPreviewSource,
  type UiProjectSummary,
  type UiReadiness,
  type UiReport,
  type UiSafeApplySummary,
} from "../types/uiReport";

const RENDERED_FALLBACK_WARNING =
  "Some page information appears only after the app loads. Some preview bots may not see it.";
const NEEDS_ATTENTION_PASSED_LIMIT = 3;
const READY_PASSED_LIMIT = 6;
const TRUST_GUARANTEES = [
  "No overwrites",
  "No metadata or content edits",
  "No Git commits",
  "No deploys",
];

export function renderHtmlReport(report: UiReport): string {
  const parsed = UiReportSchema.parse(report);
  const title = `ShipReady report - ${parsed.input.url}`;

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${REPORT_CSS}</style>`,
    "</head>",
    "<body>",
    '<main class="shell">',
    renderHeader(parsed),
    renderReadinessOverview(parsed),
    renderPreviewCards(parsed.previews),
    renderProjectUnderstanding(parsed.input.repoPath, parsed.project, parsed.readiness, parsed.safeApply),
    renderFixPlan(parsed.actionGroups, parsed.input.mode),
    renderPatchPreview(parsed.patchPreview),
    renderSafeApply(parsed),
    renderLocalVsLive(parsed),
    renderDeveloperDetails(parsed),
    "</main>",
    "</body>",
    "</html>",
  ].join("\n");
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHeader(report: UiReport): string {
  const nextAction = nextActionCopy(report);
  const safeApplyStatus = safeApplyStatusCopy(report);

  return `
<header class="hero ${readinessClass(report.readiness.label)}-hero">
  <div class="hero-topline">
    <span class="eyebrow">ShipReady report</span>
    <span class="badge ${readinessClass(report.readiness.label)}">${escapeHtml(readinessLabel(report.readiness.label))}</span>
  </div>
  <div class="hero-grid">
    <div class="hero-main">
      <p class="audited-url wrap-safe">${escapeHtml(report.input.url)}</p>
      <h1>${escapeHtml(report.readiness.title)}</h1>
      <p class="lede">${escapeHtml(report.readiness.summary)}</p>
    </div>
    <aside class="decision-panel">
      <p class="decision-label">Next best action</p>
      <h2>${escapeHtml(nextAction.title)}</h2>
      <p>${escapeHtml(nextAction.description)}</p>
    </aside>
  </div>
  <dl class="decision-metrics">
    <div>
      <dt>Issue review</dt>
      <dd>${escapeHtml(issueReviewLabel(report.readiness))}</dd>
    </div>
    <div>
      <dt>Safe apply</dt>
      <dd><span class="badge ${safeApplyStatus.badgeClass}">${escapeHtml(safeApplyStatus.label)}</span></dd>
    </div>
    <div>
      <dt>Mode</dt>
      <dd>${escapeHtml(report.input.mode === "url_and_repo" ? "URL + repository" : "URL only")}</dd>
    </div>
    ${typeof report.readiness.score === "number" ? `
    <div>
      <dt>Score</dt>
      <dd>${escapeHtml(report.readiness.score)} / 100</dd>
    </div>` : ""}
  </dl>
  <details class="context-details">
    <summary>Audit context</summary>
    <dl class="meta-grid ${report.input.repoPath ? "has-repo" : "url-only"}">
      <div>
        <dt>Audited URL</dt>
        <dd class="wrap-safe">${escapeHtml(report.input.url)}</dd>
      </div>
      ${report.input.repoPath ? `
      <div>
        <dt>Repository</dt>
        <dd class="wrap-safe">${escapeHtml(report.input.repoPath)}</dd>
      </div>` : ""}
      <div>
        <dt>Generated</dt>
        <dd><time datetime="${escapeHtml(report.generatedAt)}">${escapeHtml(report.generatedAt)}</time></dd>
      </div>
      <div>
        <dt>Mode</dt>
        <dd>${escapeHtml(report.input.mode === "url_and_repo" ? "URL + repository" : "URL only")}</dd>
      </div>
    </dl>
  </details>
</header>`;
}

function renderReadinessOverview(report: UiReport): string {
  const readiness = report.readiness;
  const isReady = readiness.label === "ready";

  return `
<section class="section">
  <div class="section-heading">
    <p class="eyebrow">Readiness overview</p>
    <h2>${escapeHtml(isReady ? "Ready summary" : "What matters most")}</h2>
    <p>${escapeHtml(readiness.summary)}</p>
  </div>
  ${renderErrors(report.errors)}
  ${isReady ? renderReadyOverview(readiness) : renderNeedsAttentionOverview(report)}
</section>`;
}

function renderNeedsAttentionOverview(report: UiReport): string {
  const safeApply = safeApplyStatusCopy(report);

  return `
  <div class="overview-layout">
    <section class="overview-main">
      <div class="subsection-heading">
        <h3>Top issues</h3>
        <span class="summary-count">${escapeHtml(issueCountLabel(report.readiness.topIssues.length))}</span>
      </div>
      ${renderIssueCards(report.readiness.topIssues, "No top issues found.")}
    </section>
    <aside class="overview-side">
      <article class="card decision-card">
        <p class="decision-label">Safe apply</p>
        <h3>${escapeHtml(safeApply.title)}</h3>
        <p>${escapeHtml(safeApply.description)}</p>
      </article>
      <article class="card decision-card">
        <p class="decision-label">Next best action</p>
        <h3>${escapeHtml(nextActionCopy(report).title)}</h3>
        <p>${escapeHtml(nextActionCopy(report).description)}</p>
      </article>
    </aside>
  </div>
  ${renderPassedHighlights(report.readiness.passedHighlights, NEEDS_ATTENTION_PASSED_LIMIT)}
  ${renderIssueDetails("Optional polish", report.readiness.optionalPolish, "No optional polish items found.")}`;
}

function renderReadyOverview(readiness: UiReadiness): string {
  return `
  <div class="ready-overview">
    ${readiness.topIssues.length > 0 ? renderIssueList("Top issues", readiness.topIssues, "No top issues found.") : ""}
    ${renderPassedHighlights(readiness.passedHighlights, READY_PASSED_LIMIT)}
    ${renderIssueDetails("Optional polish", readiness.optionalPolish, "No optional polish items found.")}
  </div>`;
}

function renderErrors(errors: UiReport["errors"]): string {
  if (errors.length === 0) return "";

  return `
  <div class="notice warning">
    <strong>Report issues</strong>
    <ul>
      ${errors.map((error) => `<li>${escapeHtml(error.title)}: ${escapeHtml(error.message)}</li>`).join("")}
    </ul>
  </div>`;
}

function renderPreviewCards(previews: UiPreviewCards): string {
  const usesRenderedFallback =
    previews.google.source === "rendered" ||
    previews.social.source === "rendered" ||
    previews.twitter.source === "rendered" ||
    previews.crawlerView.renderOnlyWarnings.length > 0;

  return `
<section class="section">
  <div class="section-heading">
    <p class="eyebrow">Preview cards</p>
    <h2>How the page appears to crawlers and preview bots</h2>
  </div>
  ${usesRenderedFallback ? `<div class="notice">${escapeHtml(RENDERED_FALLBACK_WARNING)}</div>` : ""}
  <div class="preview-grid">
    ${renderPreviewCard("Google preview", [
      ["Title", previews.google.title],
      ["URL", previews.google.url],
      ["Description", previews.google.description],
    ], previews.google.missingFields, previews.google.source)}
    ${renderPreviewCard("Social preview", [
      ["Title", previews.social.title],
      ["URL", previews.social.url],
      ["Description", previews.social.description],
      ["Image URL", previews.social.image],
    ], previews.social.missingFields, previews.social.source)}
    ${renderPreviewCard("X/Twitter preview", [
      ["Card", previews.twitter.card],
      ["Title", previews.twitter.title],
      ["Description", previews.twitter.description],
      ["Image URL", previews.twitter.image],
    ], previews.twitter.missingFields, previews.twitter.source)}
    <article class="card preview-card crawler-card">
      <div class="card-title-row">
        <h3>Crawler view</h3>
        <span class="badge subtle source-badge">Raw vs rendered</span>
      </div>
      <div class="crawler-snapshot">
        <div>
          <p class="field-label">Raw HTML</p>
          <p>${escapeHtml(previews.crawlerView.rawHtmlSummary)}</p>
        </div>
        <div>
          <p class="field-label">Rendered HTML</p>
          <p>${escapeHtml(previews.crawlerView.renderedHtmlSummary)}</p>
        </div>
      </div>
      ${previews.crawlerView.renderOnlyWarnings.length > 0 ? `
        <p class="field-label">Warnings</p>
        <ul class="compact-list">
          ${previews.crawlerView.renderOnlyWarnings.map((issue) => `<li>${escapeHtml(issue.title)}</li>`).join("")}
        </ul>` : ""}
    </article>
  </div>
</section>`;
}

function renderPreviewCard(
  heading: string,
  fields: Array<[label: string, value?: string]>,
  missingFields: string[],
  source: UiPreviewSource,
): string {
  return `
<article class="card preview-card">
  <div class="card-title-row">
    <h3>${escapeHtml(heading)}</h3>
    <span class="badge ${sourceClass(source)} source-badge">${escapeHtml(sourceLabel(source))}</span>
  </div>
  ${fields.map(([label, value]) => renderField(label, value)).join("")}
  ${missingFields.length > 0 ? `
    <div class="missing-fields">
      <span class="field-label">Missing</span>
      <div class="badge-row">
        ${missingFields.map((field) => `<span class="badge muted missing-chip">${escapeHtml(field)}</span>`).join("")}
      </div>
    </div>` : ""}
</article>`;
}

function renderProjectUnderstanding(
  repoPath: string | undefined,
  project: UiProjectSummary | undefined,
  readiness: UiReadiness,
  safeApply: UiSafeApplySummary | undefined,
): string {
  if (!repoPath) return "";

  if (!project) {
    return `
<section class="section">
  <div class="section-heading">
    <p class="eyebrow">Project understanding</p>
    <h2>Project inspection was not available</h2>
    <p>ShipReady could not build a local project summary for this report.</p>
  </div>
</section>`;
  }

  const projectCopy = projectUnderstandingCopy(project, readiness, safeApply);

  return `
<section class="section">
  <div class="section-heading">
    <p class="eyebrow">Project understanding</p>
    <h2>${escapeHtml(projectCopy.title)}</h2>
    <p>${escapeHtml(projectCopy.description)}</p>
  </div>
  <div class="project-summary">
    <div class="project-fact">
      <p class="field-label">Confidence</p>
      <span class="badge ${project.detected ? "positive" : "caution"}">${escapeHtml(confidenceLabel(project.confidenceLabel))}</span>
    </div>
    <div class="project-fact">
      <p class="field-label">Useful project files</p>
      ${renderLimitedStringList(project.importantFiles, "No important files were detected.", 6)}
    </div>
    <div class="project-fact">
      <p class="field-label">What ShipReady recognizes</p>
      ${renderLimitedStringList(project.supportedFixes, "No supported fixes are available for this project yet.", 5)}
    </div>
    <div class="project-fact">
      <p class="field-label">Current limits</p>
      ${renderLimitedStringList(project.limitations, "No limitations reported.", 4)}
    </div>
  </div>
</section>`;
}

function renderFixPlan(actionGroups: UiActionGroups | undefined, mode: UiReport["input"]["mode"]): string {
  if (!actionGroups) {
    const message =
      mode === "url_only"
        ? "No local fix plan is available in URL-only mode. Add a project folder to preview file-level changes."
        : "No local fix plan is available for this report.";
    return `
<section class="section">
  <div class="section-heading">
    <p class="eyebrow">Fix plan</p>
    <h2>Grouped actions</h2>
    <p>${escapeHtml(message)}</p>
  </div>
</section>`;
  }

  return `
<section class="section">
  <div class="section-heading">
    <p class="eyebrow">Fix plan</p>
    <h2>Grouped actions</h2>
  </div>
  <div class="action-groups">
    ${renderActionGroup("Safe to apply", actionGroups.safeToApply, "No safe automatic changes.")}
    ${renderActionGroup("Needs review", actionGroups.needsReview, "No generated changes need review.")}
    ${renderActionGroup("Manual only", actionGroups.manualOnly, "No manual-only actions.")}
    ${renderIssueGroup("Already good", actionGroups.alreadyGood, "No passed checks available.", true)}
    ${renderIssueGroup("Optional polish", actionGroups.optionalPolish, "No optional polish actions.", true)}
  </div>
</section>`;
}

function renderActionGroup(title: string, actions: UiFixAction[], emptyText: string): string {
  return `
<section class="action-group">
  <div class="subsection-heading">
    <h3>${escapeHtml(title)}</h3>
    <span class="summary-count">${escapeHtml(issueCountLabel(actions.length))}</span>
  </div>
  ${actions.length === 0 ? `<p class="empty">${escapeHtml(emptyText)}</p>` : actions.map(renderFixAction).join("")}
</section>`;
}

function renderIssueGroup(title: string, issues: UiIssue[], emptyText: string, collapsed = false): string {
  if (collapsed) {
    return `
<details class="action-group quiet-group">
  <summary>
    <span>${escapeHtml(title)}</span>
    <span class="summary-count">${escapeHtml(issueCountLabel(issues.length))}</span>
  </summary>
  <div class="quiet-group-content">
    ${issues.length === 0 ? `<p class="empty">${escapeHtml(emptyText)}</p>` : renderCompactIssueRows(issues)}
  </div>
</details>`;
  }

  return `
<section class="action-group">
  <h3>${escapeHtml(title)}</h3>
  ${issues.length === 0 ? `<p class="empty">${escapeHtml(emptyText)}</p>` : issues.map(renderIssueCard).join("")}
</section>`;
}

function renderFixAction(action: UiFixAction): string {
  return `
<article class="card action-card">
  <div class="card-title-row">
    <h4>${escapeHtml(action.title)}</h4>
    <span class="badge ${safetyClass(action.safety)}">${escapeHtml(safetyLabel(action.safety))}</span>
  </div>
  <p class="action-explanation">${escapeHtml(action.explanation)}</p>
  <div class="action-facts">
    ${action.targetLabel ? renderFact("Target file", action.targetLabel) : ""}
    ${renderFact("Can ShipReady apply it?", action.canApplyInV1 ? "Yes, with safe apply" : "Needs review first")}
    ${action.reviewReason ? renderFact("Review note", action.reviewReason) : ""}
  </div>
</article>`;
}

function renderPatchPreview(patchPreview: UiPatchPreviewSummary | undefined): string {
  if (!patchPreview || !patchPreview.hasPreview) {
    return `
<section class="section">
  <div class="section-heading">
    <p class="eyebrow">Patch preview</p>
    <h2>No patch preview</h2>
    <p>No file changes were generated for this report.</p>
  </div>
</section>`;
  }

  return `
<section class="section">
  <div class="section-heading">
    <p class="eyebrow">Patch preview</p>
    <h2>Files ShipReady would create or update</h2>
    <p>Review the file list first. Diffs stay collapsed until a developer needs them.</p>
  </div>
  ${renderPatchFileSummary(patchPreview.fileChanges)}
  <div class="patch-list">
    ${patchPreview.fileChanges.map(renderFileChange).join("")}
  </div>
  ${patchPreview.skippedActions.length > 0 ? `
    <details class="secondary-details skipped-actions">
      <summary>
        <span>Actions without a file diff</span>
        <span class="summary-count">${escapeHtml(issueCountLabel(patchPreview.skippedActions.length))}</span>
      </summary>
      <div class="quiet-group-content">
        ${patchPreview.skippedActions.map((action) => `
          <article class="quiet-card">
            <h4>${escapeHtml(action.title)}</h4>
            <p>${escapeHtml(action.reason)}</p>
          </article>`).join("")}
      </div>
    </details>` : ""}
</section>`;
}

function renderFileChange(change: UiPatchPreviewSummary["fileChanges"][number]): string {
  const writeLabel = change.eligibleForWrite ? wouldChangeLabel(change.changeType) : "Blocked from safe apply";

  return `
<article class="card patch-card">
  <div class="card-title-row">
    <h3 class="wrap-safe">${escapeHtml(change.path)}</h3>
    <span class="badge ${change.eligibleForWrite ? "positive" : "caution"}">${escapeHtml(writeLabel)}</span>
  </div>
  <div class="patch-meta-row">
    <span>${escapeHtml(wouldChangeLabel(change.changeType))}</span>
    <span>Risk: ${escapeHtml(change.risk)}</span>
    <span>Review: ${escapeHtml(reviewStatusLabel(change.reviewStatus))}</span>
  </div>
  ${renderFact("Path", change.path)}
  ${change.writeBlockReason ? renderKeyValue("Blocked reason", change.writeBlockReason) : ""}
  <details class="diff-details">
    <summary>View diff</summary>
    <pre>${escapeHtml(change.diff ?? "No diff was produced for this file change.")}</pre>
  </details>
</article>`;
}

function renderSafeApply(report: UiReport): string {
  const safeApply = report.safeApply;
  const repoPath = report.input.repoPath;
  const url = report.input.url;

  if (!safeApply?.available) {
    const heading = safeApplyUnavailableHeading(report);
    const explanation = safeApplyUnavailableExplanation(report);

    return `
<section class="section">
  <div class="section-heading">
    <p class="eyebrow">Safe apply</p>
    <h2>${escapeHtml(heading)}</h2>
    <p>${escapeHtml(explanation)}</p>
  </div>
  ${renderTrustGuarantees()}
  ${safeApply?.blockedFiles.length ? renderBlockedFiles(safeApply.blockedFiles) : ""}
</section>`;
  }

  const command = `pnpm shipready fix ${formatCommandArg(repoPath ?? ".")} --url ${formatCommandArg(url)} --write --allow-create`;

  return `
<section class="section">
  <div class="section-heading">
    <p class="eyebrow">Safe apply</p>
    <h2>Safe automatic fix available</h2>
    <p>ShipReady can create these missing crawl files without overwriting existing files:</p>
  </div>
  ${renderFileChipList(safeApply.eligibleFiles, "No eligible files.")}
  <div class="notice">
    <p>Run this command when you are ready to apply only the safe file creations:</p>
    <pre class="command">${escapeHtml(command)}</pre>
  </div>
  ${renderTrustGuarantees()}
  ${safeApply.blockedFiles.length ? renderBlockedFiles(safeApply.blockedFiles) : ""}
  <details class="secondary-details">
    <summary>Safe apply policy notes</summary>
    ${renderStringList(safeApply.safetyNotes, "No additional safety notes.")}
  </details>
</section>`;
}

function renderBlockedFiles(blockedFiles: UiSafeApplySummary["blockedFiles"]): string {
  return `
<div class="blocked-files">
  <div class="subsection-heading">
    <h3>Blocked from safe apply</h3>
    <span class="summary-count">${escapeHtml(issueCountLabel(blockedFiles.length))}</span>
  </div>
  ${blockedFiles.map((file) => `
    <article class="card quiet-card">
      <h4 class="wrap-safe">${escapeHtml(file.path)}</h4>
      <p>${escapeHtml(file.reason)}</p>
    </article>`).join("")}
</div>`;
}

function renderLocalVsLive(report: UiReport): string {
  if (!report.input.repoPath) return "";

  return `
<section class="section">
  <div class="notice deploy">
    <strong>Local changes do not affect the live website until you deploy.</strong>
    <p>${escapeHtml(report.liveVsLocal.message)}</p>
  </div>
</section>`;
}

function renderDeveloperDetails(report: UiReport): string {
  return `
<section class="section">
  <details class="developer-details">
    <summary>Developer details</summary>
    <p><strong>Schema version:</strong> ${escapeHtml(report.schemaVersion)}</p>
    <h3>Raw JSON report</h3>
    <pre>${escapeHtml(JSON.stringify(report, null, 2))}</pre>
    <h3>Raw developer details</h3>
    <pre>${escapeHtml(JSON.stringify(report.developerDetails, null, 2))}</pre>
  </details>
</section>`;
}

function renderIssueList(title: string, issues: UiIssue[], emptyText: string, limit = 5): string {
  const visible = issues.slice(0, limit);
  const remaining = issues.length - visible.length;

  return `
<section class="issue-column">
  <div class="subsection-heading">
    <h3>${escapeHtml(title)}</h3>
    <span class="summary-count">${escapeHtml(issueCountLabel(issues.length))}</span>
  </div>
  ${visible.length === 0 ? `<p class="empty">${escapeHtml(emptyText)}</p>` : visible.map(renderIssueCard).join("")}
  ${remaining > 0 ? `<p class="more-count">+ ${escapeHtml(remaining)} more</p>` : ""}
</section>`;
}

function renderIssueCards(issues: UiIssue[], emptyText: string, limit = 5): string {
  const visible = issues.slice(0, limit);
  const remaining = issues.length - visible.length;

  if (visible.length === 0) {
    return `<p class="empty">${escapeHtml(emptyText)}</p>`;
  }

  return `
  <div class="issue-card-stack">
    ${visible.map(renderIssueCard).join("")}
  </div>
  ${remaining > 0 ? `<p class="more-count">+ ${escapeHtml(remaining)} more</p>` : ""}`;
}

function renderPassedHighlights(issues: UiIssue[], visibleLimit: number): string {
  const visible = issues.slice(0, visibleLimit);
  const remaining = issues.slice(visible.length);

  return `
  <section class="passed-highlights">
    <div class="subsection-heading">
      <h3>Passed highlights</h3>
      <span class="summary-count">${escapeHtml(issueCountLabel(issues.length))}</span>
    </div>
    ${visible.length === 0 ? `<p class="empty">No passed highlights available.</p>` : `
      <div class="highlight-grid">
        ${visible.map(renderMiniIssueCard).join("")}
      </div>`}
    ${remaining.length > 0 ? `
      <details class="secondary-details issue-details">
        <summary>
          <span>View remaining passed checks</span>
          <span class="summary-count">${escapeHtml(issueCountLabel(remaining.length))}</span>
        </summary>
        <div class="quiet-group-content">
          ${renderCompactIssueRows(remaining)}
        </div>
      </details>` : ""}
  </section>`;
}

function renderIssueDetails(title: string, issues: UiIssue[], emptyText: string): string {
  return `
  <details class="secondary-details issue-details">
    <summary>
      <span>${escapeHtml(title)}</span>
      <span class="summary-count">${escapeHtml(issueCountLabel(issues.length))}</span>
    </summary>
    <div class="quiet-group-content">
      ${issues.length === 0 ? `<p class="empty">${escapeHtml(emptyText)}</p>` : renderCompactIssueRows(issues)}
    </div>
  </details>`;
}

function renderIssueCard(issue: UiIssue): string {
  return `
<article class="card issue-card">
  <div class="card-title-row">
    <h4>${escapeHtml(issue.title)}</h4>
    <span class="badge ${issueSeverityClass(issue.userSeverity)}">${escapeHtml(issueSeverityLabel(issue.userSeverity))}</span>
  </div>
  <p>${escapeHtml(issue.explanation)}</p>
  <p class="muted-text">${escapeHtml(issue.whyItMatters)}</p>
</article>`;
}

function renderMiniIssueCard(issue: UiIssue): string {
  return `
<article class="mini-issue-card">
  <span class="badge ${issueSeverityClass(issue.userSeverity)}">${escapeHtml(issueSeverityLabel(issue.userSeverity))}</span>
  <strong>${escapeHtml(issue.title)}</strong>
  <p>${escapeHtml(issue.explanation)}</p>
</article>`;
}

function renderField(label: string, value?: string): string {
  return `
<div class="field">
  <p class="field-label">${escapeHtml(label)}</p>
  <p class="wrap-safe">${value ? escapeHtml(value) : '<span class="missing-chip">Missing</span>'}</p>
</div>`;
}

function renderKeyValue(label: string, value: string): string {
  return `
<p class="key-value"><span>${escapeHtml(label)}:</span> <span class="wrap-safe">${escapeHtml(value)}</span></p>`;
}

function renderFact(label: string, value: string): string {
  return `
<div class="fact">
  <span>${escapeHtml(label)}</span>
  <strong class="wrap-safe">${escapeHtml(value)}</strong>
</div>`;
}

function renderStringList(items: string[], emptyText: string): string {
  if (items.length === 0) {
    return `<p class="empty">${escapeHtml(emptyText)}</p>`;
  }

  return `
<ul class="compact-list">
  ${items.map((item) => `<li class="wrap-safe">${escapeHtml(item)}</li>`).join("")}
</ul>`;
}

function renderLimitedStringList(items: string[], emptyText: string, visibleLimit: number): string {
  const visible = items.slice(0, visibleLimit);
  const remaining = items.slice(visible.length);

  if (visible.length === 0) {
    return `<p class="empty">${escapeHtml(emptyText)}</p>`;
  }

  return `
${renderStringList(visible, emptyText)}
${remaining.length > 0 ? `
<details class="inline-details">
  <summary>View ${escapeHtml(issueCountLabel(remaining.length))}</summary>
  ${renderStringList(remaining, emptyText)}
</details>` : ""}`;
}

function renderFileChipList(items: string[], emptyText: string): string {
  if (items.length === 0) {
    return `<p class="empty">${escapeHtml(emptyText)}</p>`;
  }

  return `
<ul class="file-chip-list">
  ${items.map((item) => `<li class="wrap-safe">${escapeHtml(item)}</li>`).join("")}
</ul>`;
}

function renderTrustGuarantees(): string {
  return `
<ul class="trust-row">
  ${TRUST_GUARANTEES.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
</ul>`;
}

function renderPatchFileSummary(fileChanges: UiPatchPreviewSummary["fileChanges"]): string {
  if (fileChanges.length === 0) {
    return "";
  }

  return `
<div class="file-summary-list">
  ${fileChanges.map((change) => `
    <div class="file-summary-row">
      <span class="badge ${change.eligibleForWrite ? "positive" : "caution"}">${escapeHtml(change.eligibleForWrite ? wouldChangeLabel(change.changeType) : "Blocked from safe apply")}</span>
      <strong class="wrap-safe">${escapeHtml(change.path)}</strong>
      <span>${escapeHtml(change.eligibleForWrite ? "Can be applied safely" : "Needs human review")}</span>
    </div>`).join("")}
</div>`;
}

function renderCompactIssueRows(issues: UiIssue[]): string {
  return `
<ul class="quiet-list">
  ${issues.map((issue) => `
    <li>
      <strong>${escapeHtml(issue.title)}</strong>
      <span class="wrap-safe">${escapeHtml(issue.explanation)}</span>
    </li>`).join("")}
</ul>`;
}

function issueCountLabel(count: number): string {
  if (count === 1) return "1 item";
  return `${count} items`;
}

function issueReviewLabel(readiness: UiReadiness): string {
  if (readiness.label === "ready") {
    return "No launch-blocking issues";
  }

  const summaryCount = readiness.summary.match(/^(\d+)\s+/)?.[1];
  if (summaryCount) {
    return summaryCount === "1" ? "1 issue needs review" : `${summaryCount} issues need review`;
  }

  return readiness.topIssues.length > 0
    ? `${readiness.topIssues.length} visible issue${readiness.topIssues.length === 1 ? "" : "s"}`
    : "Review needed";
}

function nextActionCopy(report: UiReport): { title: string; description: string } {
  if (report.readiness.label === "ready") {
    return {
      title: "No changes needed",
      description: "No launch-blocking metadata or crawlability issues were found.",
    };
  }

  if (report.safeApply?.available) {
    return {
      title: "Apply the safe crawl-file fix",
      description: `Create ${formatInlineList(report.safeApply.eligibleFiles)} with safe apply, then review any remaining changes manually.`,
    };
  }

  if (!report.input.repoPath) {
    return {
      title: "Select the project folder",
      description: "Connect the local project to preview file-level fixes before making changes.",
    };
  }

  if (report.patchPreview?.hasPreview) {
    return {
      title: "Review generated changes manually",
      description: "ShipReady found changes, but they require review before they should be applied.",
    };
  }

  const primary = report.workflow.availableNextActions.find((action) => action.primary) ??
    report.workflow.availableNextActions[0];

  return {
    title: primary?.label ?? "Review the report",
    description: primary?.explanation ?? "Review the remaining launch-readiness guidance before making changes.",
  };
}

function safeApplyStatusCopy(report: UiReport): {
  label: string;
  title: string;
  description: string;
  badgeClass: string;
} {
  if (report.safeApply?.available) {
    return {
      label: "Available",
      title: "Safe automatic fix available",
      description: `ShipReady can create ${formatInlineList(report.safeApply.eligibleFiles)} without overwriting existing files.`,
      badgeClass: "positive",
    };
  }

  if (!report.input.repoPath) {
    return {
      label: "URL only",
      title: "No local files inspected",
      description: "This URL-only report did not inspect a local project folder, so there are no local files to apply.",
      badgeClass: "muted",
    };
  }

  if (report.readiness.label === "ready") {
    return {
      label: "Not needed",
      title: "No safe automatic fix needed",
      description: "The launch-readiness checks do not need an automatic crawl-file change.",
      badgeClass: "positive",
    };
  }

  return {
    label: "Not available",
    title: "No safe automatic fix available",
    description: "ShipReady found changes, but they require review before they should be applied.",
    badgeClass: "caution",
  };
}

function safeApplyUnavailableHeading(report: UiReport): string {
  if (!report.input.repoPath) return "No local changes to apply";
  if (report.readiness.label === "ready") return "No safe automatic fix needed";
  return "No safe automatic fix available";
}

function safeApplyUnavailableExplanation(report: UiReport): string {
  if (!report.input.repoPath) {
    return "This URL-only report did not inspect a local project folder, so there are no local files to apply.";
  }

  if (report.readiness.label === "ready") {
    return "No launch-blocking metadata or crawlability fixes need automatic changes.";
  }

  return "ShipReady found changes, but they require review before they should be applied.";
}

function projectUnderstandingCopy(
  project: UiProjectSummary,
  readiness: UiReadiness,
  safeApply: UiSafeApplySummary | undefined,
): { title: string; description: string } {
  if (!project.detected) {
    if (readiness.label === "ready") {
      return {
        title: "The live page looks ready",
        description:
          "This local folder is not recognized as a supported website project, so ShipReady will not suggest local changes.",
      };
    }

    return {
      title: "This local folder needs manual review",
      description:
        "ShipReady could not recognize a supported website project here, so local changes should be reviewed manually.",
    };
  }

  if (safeApply?.available) {
    return {
      title: `This looks like a ${project.frameworkLabel} project.`,
      description:
        "ShipReady can inspect this project and can safely create the eligible crawl files listed below.",
    };
  }

  if (readiness.label === "ready") {
    return {
      title: `This looks like a ${project.frameworkLabel} project.`,
      description:
        "ShipReady can inspect this project. The live page looks ready, so no local fix is needed right now.",
    };
  }

  return {
    title: `This looks like a ${project.frameworkLabel} project.`,
    description:
      "ShipReady can inspect this project, but the remaining fixes require review before they can be applied safely.",
  };
}

function formatInlineList(items: string[]): string {
  if (items.length === 0) return "the eligible files";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function wouldChangeLabel(changeType: UiPatchPreviewSummary["fileChanges"][number]["changeType"]): string {
  return changeType === "create" ? "Would create" : "Would update";
}

function reviewStatusLabel(status: string): string {
  if (status === "auto_candidate") return "safe candidate";
  if (status === "review_required") return "needs review";
  return status.replace(/_/g, " ");
}

function readinessLabel(label: UiReadiness["label"]): string {
  if (label === "ready") return "Ready";
  if (label === "almost_ready") return "Almost ready";
  return "Needs attention";
}

function readinessClass(label: UiReadiness["label"]): string {
  if (label === "ready") return "positive";
  if (label === "almost_ready") return "caution";
  return "attention";
}

function sourceLabel(source: UiPreviewSource): string {
  if (source === "raw") return "Raw HTML";
  if (source === "rendered") return "Rendered fallback";
  return "Fallback";
}

function sourceClass(source: UiPreviewSource): string {
  if (source === "raw") return "positive";
  if (source === "rendered") return "caution";
  return "muted";
}

function confidenceLabel(label: UiProjectSummary["confidenceLabel"]): string {
  if (label === "good_match") return "Good match";
  if (label === "likely_match") return "Likely match";
  return "Manual review";
}

function safetyLabel(safety: UiFixAction["safety"]): string {
  if (safety === "safe_to_apply") return "Safe to apply";
  if (safety === "needs_review") return "Needs review";
  if (safety === "manual_only") return "Manual only";
  if (safety === "already_good") return "Already good";
  return "Preview only";
}

function safetyClass(safety: UiFixAction["safety"]): string {
  if (safety === "safe_to_apply" || safety === "already_good") return "positive";
  if (safety === "needs_review" || safety === "preview_only") return "caution";
  return "attention";
}

function issueSeverityLabel(severity: UiIssue["userSeverity"]): string {
  if (severity === "blocking") return "Blocking";
  if (severity === "important") return "Important";
  if (severity === "recommended") return "Recommended";
  if (severity === "optional_polish") return "Optional";
  return "Passed";
}

function issueSeverityClass(severity: UiIssue["userSeverity"]): string {
  if (severity === "ready") return "positive";
  if (severity === "optional_polish" || severity === "recommended") return "muted";
  if (severity === "important") return "caution";
  return "attention";
}

function formatCommandArg(value: string): string {
  if (/^[A-Za-z0-9_./:@-]+$/.test(value)) {
    return value;
  }

  return `'${value.replace(/'/g, "'\\''")}'`;
}

const REPORT_CSS = `
:root {
  color-scheme: light;
  --bg: #f5f6f8;
  --paper: #ffffff;
  --paper-soft: #fafbfc;
  --text: #1f2328;
  --muted: #69717d;
  --muted-strong: #515963;
  --line: #dfe4ea;
  --line-strong: #c7d0da;
  --positive-bg: #e8f6ed;
  --positive-text: #155c35;
  --caution-bg: #fff5dd;
  --caution-text: #754c00;
  --attention-bg: #fff0ed;
  --attention-text: #963022;
  --info-bg: #edf5ff;
  --info-text: #27578f;
  --code-bg: #161a1f;
  --code-text: #edf1f5;
  --shadow: 0 12px 30px rgba(31, 35, 40, 0.07);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 15px;
  line-height: 1.6;
}

.shell {
  width: min(1180px, calc(100% - 32px));
  margin: 0 auto;
  padding: 34px 0 64px;
}

.hero {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: var(--shadow);
  padding: 30px;
}

.positive-hero {
  border-top: 5px solid #2d8a57;
}

.caution-hero {
  border-top: 5px solid #c0841a;
}

.attention-hero {
  border-top: 5px solid #c55246;
}

.hero-topline {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 18px;
}

.hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 370px);
  gap: 26px;
  align-items: start;
}

.hero-main {
  min-width: 0;
}

.decision-panel {
  background: var(--paper-soft);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 18px;
}

.decision-panel h2,
.decision-card h3 {
  font-size: 18px;
  line-height: 1.25;
  margin: 0 0 8px;
}

.decision-panel p:last-child,
.decision-card p:last-child {
  margin-bottom: 0;
}

.decision-label {
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
  margin: 0 0 8px;
  text-transform: uppercase;
}

.decision-metrics {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 24px;
}

.decision-metrics div {
  background: var(--paper-soft);
  border: 1px solid var(--line);
  border-radius: 8px;
  min-width: 0;
  padding: 12px 14px;
}

.decision-metrics dd {
  font-weight: 750;
}

.section {
  margin-top: 38px;
}

.section-heading {
  max-width: 820px;
  margin-bottom: 18px;
}

.section-heading h2,
.hero h1 {
  margin: 0;
  font-size: 29px;
  line-height: 1.18;
  letter-spacing: 0;
}

.hero h1 {
  font-size: 40px;
  max-width: 780px;
}

h3,
h4,
p {
  margin-top: 0;
}

h3 {
  font-size: 17px;
  line-height: 1.3;
  margin-bottom: 0;
}

h4 {
  font-size: 15px;
  line-height: 1.35;
  margin-bottom: 8px;
}

p {
  margin-bottom: 12px;
}

.lede {
  color: var(--muted-strong);
  font-size: 18px;
  margin-bottom: 0;
  max-width: 760px;
}

.audited-url {
  color: var(--muted);
  margin: 0 0 12px;
}

.eyebrow {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  margin-bottom: 8px;
  text-transform: uppercase;
}

.context-details {
  background: transparent;
  margin-top: 18px;
  padding: 0;
}

.context-details summary {
  color: var(--muted-strong);
  font-size: 13px;
  width: fit-content;
}

.meta-grid {
  display: grid;
  gap: 14px;
  margin: 14px 0 0;
}

.meta-grid.has-repo {
  grid-template-columns: minmax(150px, 1fr) minmax(300px, 2fr) minmax(180px, 1.2fr) minmax(120px, 0.8fr);
}

.meta-grid.url-only {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.meta-grid div {
  background: var(--paper-soft);
  border: 1px solid var(--line);
  border-radius: 8px;
  min-width: 0;
  padding: 12px 14px;
}

dt,
.field-label {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  margin: 0 0 4px;
  text-transform: uppercase;
}

dd {
  margin: 0;
}

.overview-layout {
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(0, 1fr) minmax(270px, 340px);
  align-items: start;
}

.overview-main,
.overview-side,
.ready-overview,
.passed-highlights {
  display: grid;
  gap: 14px;
}

.overview-side {
  align-content: start;
}

.subsection-heading {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.issue-card-stack {
  display: grid;
  gap: 12px;
}

.highlight-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.mini-issue-card {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 8px;
  min-width: 0;
  padding: 13px 14px;
}

.mini-issue-card strong {
  display: block;
  margin: 8px 0 4px;
  overflow-wrap: anywhere;
}

.mini-issue-card p {
  color: var(--muted);
  font-size: 13px;
  margin-bottom: 0;
}

.preview-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.crawler-card {
  grid-column: 1 / -1;
}

.crawler-snapshot {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.crawler-snapshot div {
  background: var(--paper-soft);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 12px;
}

.action-groups,
.patch-list,
.skipped-actions,
.blocked-files {
  display: grid;
  gap: 14px;
}

.action-group {
  display: grid;
  gap: 12px;
}

.quiet-group {
  display: block;
  padding: 0;
}

.quiet-group summary {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  padding: 14px 16px;
}

.quiet-group summary::-webkit-details-marker {
  display: none;
}

.summary-count {
  color: var(--muted);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.quiet-group-content {
  border-top: 1px solid var(--line);
  padding: 12px 16px 16px;
}

.card {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 18px;
}

.card-title-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.card-title-row h3,
.card-title-row h4 {
  min-width: 0;
}

.badge-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.badge {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  border-radius: 999px;
  padding: 4px 9px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
}

.positive {
  background: var(--positive-bg);
  color: var(--positive-text);
}

.caution {
  background: var(--caution-bg);
  color: var(--caution-text);
}

.attention {
  background: var(--attention-bg);
  color: var(--attention-text);
}

.muted,
.subtle {
  background: #f1f3f5;
  color: #4b535c;
}

.source-badge {
  font-size: 11px;
  font-weight: 650;
}

.notice {
  background: var(--info-bg);
  border: 1px solid #d3e3fb;
  border-radius: 8px;
  color: var(--info-text);
  margin-bottom: 16px;
  padding: 14px 16px;
}

.notice.warning {
  background: var(--attention-bg);
  border-color: #f5c7c0;
  color: var(--attention-text);
}

.notice.deploy {
  background: var(--caution-bg);
  border-color: #f1ddad;
  color: var(--caution-text);
}

.notice p:last-child {
  margin-bottom: 0;
}

.field {
  border-top: 1px solid var(--line);
  padding-top: 12px;
  margin-top: 12px;
}

.field p:last-child,
.key-value {
  margin-bottom: 0;
}

.key-value span {
  color: var(--muted);
  font-weight: 700;
}

.missing-fields {
  border-top: 1px solid var(--line);
  margin-top: 12px;
  padding-top: 12px;
}

.missing-chip {
  background: #f1f3f5;
  border-radius: 999px;
  color: #4b535c;
  display: inline-flex;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 9px;
}

.project-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.project-fact {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 8px;
  min-width: 0;
  padding: 16px;
}

.action-explanation {
  color: var(--muted-strong);
}

.action-facts {
  display: grid;
  gap: 8px;
}

.fact {
  background: var(--paper-soft);
  border: 1px solid var(--line);
  border-radius: 8px;
  display: grid;
  gap: 4px;
  padding: 10px 12px;
}

.fact span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 750;
  text-transform: uppercase;
}

.fact strong {
  font-size: 14px;
  font-weight: 650;
}

.compact-list {
  margin: 0;
  padding-left: 18px;
}

.compact-list li {
  margin: 4px 0;
}

.quiet-list {
  display: grid;
  gap: 10px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.quiet-list li {
  border-bottom: 1px solid var(--line);
  padding-bottom: 10px;
}

.quiet-list li:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.quiet-list strong,
.quiet-list span {
  display: block;
}

.quiet-list span {
  color: var(--muted);
  margin-top: 2px;
}

.quiet-card {
  border-bottom: 1px solid var(--line);
  padding: 0 0 12px;
}

.quiet-card:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.file-summary-list {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 8px;
  display: grid;
  gap: 0;
  margin-bottom: 14px;
}

.file-summary-row {
  align-items: center;
  border-bottom: 1px solid var(--line);
  display: grid;
  gap: 12px;
  grid-template-columns: auto minmax(0, 1fr) auto;
  padding: 12px 14px;
}

.file-summary-row:last-child {
  border-bottom: 0;
}

.file-summary-row strong {
  font-weight: 750;
}

.file-summary-row > span:last-child {
  color: var(--muted);
  font-size: 13px;
}

.patch-meta-row {
  color: var(--muted);
  display: flex;
  flex-wrap: wrap;
  font-size: 13px;
  gap: 8px 14px;
  margin: 2px 0 12px;
}

.patch-meta-row span {
  white-space: nowrap;
}

.file-chip-list,
.trust-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  list-style: none;
  margin: 0 0 16px;
  padding: 0;
}

.file-chip-list li,
.trust-row li {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--muted-strong);
  font-size: 13px;
  font-weight: 700;
  padding: 7px 10px;
}

.trust-row li {
  background: var(--positive-bg);
  border-color: #cdebd8;
  color: var(--positive-text);
}

.inline-details {
  background: transparent;
  border: 0;
  margin-top: 8px;
  padding: 0;
}

.inline-details summary {
  color: var(--muted-strong);
  font-size: 13px;
}

.empty,
.missing,
.muted-text,
.more-count {
  color: var(--muted);
}

.wrap-safe {
  overflow-wrap: anywhere;
  word-break: break-word;
}

pre {
  max-height: 380px;
  overflow: auto;
  background: var(--code-bg);
  color: var(--code-text);
  border-radius: 8px;
  padding: 14px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre;
}

pre.command {
  max-height: none;
  margin: 8px 0 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

details {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 14px 16px;
}

.context-details {
  background: transparent;
  border: 0;
  padding: 0;
}

summary {
  cursor: pointer;
  font-weight: 700;
}

.secondary-details {
  margin-top: 14px;
}

.secondary-details summary {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.diff-details {
  margin-top: 12px;
}

.diff-details pre {
  margin-bottom: 0;
}

.developer-details h3,
.secondary-details h3 {
  margin-top: 18px;
}

@media (max-width: 980px) {
  .preview-grid,
  .project-summary,
  .highlight-grid,
  .decision-metrics {
    grid-template-columns: 1fr 1fr;
  }

  .hero-grid,
  .overview-layout {
    grid-template-columns: 1fr;
  }

  .meta-grid.has-repo,
  .meta-grid.url-only {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 720px) {
  .shell {
    width: min(100% - 20px, 1180px);
    padding-top: 16px;
  }

  .hero {
    padding: 20px;
  }

  .hero-grid,
  .decision-metrics,
  .preview-grid,
  .project-summary,
  .highlight-grid,
  .crawler-snapshot {
    grid-template-columns: 1fr;
  }

  .meta-grid.has-repo,
  .meta-grid.url-only {
    grid-template-columns: 1fr;
  }
  .hero h1 {
    font-size: 30px;
  }

  .section-heading h2 {
    font-size: 24px;
  }

  .hero-topline,
  .card-title-row,
  .subsection-heading,
  .secondary-details summary {
    align-items: flex-start;
    flex-direction: column;
  }

  .file-summary-row {
    align-items: flex-start;
    grid-template-columns: 1fr;
  }
}
`;
