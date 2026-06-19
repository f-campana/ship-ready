export const GUI_CLIENT_JS = `
(function () {
  "use strict";

  var form = document.querySelector("[data-connect-form]");
  var urlOnlyButton = document.querySelector("[data-url-only]");
  var statusPanel = document.querySelector("[data-status]");
  var errorPanel = document.querySelector("[data-error]");
  var reportRoot = document.querySelector("[data-report]");

  if (!form || !urlOnlyButton || !statusPanel || !errorPanel || !reportRoot) {
    return;
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    runCheck(false);
  });

  urlOnlyButton.addEventListener("click", function () {
    runCheck(true);
  });

  async function runCheck(forceUrlOnly) {
    var formData = new FormData(form);
    var url = String(formData.get("url") || "").trim();
    var repoPath = forceUrlOnly ? "" : String(formData.get("repoPath") || "").trim();

    if (!url) {
      showError({ message: "Enter a website URL before running the check.", stage: "audit" });
      return;
    }

    if (!isValidHttpUrl(url)) {
      showError({ message: "Invalid URL. Provide a full website URL that starts with http or https.", stage: "audit" });
      return;
    }

    setBusy(true);
    showLoading(Boolean(repoPath));
    hideError();

    try {
      var response = await fetch("/api/ui-report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url, repoPath: repoPath }),
      });
      var payload = await response.json();

      if (!payload.ok) {
        showError(payload.error || { message: "ShipReady could not generate the report.", stage: "command" });
        reportRoot.hidden = true;
        return;
      }

      hideStatus();
      renderReport(payload.report);
    } catch (error) {
      showError({
        message: "ShipReady could not reach the local UI server.",
        stage: "network",
        details: error && error.stack ? error.stack : String(error),
      });
      reportRoot.hidden = true;
    } finally {
      setBusy(false);
    }
  }

  function setBusy(isBusy) {
    Array.from(form.elements).forEach(function (control) {
      control.disabled = isBusy;
    });
    urlOnlyButton.disabled = isBusy;
  }

  function showLoading(hasRepoPath) {
    clear(statusPanel);
    statusPanel.hidden = false;
    statusPanel.appendChild(el("p", "decision-label", "Checking"));
    statusPanel.appendChild(el("h2", "", "Checking what the internet sees..."));
    if (hasRepoPath) {
      statusPanel.appendChild(el("p", "", "Reading the local project structure..."));
    }
  }

  function hideStatus() {
    statusPanel.hidden = true;
    clear(statusPanel);
  }

  function showError(error) {
    hideStatus();
    clear(errorPanel);
    errorPanel.hidden = false;
    errorPanel.appendChild(el("p", "decision-label", String(error.stage || "error")));
    errorPanel.appendChild(el("h2", "", error.message || "ShipReady could not complete the check."));

    if (error.details !== undefined) {
      errorPanel.appendChild(renderDetails("Developer details", [
        pre(JSON.stringify(error.details, null, 2)),
      ], false));
    }
  }

  function hideError() {
    errorPanel.hidden = true;
    clear(errorPanel);
  }

  function renderReport(report) {
    clear(reportRoot);
    reportRoot.hidden = false;
    reportRoot.appendChild(renderDecisionPanel(report));
    reportRoot.appendChild(renderReadiness(report.readiness));
    reportRoot.appendChild(renderPreviewCards(report.previews));
    if (report.input && report.input.repoPath) {
      reportRoot.appendChild(renderProject(report.project));
    }
    reportRoot.appendChild(renderFixPlan(report.actionGroups, report.input && report.input.mode));
    reportRoot.appendChild(renderPatchPreview(report.patchPreview));
    reportRoot.appendChild(renderSafeApply(report));
    if (report.input && report.input.repoPath) {
      reportRoot.appendChild(renderLocalVsLive(report.liveVsLocal));
    }
    reportRoot.appendChild(renderDeveloperDetails(report));
  }

  function renderDecisionPanel(report) {
    var readiness = report.readiness || {};
    var section = el("section", "decision-panel " + readinessClass(readiness.label));
    var summary = el("div", "decision-summary");
    var mode = report.input && report.input.mode === "url_and_repo" ? "URL + repository" : "URL only";
    var primaryAction = primaryNextAction(report.workflow);

    summary.appendChild(el("p", "eyebrow", "Decision panel"));
    summary.appendChild(el("h2", "", readiness.title || "ShipReady report"));
    summary.appendChild(el("p", "muted-text", readiness.summary || "Review the report sections below."));
    summary.appendChild(renderMetricGrid([
      ["Mode", mode],
      ["Readiness", readinessLabel(readiness.label)],
      ["Score", typeof readiness.score === "number" ? String(readiness.score) + " / 100" : "Not scored"],
    ]));

    var next = el("aside", "decision-card");
    next.appendChild(el("p", "decision-label", "Next best action"));
    next.appendChild(el("h3", "", primaryAction.label || "Review readiness"));
    next.appendChild(el("p", "", primaryAction.explanation || nextActionFallback(report)));
    next.appendChild(badge(safeApplyLabel(report.safeApply, report.input), safeApplyClass(report.safeApply, report.input)));

    section.appendChild(summary);
    section.appendChild(next);
    return section;
  }

  function renderReadiness(readiness) {
    var section = createSection("Readiness", readiness.title || "Readiness", readiness.summary || "");
    section.appendChild(renderIssueList("Top issues", readiness.topIssues || [], "No top issues found.", false));
    section.appendChild(renderIssueList("Passed highlights", readiness.passedHighlights || [], "No passed highlights available.", true));
    section.appendChild(renderIssueList("Optional polish", readiness.optionalPolish || [], "No optional polish items found.", true));
    return section;
  }

  function renderPreviewCards(previews) {
    var section = createSection("Preview cards", "How the page appears to crawlers and preview bots", "");
    var usesRenderedFallback = previews && (
      (previews.google && previews.google.source === "rendered") ||
      (previews.social && previews.social.source === "rendered") ||
      (previews.twitter && previews.twitter.source === "rendered") ||
      (previews.crawlerView && previews.crawlerView.renderOnlyWarnings && previews.crawlerView.renderOnlyWarnings.length > 0)
    );

    if (usesRenderedFallback) {
      section.appendChild(notice("Some page information appears only after the app loads. Some preview bots may not see it."));
    }

    var grid = el("div", "preview-grid");
    grid.appendChild(renderPreviewCard("Google", previews.google, [
      ["Title", previews.google && previews.google.title],
      ["URL", previews.google && previews.google.url],
      ["Description", previews.google && previews.google.description],
    ]));
    grid.appendChild(renderPreviewCard("Social", previews.social, [
      ["Title", previews.social && previews.social.title],
      ["URL", previews.social && previews.social.url],
      ["Description", previews.social && previews.social.description],
      ["Image URL", previews.social && previews.social.image],
    ]));
    grid.appendChild(renderPreviewCard("X/Twitter", previews.twitter, [
      ["Card", previews.twitter && previews.twitter.card],
      ["Title", previews.twitter && previews.twitter.title],
      ["Description", previews.twitter && previews.twitter.description],
      ["Image URL", previews.twitter && previews.twitter.image],
    ]));
    grid.appendChild(renderCrawlerCard(previews.crawlerView));
    section.appendChild(grid);
    return section;
  }

  function renderPreviewCard(title, card, fields) {
    var article = el("article", "card preview-card");
    var header = el("div", "card-title-row");
    header.appendChild(el("h3", "", title));
    header.appendChild(badge(sourceLabel(card && card.source), sourceClass(card && card.source)));
    article.appendChild(header);

    fields.forEach(function (field) {
      article.appendChild(renderField(field[0], field[1]));
    });

    if (card && card.missingFields && card.missingFields.length > 0) {
      var missing = el("div", "missing-fields");
      missing.appendChild(el("span", "field-label", "Missing"));
      var row = el("div", "badge-row");
      card.missingFields.forEach(function (field) {
        row.appendChild(badge(String(field), "muted"));
      });
      missing.appendChild(row);
      article.appendChild(missing);
    }

    return article;
  }

  function renderCrawlerCard(crawlerView) {
    var article = el("article", "card preview-card");
    var header = el("div", "card-title-row");
    header.appendChild(el("h3", "", "Crawler view"));
    header.appendChild(badge("Raw vs rendered", "info"));
    article.appendChild(header);
    article.appendChild(renderField("Raw HTML", crawlerView && crawlerView.rawHtmlSummary));
    article.appendChild(renderField("Rendered HTML", crawlerView && crawlerView.renderedHtmlSummary));

    var warnings = crawlerView && crawlerView.renderOnlyWarnings ? crawlerView.renderOnlyWarnings : [];
    if (warnings.length > 0) {
      article.appendChild(renderIssueRows("Rendered fallback warnings", warnings));
    }

    return article;
  }

  function renderProject(project) {
    if (!project) {
      return createSection("Project understanding", "Project inspection was not available", "ShipReady could not build a local project summary for this report.");
    }

    var section = createSection("Project understanding", project.frameworkLabel || "Unknown project", project.explanation || "");
    var grid = el("div", "project-grid");
    grid.appendChild(renderFactCard("Framework", project.frameworkLabel || "Unknown"));
    grid.appendChild(renderFactCard("Confidence", confidenceLabel(project.confidenceLabel)));
    grid.appendChild(renderListCard("Important files", project.importantFiles || [], "No important files were detected."));
    grid.appendChild(renderListCard("Supported fixes", project.supportedFixes || [], "No supported fixes are available for this project yet."));
    grid.appendChild(renderListCard("Limitations", project.limitations || [], "No limitations reported."));
    section.appendChild(grid);
    return section;
  }

  function renderFixPlan(actionGroups, mode) {
    if (!actionGroups) {
      return createSection(
        "Fix plan",
        "Grouped actions",
        mode === "url_only"
          ? "No local fix plan is available in URL-only mode. Add a project folder to preview file-level changes."
          : "No local fix plan is available for this report."
      );
    }

    var section = createSection("Fix plan", "Grouped actions", "");
    var groups = el("div", "action-groups");
    groups.appendChild(renderActionGroup("Safe to apply", actionGroups.safeToApply || [], "No safe automatic changes.", shouldCollapseActionGroup(actionGroups.safeToApply)));
    groups.appendChild(renderActionGroup("Needs review", actionGroups.needsReview || [], "No generated changes need review.", shouldCollapseActionGroup(actionGroups.needsReview)));
    groups.appendChild(renderActionGroup("Manual only", actionGroups.manualOnly || [], "No manual-only actions.", shouldCollapseActionGroup(actionGroups.manualOnly)));
    groups.appendChild(renderIssueList("Already good", actionGroups.alreadyGood || [], "No passed checks available.", true));
    groups.appendChild(renderIssueList("Optional polish", actionGroups.optionalPolish || [], "No optional polish actions.", true));
    section.appendChild(groups);
    return section;
  }

  function renderActionGroup(title, actions, emptyText, collapsed) {
    var content = el("div", "group-details-content");
    if (actions.length === 0) {
      content.appendChild(el("p", "empty", emptyText));
    } else {
      actions.forEach(function (action) {
        var card = el("article", "card action-card");
        var header = el("div", "card-title-row");
        header.appendChild(el("h4", "", action.title || "Action"));
        header.appendChild(badge(safetyLabel(action.safety), safetyClass(action.safety)));
        card.appendChild(header);
        card.appendChild(el("p", "", action.explanation || ""));
        if (action.targetLabel) card.appendChild(keyValue("Target file", action.targetLabel));
        card.appendChild(keyValue("Can ShipReady apply it?", action.canApplyInV1 ? "Yes, with safe apply" : "Needs review first"));
        if (action.reviewReason) card.appendChild(keyValue("Review note", action.reviewReason));
        content.appendChild(card);
      });
    }
    return renderDetails(title + " (" + actions.length + ")", [content], !collapsed);
  }

  function renderPatchPreview(patchPreview) {
    if (!patchPreview || !patchPreview.hasPreview) {
      return createSection("Patch preview", "No patch preview", "No file changes were generated for this report.");
    }

    var section = createSection("Patch preview", "Files ShipReady would create or update", "Review the file list first. Diffs stay collapsed until a developer needs them.");
    var summary = el("div", "file-summary-list");
    (patchPreview.fileChanges || []).forEach(function (change) {
      var row = el("div", "file-summary-row");
      row.appendChild(badge(change.eligibleForWrite ? wouldChangeLabel(change.changeType) : "Blocked from safe apply", change.eligibleForWrite ? "positive" : "caution"));
      row.appendChild(el("strong", "wrap-safe", change.path || "Unknown file"));
      row.appendChild(el("span", "", change.eligibleForWrite ? "Can be applied safely" : "Needs human review"));
      summary.appendChild(row);
    });
    section.appendChild(summary);

    var list = el("div", "patch-list");
    (patchPreview.fileChanges || []).forEach(function (change) {
      list.appendChild(renderFileChange(change));
    });
    section.appendChild(list);

    if (patchPreview.skippedActions && patchPreview.skippedActions.length > 0) {
      var skippedContent = el("div", "group-details-content");
      patchPreview.skippedActions.forEach(function (action) {
        var card = el("article", "quiet-card");
        card.appendChild(el("h4", "", action.title || "Skipped action"));
        card.appendChild(el("p", "", action.reason || ""));
        skippedContent.appendChild(card);
      });
      section.appendChild(renderDetails("Actions without a file diff (" + patchPreview.skippedActions.length + ")", [skippedContent], false));
    }

    return section;
  }

  function renderFileChange(change) {
    var article = el("article", "card patch-card");
    var header = el("div", "card-title-row");
    header.appendChild(el("h3", "wrap-safe", change.path || "Unknown file"));
    header.appendChild(badge(change.eligibleForWrite ? wouldChangeLabel(change.changeType) : "Blocked from safe apply", change.eligibleForWrite ? "positive" : "caution"));
    article.appendChild(header);

    var meta = el("div", "patch-meta-row");
    meta.appendChild(el("span", "", wouldChangeLabel(change.changeType)));
    meta.appendChild(el("span", "", "Risk: " + (change.risk || "unknown")));
    meta.appendChild(el("span", "", "Review: " + reviewStatusLabel(change.reviewStatus)));
    article.appendChild(meta);

    article.appendChild(keyValue("Eligibility", change.eligibleForWrite ? "Safe apply candidate" : "Blocked from safe apply"));
    if (change.writeBlockReason) article.appendChild(keyValue("Block reason", change.writeBlockReason));
    article.appendChild(renderDetails("View diff", [pre(change.diff || "No diff was produced for this file change.")], false, "diff-details"));
    return article;
  }

  function renderSafeApply(report) {
    var safeApply = report.safeApply;
    var input = report.input || {};

    if (!input.repoPath) {
      var urlOnly = createSection(
        "Safe apply",
        "No local files inspected",
        "This URL-only check did not inspect a project folder or preview local file changes. Add a local project folder later to identify safe crawl-file creations."
      );
      urlOnly.appendChild(notice("The GUI did not change files. Safe apply remains a command you run separately after a repo-based dry run."));
      return urlOnly;
    }

    if (!safeApply || !safeApply.available) {
      var unavailable = createSection("Safe apply", "No safe automatic fix available", safeApply && safeApply.explanation ? safeApply.explanation : "No dry-run file change currently qualifies for V1 safe apply.");
      unavailable.appendChild(renderTrustRow());
      if (safeApply && safeApply.blockedFiles && safeApply.blockedFiles.length > 0) {
        unavailable.appendChild(renderBlockedFiles(safeApply.blockedFiles));
      }
      return unavailable;
    }

    var section = createSection("Safe apply · Preview first", "Safe crawl files ready to create", "ShipReady can create these missing crawl files without overwriting existing files:", "safe-apply-section");
    section.appendChild(renderStringList(safeApply.eligibleFiles || [], "No eligible files.", "file-chip-list"));
    section.appendChild(notice("Demo-safe: this GUI does not write files. Review and copy the guarded CLI command when you are ready."));
    var command = "pnpm shipready fix " + formatCommandArg(input.repoPath || ".") + " --url " + formatCommandArg(input.url || "") + " --write --allow-create";
    section.appendChild(el("p", "field-label command-label", "Guarded CLI command"));
    var commandRow = el("div", "command-row");
    commandRow.appendChild(pre(command));
    var copyButton = el("button", "copy-command", "Copy command");
    copyButton.type = "button";
    var copyStatus = el("span", "copy-status", "");
    copyStatus.setAttribute("aria-live", "polite");
    copyButton.addEventListener("click", async function () {
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        copyStatus.textContent = "Copy unavailable — select the command manually.";
        return;
      }

      try {
        await navigator.clipboard.writeText(command);
        copyButton.textContent = "Copied";
        copyStatus.textContent = "Guarded command copied. No files were changed.";
      } catch (_error) {
        copyStatus.textContent = "Copy unavailable — select the command manually.";
      }
    });
    commandRow.appendChild(copyButton);
    section.appendChild(commandRow);
    section.appendChild(copyStatus);
    section.appendChild(renderTrustRow());
    if (safeApply.blockedFiles && safeApply.blockedFiles.length > 0) {
      section.appendChild(renderBlockedFiles(safeApply.blockedFiles));
    }
    section.appendChild(renderDetails("Safe apply policy notes", [
      renderStringList(safeApply.safetyNotes || [], "No additional safety notes.", "compact-list"),
    ], false));
    return section;
  }

  function renderBlockedFiles(blockedFiles) {
    var wrapper = el("div", "section-grid");
    wrapper.appendChild(el("h3", "", "Blocked from safe apply"));
    blockedFiles.forEach(function (file) {
      var card = el("article", "quiet-card");
      card.appendChild(el("h4", "wrap-safe", file.path || "Unknown file"));
      card.appendChild(el("p", "", file.reason || "This change is outside the V1 safe-apply policy."));
      wrapper.appendChild(card);
    });
    return wrapper;
  }

  function renderLocalVsLive(liveVsLocal) {
    var section = el("section", "section");
    var warning = el("div", "local-warning");
    warning.appendChild(el("strong", "", "Local changes do not affect the live website until you deploy."));
    warning.appendChild(el("p", "", liveVsLocal && liveVsLocal.message ? liveVsLocal.message : "ShipReady has not deployed anything."));
    section.appendChild(warning);
    return section;
  }

  function renderDeveloperDetails(report) {
    return renderDetails("Developer details", [
      el("p", "", "Schema version: " + (report.schemaVersion || "unknown")),
      pre(JSON.stringify(report, null, 2)),
    ], false, "developer-details");
  }

  function renderIssueList(title, issues, emptyText, collapsed) {
    var content = el("div", "group-details-content");
    if (issues.length === 0) {
      content.appendChild(el("p", "empty", emptyText));
    } else {
      issues.forEach(function (issue) {
        var card = el("article", "card issue-card");
        var header = el("div", "card-title-row");
        header.appendChild(el("h4", "", issue.title || "Issue"));
        header.appendChild(badge(issueSeverityLabel(issue.userSeverity), issueSeverityClass(issue.userSeverity)));
        card.appendChild(header);
        card.appendChild(el("p", "", issue.explanation || ""));
        if (issue.whyItMatters) card.appendChild(el("p", "muted-text", issue.whyItMatters));
        content.appendChild(card);
      });
    }

    return renderDetails(title + " (" + issues.length + ")", [content], !collapsed);
  }

  function renderIssueRows(title, issues) {
    var wrapper = el("div", "field");
    wrapper.appendChild(el("p", "field-label", title));
    wrapper.appendChild(renderStringList(issues.map(function (issue) {
      return issue.title || issue.explanation || "Warning";
    }), "No warnings.", "compact-list"));
    return wrapper;
  }

  function renderFactCard(title, value) {
    var card = el("article", "card");
    card.appendChild(el("p", "field-label", title));
    card.appendChild(el("h3", "wrap-safe", value));
    return card;
  }

  function renderListCard(title, items, emptyText) {
    var card = el("article", "card");
    card.appendChild(el("p", "field-label", title));
    card.appendChild(renderStringList(items, emptyText, "compact-list"));
    return card;
  }

  function renderMetricGrid(metrics) {
    var grid = el("div", "metric-grid");
    metrics.forEach(function (metric) {
      var item = el("div", "metric");
      item.appendChild(el("span", "field-label", metric[0]));
      item.appendChild(el("strong", "wrap-safe", metric[1]));
      grid.appendChild(item);
    });
    return grid;
  }

  function renderField(label, value) {
    var field = el("div", "field");
    field.appendChild(el("p", "field-label", label));
    field.appendChild(el("p", "wrap-safe", value || "Missing"));
    if (!value) {
      field.lastChild.classList.add("empty");
    }
    return field;
  }

  function renderStringList(items, emptyText, className) {
    if (!items || items.length === 0) {
      return el("p", "empty", emptyText);
    }
    var list = el("ul", className || "compact-list");
    items.forEach(function (item) {
      list.appendChild(el("li", "wrap-safe", String(item)));
    });
    return list;
  }

  function renderTrustRow() {
    var list = el("ul", "file-chip-list");
    ["No overwrites", "No metadata or content edits", "No Git commits", "No deploys"].forEach(function (item) {
      list.appendChild(el("li", "", item));
    });
    return list;
  }

  function renderDetails(summaryText, children, open, className) {
    var details = el("details", className || "group-details");
    if (open) details.open = true;
    details.appendChild(el("summary", "", summaryText));
    children.forEach(function (child) {
      details.appendChild(child);
    });
    return details;
  }

  function createSection(kicker, title, summary, className) {
    var section = el("section", "section" + (className ? " " + className : ""));
    var heading = el("div", "section-heading");
    heading.appendChild(el("p", "eyebrow", kicker));
    heading.appendChild(el("h2", "", title));
    if (summary) heading.appendChild(el("p", "", summary));
    section.appendChild(heading);
    return section;
  }

  function notice(message) {
    return el("div", "notice", message);
  }

  function keyValue(key, value) {
    var item = el("p", "key-value");
    item.appendChild(el("span", "", key + ": "));
    item.appendChild(el("span", "wrap-safe", value));
    return item;
  }

  function badge(text, tone) {
    return el("span", "badge " + (tone || "muted"), text || "Unknown");
  }

  function pre(text) {
    var node = el("pre", "");
    node.textContent = text == null ? "" : String(text);
    return node;
  }

  function el(tagName, className, text) {
    var node = document.createElement(tagName);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function primaryNextAction(workflow) {
    var actions = workflow && workflow.availableNextActions ? workflow.availableNextActions : [];
    return actions.find(function (action) { return action.primary; }) || actions[0] || {};
  }

  function nextActionFallback(report) {
    if (report.safeApply && report.safeApply.available) return "Copy the safe apply command when you are ready.";
    if (!report.input || !report.input.repoPath) return "Add a project folder to preview file-level fixes.";
    return "Review the generated guidance before changing local files.";
  }

  function shouldCollapseActionGroup(actions) {
    return !actions || actions.length === 0;
  }

  function isValidHttpUrl(value) {
    try {
      var parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch (_error) {
      return false;
    }
  }

  function readinessLabel(label) {
    if (label === "ready") return "Ready";
    if (label === "almost_ready") return "Almost ready";
    return "Needs attention";
  }

  function readinessClass(label) {
    if (label === "ready") return "positive";
    if (label === "almost_ready") return "caution";
    return "attention";
  }

  function sourceLabel(source) {
    if (source === "raw") return "Raw HTML";
    if (source === "rendered") return "Rendered fallback";
    return "Fallback";
  }

  function sourceClass(source) {
    if (source === "raw") return "positive";
    if (source === "rendered") return "caution";
    return "muted";
  }

  function confidenceLabel(label) {
    if (label === "good_match") return "Good match";
    if (label === "likely_match") return "Likely match";
    return "Manual review";
  }

  function safetyLabel(safety) {
    if (safety === "safe_to_apply") return "Safe to apply";
    if (safety === "needs_review") return "Needs review";
    if (safety === "manual_only") return "Manual only";
    if (safety === "already_good") return "Already good";
    return "Preview only";
  }

  function safetyClass(safety) {
    if (safety === "safe_to_apply" || safety === "already_good") return "positive";
    if (safety === "needs_review" || safety === "preview_only") return "caution";
    return "attention";
  }

  function issueSeverityLabel(severity) {
    if (severity === "blocking") return "Blocking";
    if (severity === "important") return "Important";
    if (severity === "recommended") return "Recommended";
    if (severity === "optional_polish") return "Optional";
    return "Passed";
  }

  function issueSeverityClass(severity) {
    if (severity === "ready") return "positive";
    if (severity === "optional_polish" || severity === "recommended") return "muted";
    if (severity === "important") return "caution";
    return "attention";
  }

  function safeApplyLabel(safeApply, input) {
    if (safeApply && safeApply.available) return "Safe apply available";
    if (!input || !input.repoPath) return "URL-only check";
    return "No safe automatic fix";
  }

  function safeApplyClass(safeApply, input) {
    if (safeApply && safeApply.available) return "positive";
    if (!input || !input.repoPath) return "muted";
    return "caution";
  }

  function wouldChangeLabel(changeType) {
    return changeType === "create" ? "Would create" : "Would update";
  }

  function reviewStatusLabel(status) {
    if (status === "auto_candidate") return "safe candidate";
    if (status === "review_required") return "needs review";
    return String(status || "unknown").replace(/_/g, " ");
  }

  function formatCommandArg(value) {
    value = String(value || "");
    if (/^[A-Za-z0-9_./:@-]+$/.test(value)) return value;
    return "'" + value.split("'").join("'\\\\''") + "'";
  }
})();
`;
