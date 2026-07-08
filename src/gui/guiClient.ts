export const GUI_CLIENT_JS = `
(function () {
  "use strict";

  var form = document.querySelector("[data-connect-form]");
  var urlOnlyButton = document.querySelector("[data-url-only]");
  var statusPanel = document.querySelector("[data-status]");
  var errorPanel = document.querySelector("[data-error]");
  var reportRoot = document.querySelector("[data-report]");
  var currentReview = null;

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

  reportRoot.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || !target.closest) return;

    var checkButton = target.closest("[data-run-check]");
    if (checkButton) {
      runReadOnlyCheck(checkButton.getAttribute("data-run-check"));
      return;
    }

    var copyButton = target.closest("[data-copy-command]");
    if (copyButton) {
      copyCommand(copyButton);
    }
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
    showLoading(Boolean(repoPath), "Checking what the internet sees...");
    hideError();

    try {
      var review = await requestReview({
        url: url,
        repoPath: repoPath,
        include: { uiReport: true },
        options: { rendered: true },
      });
      currentReview = review;
      hideStatus();
      renderReview(review);
    } catch (error) {
      showError(normalizeUiError(error));
      reportRoot.hidden = true;
    } finally {
      setBusy(false);
    }
  }

  async function runReadOnlyCheck(checkName) {
    if (!currentReview || !currentReview.input || !checkName) {
      showError({ message: "Run the main review before loading extra evidence.", stage: "review" });
      return;
    }

    var include = { uiReport: false };
    include[checkName] = true;
    showLoading(Boolean(currentReview.input.repoPath), loadingText(checkName));

    try {
      var review = await requestReview({
        url: currentReview.input.url,
        repoPath: currentReview.input.repoPath || "",
        include: include,
        options: {
          rendered: true,
          crawlMaxPages: 8,
          crawlMaxDepth: 1,
          socialPreviewSource: "both",
        },
      });
      currentReview = mergeReview(currentReview, review);
      hideStatus();
      renderReview(currentReview);
    } catch (error) {
      hideStatus();
      showError(normalizeUiError(error));
    }
  }

  async function requestReview(payload) {
    var response = await fetch("/api/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    var body = await response.json();

    if (!body.ok) {
      throw body.error || { message: "ShipReady could not generate the review.", stage: "command" };
    }

    return body.review;
  }

  function mergeReview(previous, next) {
    next.uiReport = next.uiReport || previous.uiReport;
    next.checks = Object.assign({}, previous.checks || {}, next.checks || {});
    next.commands = Object.assign({}, previous.commands || {}, next.commands || {});
    next.safety = next.safety && next.safety.length ? next.safety : previous.safety;
    return next;
  }

  function setBusy(isBusy) {
    Array.from(form.elements).forEach(function (control) {
      control.disabled = isBusy;
    });
    urlOnlyButton.disabled = isBusy;
  }

  function showLoading(hasRepoPath, message) {
    clear(statusPanel);
    statusPanel.hidden = false;
    statusPanel.appendChild(el("p", "decision-label", "Working locally"));
    statusPanel.appendChild(el("h2", "", message || "Checking what the internet sees..."));
    statusPanel.appendChild(el("p", "", hasRepoPath ? "Reading only the selected project folder and public evidence." : "Reading only public evidence for the URL."));
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

  function renderReview(review) {
    var report = review.uiReport;
    clear(reportRoot);
    reportRoot.hidden = false;

    reportRoot.appendChild(renderHeaderSummary(review, report));
    reportRoot.appendChild(renderGuidedActions(review));
    reportRoot.appendChild(renderInternetView(report));
    reportRoot.appendChild(renderSocialPreviewSection(review));
    reportRoot.appendChild(renderCrawlSection(review));
    reportRoot.appendChild(renderSmellsSection(review));
    reportRoot.appendChild(renderDnsSection(review));
    reportRoot.appendChild(renderSearchConsoleSection(review));

    if (report && report.input && report.input.repoPath) {
    reportRoot.appendChild(renderProject(report.project));
    }
    reportRoot.appendChild(renderFixPlan(report && report.actionGroups, report && report.input && report.input.mode));
    reportRoot.appendChild(renderPatchPreview(report && report.patchPreview));
    reportRoot.appendChild(renderPrDraftHandoff(review));
    reportRoot.appendChild(renderSafeApply(review, report));
    reportRoot.appendChild(renderRecheckSection(review));
    reportRoot.appendChild(renderSafetySection(review));
    reportRoot.appendChild(renderDeveloperDetails(review));
  }

  function renderHeaderSummary(review, report) {
    var readiness = report && report.readiness ? report.readiness : {};
    var section = el("section", "decision-panel " + readinessClass(readiness.label));
    var summary = el("div", "decision-summary");
    var mode = review.input && review.input.mode === "url_and_repo" ? "URL + project folder" : "URL only";
    var nextAction = primaryNextAction(report && report.workflow) || {};

    summary.appendChild(el("p", "eyebrow", "Local review cockpit"));
    summary.appendChild(el("h2", "", readiness.title || "ShipReady review"));
    summary.appendChild(el("p", "muted-text", readiness.summary || "Run the main review to see readiness evidence."));
    summary.appendChild(renderMetricGrid([
      ["URL", review.input && review.input.url ? review.input.url : "Not set"],
      ["Mode", mode],
      ["Readiness", readinessLabel(readiness.label)],
      ["Score", typeof readiness.score === "number" ? String(readiness.score) + " / 100" : "Secondary"],
    ]));

    var next = el("aside", "decision-card");
    next.appendChild(el("p", "decision-label", "Next best action"));
    next.appendChild(el("h3", "", nextAction.label || "Review the evidence"));
    next.appendChild(el("p", "", nextAction.explanation || nextActionFallback(report)));
    next.appendChild(badge(safeApplyLabel(report && report.safeApply, report && report.input), safeApplyClass(report && report.safeApply, report && report.input)));
    next.appendChild(el("p", "muted-text", "Local files and the live site stay unchanged unless you run an approved command outside the GUI."));

    section.appendChild(summary);
    section.appendChild(next);
    return section;
  }

  function renderGuidedActions(review) {
    var section = createSection("Guided actions", "Load extra evidence on demand", "The main review runs first. Heavier checks run only when you ask for them.");
    var grid = el("div", "guided-grid");
    var hasRepo = Boolean(review.input && review.input.repoPath);
    [
      ["socialPreview", "Review social previews", "Simulated from observed metadata. Platforms may render differently.", false],
      ["crawl", "Run bounded crawl", "Bounded same-origin sample with page and depth limits.", false],
      ["smells", "Inspect project smells", "Heuristic implementation signals, not authorship detection.", true],
      ["dns", "Check DNS", "Read-only resolver observations. No DNS writes.", false],
      ["searchConsole", "Check Search Console mock", "Mock-backed status only. No Google OAuth, tokens, or live Google calls.", false],
      ["recheck", "Recheck after deployment", "Read-only public evidence check. Deployment remains external.", false],
    ].forEach(function (action) {
      grid.appendChild(renderGuidedAction(action[0], action[1], action[2], action[3] && !hasRepo));
    });
    section.appendChild(grid);
    return section;
  }

  function renderGuidedAction(key, title, description, disabled) {
    var card = el("article", "card action-card");
    var header = el("div", "card-title-row");
    header.appendChild(el("h3", "", title));
    header.appendChild(badge(disabled ? "Needs repo" : "Read-only", disabled ? "muted" : "info"));
    card.appendChild(header);
    card.appendChild(el("p", "", description));
    var button = el("button", "secondary-action", disabled ? "Add repo path first" : "Run check");
    button.type = "button";
    button.disabled = disabled;
    button.setAttribute("data-run-check", key);
    card.appendChild(button);
    return card;
  }

  function renderInternetView(report) {
    var readiness = report && report.readiness ? report.readiness : {};
    var section = createSection("What the internet sees", "Live URL and crawler-visible basics", "Top issues are kept short. Technical details stay collapsed.");
    section.appendChild(renderIssueList("Top issues", readiness.topIssues || [], "No top issues found.", false));
    section.appendChild(renderPreviewCards(report && report.previews));
    section.appendChild(renderCrawlResourceSummary(report));
    return section;
  }

  function renderPreviewCards(previews) {
    var wrapper = el("div", "section-grid");
    wrapper.appendChild(el("h3", "", "Preview inputs from the main audit"));
    wrapper.appendChild(notice("These cards are approximations from observed metadata, not platform output."));
    var grid = el("div", "preview-grid");
    previews = previews || {};
    grid.appendChild(renderPreviewCard("Google-style", previews.google, [
      ["Title", previews.google && previews.google.title],
      ["URL", previews.google && previews.google.url],
      ["Description", previews.google && previews.google.description],
    ]));
    grid.appendChild(renderPreviewCard("Generic social", previews.social, [
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
    wrapper.appendChild(grid);
    return wrapper;
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
      article.appendChild(keyValue("Missing", card.missingFields.join(", ")));
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
      article.appendChild(renderIssueRows("Rendered-only warnings", warnings));
    }
    return article;
  }

  function renderCrawlResourceSummary(report) {
    var audit = report && report.developerDetails ? report.developerDetails.rawAudit : undefined;
    var resources = audit && audit.resources ? audit.resources : {};
    var grid = el("div", "section-grid two");
    grid.appendChild(renderFactCard("robots.txt", resourceText(resources.robotsTxt)));
    grid.appendChild(renderFactCard("sitemap.xml", resourceText(resources.sitemapXml)));
    return grid;
  }

  function renderSocialPreviewSection(review) {
    var section = createSection("Preview simulator", "Social and link preview surfaces", "Simulated from observed metadata. Platforms may render differently.");
    var check = review.checks && review.checks.socialPreview;
    if (!check) {
      section.appendChild(emptyCheck("Run the social preview simulator when you want deeper surface-by-surface evidence.", "socialPreview"));
      return section;
    }
    if (appendCheckErrorOrSkipped(section, check, "socialPreview")) return section;

    var result = check.result;
    var grid = el("div", "preview-grid");
    [
      ["Google-style", result.previews.google_search],
      ["Generic social", result.previews.generic_social],
      ["X/Twitter", result.previews.x_twitter],
      ["Slack/Discord", result.previews.slack_discord],
      ["LinkedIn", result.previews.linkedin],
    ].forEach(function (entry) {
      var card = el("article", "card preview-card");
      card.appendChild(el("h3", "", entry[0]));
      card.appendChild(renderField("Title", fieldValue(entry[1], "title")));
      card.appendChild(renderField("Description", fieldValue(entry[1], "description")));
      card.appendChild(renderField("URL", fieldValue(entry[1], "url")));
      card.appendChild(renderField("Image", fieldValue(entry[1], "image")));
      grid.appendChild(card);
    });
    section.appendChild(grid);
    if (result.warnings && result.warnings.length) {
      section.appendChild(renderStringDetails("Warnings", result.warnings));
    }
    section.appendChild(renderStringDetails("Limitations", result.limitations || []));
    section.appendChild(renderCommandBlock("CLI equivalent", review.commands && review.commands.socialPreview));
    return section;
  }

  function renderCrawlSection(review) {
    var section = createSection("Small-site crawl", "Repeated issues across a bounded sample", "Bounded same-origin sample with page and depth limits. It is not exhaustive coverage.");
    var check = review.checks && review.checks.crawl;
    if (!check) {
      section.appendChild(emptyCheck("Run the bounded crawl when you want to see whether several pages repeat the same issue.", "crawl"));
      return section;
    }
    if (appendCheckErrorOrSkipped(section, check, "crawl")) return section;

    var result = check.result;
    section.appendChild(renderMetricGrid([
      ["Status", result.summary.status],
      ["Checked", String(result.summary.pagesChecked)],
      ["Discovered", String(result.summary.pagesDiscovered)],
      ["Skipped", String(result.summary.pagesSkipped)],
    ]));
    section.appendChild(renderPageList(result.pages || []));
    section.appendChild(renderRepeatedFindings(result.repeatedFindings || []));
    section.appendChild(renderStringDetails("Limits and limitations", result.limitations || []));
    section.appendChild(renderCommandBlock("CLI equivalent", review.commands && review.commands.crawl));
    return section;
  }

  function renderSmellsSection(review) {
    var section = createSection("Project smells", "Generated-site implementation review signals", "Heuristic implementation signals, not authorship detection.");
    var check = review.checks && review.checks.smells;
    if (!check) {
      section.appendChild(emptyCheck("Add a project folder and run this read-only check to inspect implementation signals.", "smells", !(review.input && review.input.repoPath)));
      return section;
    }
    if (appendCheckErrorOrSkipped(section, check, "smells")) return section;

    var result = check.result;
    section.appendChild(renderMetricGrid([
      ["Status", result.summary.status],
      ["Findings", String(result.summary.findingCount)],
      ["Scanned files", String(result.scanned.files)],
      ["Framework", result.framework.name],
    ]));
    var list = el("div", "section-grid");
    (result.findings || []).slice(0, 5).forEach(function (finding) {
      var card = el("article", "card");
      var header = el("div", "card-title-row");
      header.appendChild(el("h3", "", finding.title));
      header.appendChild(badge(finding.severity + " / " + finding.confidence, finding.severity === "high" || finding.severity === "medium" ? "caution" : "muted"));
      card.appendChild(header);
      card.appendChild(el("p", "", finding.whyItMatters || ""));
      card.appendChild(keyValue("Next action", finding.nextAction || "Review manually."));
      if (finding.evidence && finding.evidence[0]) {
        card.appendChild(keyValue("Evidence", evidenceText(finding.evidence[0])));
      }
      list.appendChild(card);
    });
    section.appendChild(list);
    section.appendChild(renderStringDetails("Limitations", result.limitations || []));
    if (review.commands && review.commands.smells) section.appendChild(renderCommandBlock("CLI equivalent", review.commands.smells));
    return section;
  }

  function renderDnsSection(review) {
    var section = createSection("DNS status", "Read-only domain readiness evidence", "Resolver observations only. ShipReady does not write DNS records or call provider APIs.");
    var check = review.checks && review.checks.dns;
    if (!check) {
      section.appendChild(emptyCheck("Run DNS status when you want read-only domain evidence next to the launch review.", "dns"));
      return section;
    }
    if (appendCheckErrorOrSkipped(section, check, "dns")) return section;
    var result = check.result;
    section.appendChild(renderMetricGrid([
      ["Verdict", result.verdict.status],
      ["Mode", result.mode],
      ["Domain", result.domain],
      ["Hosts checked", String(result.hosts.length)],
    ]));
    section.appendChild(renderStringDetails("Limitations", result.limitations || []));
    section.appendChild(renderCommandBlock("CLI equivalent", review.commands && review.commands.dnsStatus));
    return section;
  }

  function renderSearchConsoleSection(review) {
    var section = createSection("Search Console mock status", "Mock-backed indexing-readiness context", "Search Console status is mock-backed only. No Google OAuth, tokens, or live Google API calls.");
    var check = review.checks && review.checks.searchConsole;
    if (!check) {
      section.appendChild(emptyCheck("Run this mock-backed status check to see how the Search Console surface is represented today.", "searchConsole"));
      return section;
    }
    if (appendCheckErrorOrSkipped(section, check, "searchConsole")) return section;
    var result = check.result;
    section.appendChild(renderMetricGrid([
      ["Mode", result.mode],
      ["Authorization", result.authorization.status],
      ["Property", result.propertyMatch.status],
      ["Sitemaps", result.sitemaps.status],
    ]));
    section.appendChild(renderStringDetails("Limitations", result.limitations || []));
    section.appendChild(renderCommandBlock("CLI equivalent", review.commands && review.commands.searchConsoleStatus));
    return section;
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
    var section = createSection("Fix plan", "Safe, review-required, and manual work", "");
    var groups = el("div", "action-groups");
    groups.appendChild(renderActionGroup("Safe to apply", actionGroups.safeToApply || [], "No safe automatic changes."));
    groups.appendChild(renderActionGroup("Needs review", actionGroups.needsReview || [], "No generated changes need review."));
    groups.appendChild(renderActionGroup("Manual only", actionGroups.manualOnly || [], "No manual-only actions."));
    groups.appendChild(renderIssueList("Already good", actionGroups.alreadyGood || [], "No passed checks available.", true));
    groups.appendChild(renderIssueList("Optional polish", actionGroups.optionalPolish || [], "No optional polish actions.", true));
    section.appendChild(groups);
    return section;
  }

  function renderActionGroup(title, actions, emptyText) {
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
        card.appendChild(keyValue("GUI action", action.canApplyInV1 ? "Copy guarded command only" : "Review outside the GUI"));
        if (action.reviewReason) card.appendChild(keyValue("Review note", action.reviewReason));
        content.appendChild(card);
      });
    }
    return renderDetails(title + " (" + actions.length + ")", [content], actions.length > 0);
  }

  function renderPatchPreview(patchPreview) {
    if (!patchPreview || !patchPreview.hasPreview) {
      return createSection("Patch preview", "No patch preview", "No file changes were generated for this report.");
    }
    var section = createSection("Patch preview", "Files ShipReady would create or update", "No files have been changed. Diffs stay collapsed until a developer needs them.");
    var list = el("div", "patch-list");
    (patchPreview.fileChanges || []).forEach(function (change) {
      var card = el("article", "card patch-card");
      var header = el("div", "card-title-row");
      header.appendChild(el("h3", "wrap-safe", change.path || "Unknown file"));
      header.appendChild(badge(change.eligibleForWrite ? wouldChangeLabel(change.changeType) : "Blocked from safe apply", change.eligibleForWrite ? "positive" : "caution"));
      card.appendChild(header);
      card.appendChild(keyValue("Risk", change.risk || "unknown"));
      card.appendChild(keyValue("Review", reviewStatusLabel(change.reviewStatus)));
      card.appendChild(keyValue("Eligibility", change.eligibleForWrite ? "Safe crawl-file candidate" : "Needs human review"));
      if (change.writeBlockReason) card.appendChild(keyValue("Block reason", change.writeBlockReason));
      card.appendChild(renderDetails("View diff", [pre(change.diff || "No diff was produced for this file change.")], false, "diff-details"));
      list.appendChild(card);
    });
    section.appendChild(list);
    if (patchPreview.skippedActions && patchPreview.skippedActions.length > 0) {
      section.appendChild(renderStringDetails("Actions without a file diff", patchPreview.skippedActions.map(function (action) {
        return (action.title || "Skipped action") + ": " + (action.reason || "");
      })));
    }
    return section;
  }

  function renderPrDraftHandoff(review) {
    if (!(review.input && review.input.repoPath)) {
      var urlOnly = createSection("PR draft handoff", "No local project folder", "Add a project folder before preparing a pull request draft handoff.");
      urlOnly.appendChild(notice("GitHub PR creation is not implemented in the GUI."));
      return urlOnly;
    }
    var section = createSection("PR draft handoff", "Copy a review-only PR draft command", "This prepares PR title/body/checklists as a local review artifact. It does not create a PR, branch, commit, push, deployment, or GitHub update.");
    section.appendChild(renderCommandBlock("GitHub PR draft CLI command", review.commands && review.commands.githubPrDraft));
    section.appendChild(renderStringList([
      "Copy-only command handoff.",
      "Live GitHub PR creation is not implemented.",
      "No GitHub API calls, Git commands, branch creation, commits, pushes, or deploys.",
      "Patch export remains review-only and requires human review.",
    ], "No PR draft safety notes.", "file-chip-list"));
    return section;
  }

  function renderSafeApply(review, report) {
    var safeApply = report && report.safeApply;
    var input = report && report.input ? report.input : {};

    if (!input.repoPath) {
      var urlOnly = createSection("Safe-write handoff", "No local files inspected", "This URL-only check did not inspect a project folder or preview local file changes.");
      urlOnly.appendChild(notice("The GUI did not change files. Safe crawl-file creation remains a guarded CLI workflow after a repo-based dry run."));
      return urlOnly;
    }

    if (!safeApply || !safeApply.available) {
      var unavailable = createSection("Safe-write handoff", "No safe automatic fix available", safeApply && safeApply.explanation ? safeApply.explanation : "No dry-run file change currently qualifies for V1 safe apply.");
      unavailable.appendChild(renderTrustRow());
      return unavailable;
    }

    var section = createSection("Safe-write handoff", "Safe crawl files ready to create", "The GUI can only copy the guarded command. It does not execute writes.", "safe-apply-section");
    section.appendChild(renderStringList(safeApply.eligibleFiles || [], "No eligible files.", "file-chip-list"));
    var command = "pnpm shipready fix " + formatCommandArg(input.repoPath || ".") + " --url " + formatCommandArg(input.url || "") + " --write --allow-create";
    section.appendChild(renderCommandBlock("Guarded CLI command", command));
    section.appendChild(renderTrustRow());
    section.appendChild(renderStringDetails("Safe-write policy notes", safeApply.safetyNotes || []));
    return section;
  }

  function renderRecheckSection(review) {
    var section = createSection("Post-deploy recheck", "Verify public crawl-file evidence after external deployment", "Recheck is read-only and does not deploy. Local files do not change the live site until externally deployed.");
    var check = review.checks && review.checks.recheck;
    if (check) {
      if (!appendCheckErrorOrSkipped(section, check, "recheck")) {
        var result = check.result;
        section.appendChild(renderMetricGrid([
          ["Verdict", result.verdict.status],
          ["Deployment", result.deployment.status],
          ["Mode", result.mode],
          ["Robots", result.live.robots.status],
          ["Sitemap", result.live.sitemap.status],
        ]));
        section.appendChild(renderStringDetails("Limitations", result.limitations || []));
      }
    } else {
      section.appendChild(emptyCheck("Run recheck after an external deployment to compare public evidence.", "recheck"));
    }
    section.appendChild(renderCommandBlock("CLI equivalent", review.commands && review.commands.recheck));
    return section;
  }

  function renderSafetySection(review) {
    var section = createSection("Safety and limits", "What this local GUI will not do", "The cockpit is a read-only review surface with copy-only command handoffs.");
    section.appendChild(renderStringList(review.safety || [
      "No deploys.",
      "No Git/GitHub actions.",
      "No GitHub PR creation.",
      "No metadata/content/JSON-LD writes.",
      "No DNS writes.",
      "Search Console remains mock-backed.",
    ], "No safety notes.", "file-chip-list"));
    return section;
  }

  function renderDeveloperDetails(review) {
    return renderDetails("Developer details", [
      el("p", "", "Schema version: " + (review.schemaVersion || "unknown")),
      pre(JSON.stringify(review, null, 2)),
    ], false, "developer-details");
  }

  function emptyCheck(message, checkName, disabled) {
    var card = el("article", "quiet-card");
    card.appendChild(el("p", "", message));
    var button = el("button", "secondary-action", disabled ? "Add repo path first" : "Run read-only check");
    button.type = "button";
    button.disabled = Boolean(disabled);
    button.setAttribute("data-run-check", checkName);
    card.appendChild(button);
    return card;
  }

  function appendCheckErrorOrSkipped(section, check, checkName) {
    if (check.status === "error") {
      section.appendChild(notice(check.error && check.error.message ? check.error.message : "Read-only check failed."));
      section.appendChild(emptyCheck("You can retry this read-only check without changing files.", checkName));
      return true;
    }
    if (check.status === "skipped") {
      section.appendChild(notice(check.message || "This check was skipped."));
      return true;
    }
    return false;
  }

  function renderPageList(pages) {
    var content = el("div", "section-grid");
    pages.slice(0, 6).forEach(function (page) {
      var card = el("article", "card");
      card.appendChild(el("h4", "wrap-safe", page.title || page.url || "Page"));
      card.appendChild(keyValue("URL", page.url || ""));
      card.appendChild(keyValue("Status", page.status || "unknown"));
      card.appendChild(keyValue("Top issues", page.issueSummary && page.issueSummary.topIssueTitles ? page.issueSummary.topIssueTitles.join(", ") : "None reported"));
      content.appendChild(card);
    });
    return renderDetails("Pages checked (" + pages.length + ")", [content], pages.length > 0);
  }

  function renderRepeatedFindings(findings) {
    if (!findings.length) return notice("No repeated findings were reported across the bounded sample.");
    var content = el("div", "section-grid");
    findings.slice(0, 5).forEach(function (finding) {
      var card = el("article", "card");
      card.appendChild(el("h4", "", finding.title || "Repeated finding"));
      card.appendChild(el("p", "", finding.message || ""));
      card.appendChild(keyValue("Affected URLs", finding.affectedPages ? finding.affectedPages.slice(0, 5).join(", ") : "Not reported"));
      content.appendChild(card);
    });
    return renderDetails("Repeated findings (" + findings.length + ")", [content], true);
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
    return renderStringDetails(title, issues.map(function (issue) {
      return issue.title || issue.explanation || "Warning";
    }));
  }

  function renderFactCard(title, value) {
    var card = el("article", "card");
    card.appendChild(el("p", "field-label", title));
    card.appendChild(el("h3", "wrap-safe", value || "Not reported"));
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
    if (!value) field.lastChild.classList.add("empty");
    return field;
  }

  function renderStringDetails(title, items) {
    return renderDetails(title + " (" + (items ? items.length : 0) + ")", [
      renderStringList(items || [], "None reported.", "compact-list"),
    ], false);
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
    ["No overwrites", "No metadata or content edits", "No Git/GitHub actions", "No deploys"].forEach(function (item) {
      list.appendChild(el("li", "", item));
    });
    return list;
  }

  function renderCommandBlock(label, command) {
    var wrapper = el("div", "command-block");
    wrapper.appendChild(el("p", "field-label command-label", label));
    if (!command) {
      wrapper.appendChild(el("p", "empty", "No command available."));
      return wrapper;
    }
    var row = el("div", "command-row");
    row.appendChild(pre(command));
    var button = el("button", "copy-command", "Copy command");
    button.type = "button";
    button.setAttribute("data-copy-command", command);
    var status = el("span", "copy-status", "");
    status.setAttribute("aria-live", "polite");
    row.appendChild(button);
    wrapper.appendChild(row);
    wrapper.appendChild(status);
    return wrapper;
  }

  async function copyCommand(button) {
    var command = button.getAttribute("data-copy-command") || "";
    var status = button.parentElement && button.parentElement.nextSibling;
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      if (status) status.textContent = "Copy unavailable; select the command manually.";
      return;
    }
    try {
      await navigator.clipboard.writeText(command);
      button.textContent = "Copied";
      if (status) status.textContent = "Command copied. The GUI did not run it.";
    } catch (_error) {
      if (status) status.textContent = "Copy unavailable; select the command manually.";
    }
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
    item.appendChild(el("span", "wrap-safe", value || "Not reported"));
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
    if (report && report.safeApply && report.safeApply.available) return "Copy the safe-write command when you are ready.";
    if (!report || !report.input || !report.input.repoPath) return "Add a project folder to preview file-level fixes.";
    return "Review the generated guidance before changing local files.";
  }

  function loadingText(checkName) {
    if (checkName === "socialPreview") return "Simulating preview inputs...";
    if (checkName === "crawl") return "Running the bounded same-origin sample...";
    if (checkName === "smells") return "Scanning project review signals...";
    if (checkName === "dns") return "Reading DNS evidence...";
    if (checkName === "searchConsole") return "Loading mock-backed Search Console status...";
    if (checkName === "recheck") return "Rechecking public crawl-file evidence...";
    return "Loading read-only evidence...";
  }

  function normalizeUiError(error) {
    return {
      message: error && error.message ? error.message : "ShipReady could not reach the local UI server.",
      stage: error && error.stage ? error.stage : "network",
      details: error && error.details !== undefined ? error.details : undefined,
    };
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
    if (label === "ready") return "Ready to share";
    if (label === "almost_ready") return "Almost ready";
    if (label === "needs_attention") return "Needs attention";
    return "Unknown";
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
    if (safeApply && safeApply.available) return "Copy-only safe-write handoff";
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

  function resourceText(resource) {
    if (!resource) return "Not checked";
    if (resource.exists) return "Present";
    if (resource.statusCode) return "Not observed (HTTP " + resource.statusCode + ")";
    if (resource.error) return "Unreachable";
    return "Not observed";
  }

  function fieldValue(preview, field) {
    return preview && preview.fields && preview.fields[field] ? preview.fields[field].value : undefined;
  }

  function evidenceText(evidence) {
    var parts = [];
    if (evidence.path) parts.push(evidence.path);
    if (evidence.line) parts.push("line " + evidence.line);
    if (evidence.message) parts.push(evidence.message);
    return parts.join(" · ") || evidence.valuePreview || "Evidence reported";
  }

  function formatCommandArg(value) {
    value = String(value || "");
    if (/^[A-Za-z0-9_./:@-]+$/.test(value)) return value;
    return "'" + value.split("'").join("'\\\\''") + "'";
  }
})();
`;
