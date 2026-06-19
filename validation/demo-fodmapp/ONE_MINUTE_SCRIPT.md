# ShipReady Fodmapp One-Minute Script

“A site can look finished in the browser and still have launch-readiness gaps in what crawlers and preview bots see. Here’s Fodmapp, already live, connected to its local Next.js project.

I’ll run ShipReady against the live URL and local repo. The result is **Needs attention before launch**. The useful part is that ShipReady separates review items from the narrow changes it can handle safely.

For this project, safe apply is available only for two missing crawl files: `app/robots.ts` and `app/sitemap.ts`. We can preview exactly what would be created before doing anything.

The safety boundary is explicit: creation-only, no overwrites, no metadata or content edits, no package or config changes, no commits, and no deploys. The GUI itself does not write files. It only lets me copy this guarded CLI command.

From there, the developer can run it intentionally, review the two local files, deploy through their normal process, and re-check what the live site serves. ShipReady makes the site ready to share and index with a small, auditable next step.”
