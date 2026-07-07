export function renderGuiHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ShipReady local review cockpit</title>
  <link rel="stylesheet" href="/assets/gui.css">
  <script defer src="/assets/gui.js"></script>
</head>
<body>
  <main class="shell">
    <header class="connect-panel">
      <div class="connect-copy">
        <p class="eyebrow">ShipReady local review cockpit</p>
        <h1>See what the internet sees before you launch.</h1>
        <p>Review launch-readiness, preview-bot inputs, bounded crawl evidence, project signals, and safe crawl-file handoffs without changing files.</p>
      </div>
      <form class="connect-form" data-connect-form novalidate>
        <label>
          <span>Website URL</span>
          <input name="url" type="text" inputmode="url" placeholder="https://example.com" autocomplete="url" required>
        </label>
        <label>
          <span>Local repo path <small>optional</small></span>
          <input name="repoPath" type="text" placeholder="/path/to/repo" autocomplete="off">
        </label>
        <div class="button-row">
          <button type="submit" class="primary-action">Check site</button>
          <button type="button" class="secondary-action" data-url-only>URL-only check</button>
        </div>
      </form>
    </header>

    <section class="status-panel" data-status hidden aria-live="polite"></section>
    <section class="error-panel" data-error hidden aria-live="polite"></section>

    <nav class="flow-strip" aria-label="Report sections">
      <span>1 · Connect</span>
      <span>2 · Overview</span>
      <span>3 · Load read-only evidence</span>
      <span>4 · Copy commands only</span>
    </nav>

    <section class="report" data-report hidden>
      <section class="section"><h2>Local review cockpit</h2></section>
      <section class="section"><h2>Guided actions</h2></section>
      <section class="section"><h2>What the internet sees</h2></section>
      <section class="section"><h2>Preview simulator</h2></section>
      <section class="section"><h2>Small-site crawl</h2></section>
      <section class="section"><h2>Project smells</h2></section>
      <section class="section"><h2>DNS status</h2></section>
      <section class="section"><h2>Search Console mock status</h2></section>
      <section class="section"><h2>Project understanding</h2></section>
      <section class="section"><h2>Fix plan</h2></section>
      <section class="section"><h2>Patch preview</h2></section>
      <section class="section"><h2>Safe-write handoff</h2></section>
      <section class="section"><h2>Post-deploy recheck</h2></section>
      <section class="section"><h2>Safety and limits</h2></section>
      <details class="developer-details">
        <summary>Developer details</summary>
        <pre></pre>
      </details>
    </section>
  </main>
</body>
</html>`;
}
