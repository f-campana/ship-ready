export const GUI_CSS = `
:root {
  color-scheme: light;
  --bg: #f5f6f8;
  --paper: #ffffff;
  --paper-soft: #fafbfc;
  --text: #20242a;
  --muted: #68717d;
  --muted-strong: #4f5965;
  --line: #dfe4ea;
  --line-strong: #c7d0da;
  --positive-bg: #e8f6ed;
  --positive-text: #155c35;
  --caution-bg: #fff4dc;
  --caution-text: #744a00;
  --attention-bg: #fff0ed;
  --attention-text: #953124;
  --info-bg: #edf5ff;
  --info-text: #285789;
  --code-bg: #171b21;
  --code-text: #edf1f5;
  --shadow: 0 14px 32px rgba(32, 36, 42, 0.07);
}

* {
  box-sizing: border-box;
}

[hidden] {
  display: none !important;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 15px;
  line-height: 1.6;
}

button,
input {
  font: inherit;
}

button {
  min-height: 42px;
  border-radius: 8px;
  border: 1px solid var(--line-strong);
  padding: 9px 15px;
  cursor: pointer;
  font-weight: 650;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

input {
  width: 100%;
  min-height: 44px;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  padding: 9px 11px;
  color: var(--text);
  background: #fff;
}

input:focus,
button:focus-visible,
summary:focus-visible {
  outline: 3px solid rgba(40, 87, 137, 0.22);
  outline-offset: 2px;
}

h1,
h2,
h3,
h4,
p {
  margin-top: 0;
}

h1 {
  max-width: 780px;
  margin-bottom: 10px;
  font-size: 32px;
  line-height: 1.16;
  letter-spacing: 0;
}

h2 {
  margin-bottom: 8px;
  font-size: 22px;
  line-height: 1.25;
  letter-spacing: 0;
}

h3 {
  margin-bottom: 8px;
  font-size: 17px;
  line-height: 1.3;
  letter-spacing: 0;
}

h4 {
  margin-bottom: 6px;
  font-size: 15px;
  line-height: 1.35;
  letter-spacing: 0;
}

pre {
  overflow: auto;
  max-width: 100%;
  margin: 0;
  border-radius: 8px;
  padding: 14px;
  background: var(--code-bg);
  color: var(--code-text);
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

summary {
  cursor: pointer;
}

.shell {
  width: min(1180px, calc(100% - 32px));
  margin: 0 auto;
  padding: 32px 0 64px;
}

.connect-panel,
.decision-panel,
.section,
.status-panel,
.error-panel {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--paper);
  box-shadow: var(--shadow);
}

.connect-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 430px);
  gap: 28px;
  align-items: start;
  padding: 28px;
  border-top: 5px solid #2d6f88;
}

.connect-copy p {
  max-width: 620px;
  color: var(--muted-strong);
}

.eyebrow,
.field-label,
.decision-label {
  margin-bottom: 6px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 750;
  letter-spacing: 0;
  text-transform: uppercase;
}

.connect-form {
  display: grid;
  gap: 14px;
}

.connect-form label {
  display: grid;
  gap: 6px;
  color: var(--muted-strong);
  font-weight: 650;
}

.connect-form small {
  color: var(--muted);
  font-weight: 500;
}

.button-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.primary-action {
  border-color: #245d73;
  background: #245d73;
  color: #fff;
}

.secondary-action,
.copy-command {
  background: #fff;
  color: var(--text);
}

.status-panel,
.error-panel {
  margin-top: 18px;
  padding: 18px;
}

.status-panel {
  border-left: 5px solid #2d6f88;
}

.error-panel {
  border-left: 5px solid #963022;
}

.error-panel h2 {
  color: var(--attention-text);
}

.flow-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 18px 0;
}

.flow-strip span,
.badge {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  border-radius: 999px;
  padding: 4px 10px;
  background: #fff;
  border: 1px solid var(--line);
  color: var(--muted-strong);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.2;
}

.report {
  display: grid;
  gap: 18px;
}

.decision-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 340px);
  gap: 24px;
  padding: 26px;
}

.decision-panel.positive {
  border-top: 5px solid #2d8a57;
}

.decision-panel.caution {
  border-top: 5px solid #c0841a;
}

.decision-panel.attention {
  border-top: 5px solid #c84a36;
}

.decision-summary {
  display: grid;
  gap: 12px;
  align-content: start;
}

.decision-card {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 18px;
  background: var(--paper-soft);
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

.metric {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 12px;
  background: #fff;
}

.metric span,
.field-label {
  display: block;
}

.metric strong {
  display: block;
  margin-top: 3px;
  line-height: 1.3;
}

.section {
  padding: 24px;
}

.safe-apply-section {
  border-top: 5px solid #2d8a57;
  background: linear-gradient(180deg, var(--positive-bg) 0, var(--paper) 150px);
}

.section-heading {
  margin-bottom: 18px;
}

.section-heading p:not(.eyebrow) {
  max-width: 760px;
  color: var(--muted-strong);
}

.section-grid,
.guided-grid,
.preview-grid,
.project-grid,
.action-groups {
  display: grid;
  gap: 14px;
}

.guided-grid {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.section-grid.two,
.preview-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.project-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.card,
.quiet-card,
.file-summary-row {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
}

.card,
.quiet-card {
  padding: 16px;
}

.card-title-row,
.subsection-heading,
.patch-meta-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.card-title-row h3,
.card-title-row h4,
.subsection-heading h3 {
  margin-bottom: 0;
}

.issue-card p,
.action-card p,
.preview-card p,
.quiet-card p {
  color: var(--muted-strong);
}

.badge.positive {
  background: var(--positive-bg);
  border-color: #b9e5c8;
  color: var(--positive-text);
}

.badge.caution {
  background: var(--caution-bg);
  border-color: #f0d292;
  color: var(--caution-text);
}

.badge.attention {
  background: var(--attention-bg);
  border-color: #efb8af;
  color: var(--attention-text);
}

.badge.muted {
  background: #f2f4f7;
  color: var(--muted-strong);
}

.badge.info {
  background: var(--info-bg);
  border-color: #c9def5;
  color: var(--info-text);
}

.compact-list,
.quiet-list,
.file-chip-list {
  margin: 0;
  padding-left: 19px;
}

.compact-list li,
.quiet-list li,
.file-chip-list li {
  margin: 6px 0;
}

.empty,
.muted-text {
  color: var(--muted);
}

.field {
  margin-top: 12px;
}

.field p {
  margin-bottom: 0;
}

.missing-fields,
.notice,
.local-warning {
  margin-top: 14px;
  border-radius: 8px;
  padding: 13px 14px;
}

.missing-fields {
  background: #f7f8fa;
  border: 1px solid var(--line);
}

.notice {
  border: 1px solid #c9def5;
  background: var(--info-bg);
  color: var(--info-text);
}

.local-warning {
  border: 1px solid #f0d292;
  border-left: 5px solid #c0841a;
  background: var(--caution-bg);
  color: var(--caution-text);
}

.local-warning strong {
  display: block;
  margin-bottom: 4px;
}

.local-warning p {
  margin-bottom: 0;
}

.badge-row,
.file-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.group-details,
.developer-details,
.diff-details {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
}

.group-details summary,
.developer-details summary,
.diff-details summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 15px;
  font-weight: 750;
}

.group-details-content,
.developer-details-content,
.diff-details pre {
  border-top: 1px solid var(--line);
}

.group-details-content,
.developer-details-content {
  display: grid;
  gap: 12px;
  padding: 14px;
}

.file-summary-list,
.patch-list {
  display: grid;
  gap: 10px;
}

.file-summary-list {
  margin-bottom: 14px;
}

.file-summary-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
}

.patch-card {
  display: grid;
  gap: 12px;
}

.patch-meta-row {
  justify-content: flex-start;
  flex-wrap: wrap;
  color: var(--muted-strong);
  font-size: 13px;
}

.key-value {
  margin: 0;
  color: var(--muted-strong);
}

.key-value span:first-child {
  font-weight: 750;
  color: var(--text);
}

.command-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: start;
}

.command-block {
  margin-top: 14px;
}

.command-label {
  margin-top: 18px;
}

.copy-command {
  min-width: 132px;
}

.copy-status {
  display: block;
  min-height: 24px;
  margin-top: 6px;
  color: var(--positive-text);
  font-size: 13px;
  font-weight: 650;
}

.developer-details {
  box-shadow: var(--shadow);
}

.wrap-safe {
  overflow-wrap: anywhere;
  word-break: break-word;
}

@media (max-width: 860px) {
  .connect-panel,
  .decision-panel,
  .section-grid.two,
  .preview-grid,
  .project-grid {
    grid-template-columns: 1fr;
  }

  .metric-grid {
    grid-template-columns: 1fr;
  }

  .file-summary-row,
  .command-row {
    grid-template-columns: 1fr;
  }

  .shell {
    width: min(100% - 22px, 1180px);
    padding-top: 18px;
  }

  h1 {
    font-size: 26px;
  }
}
`;
