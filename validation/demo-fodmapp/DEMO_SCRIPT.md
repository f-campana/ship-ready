# Fodmapp Demo Script

## Opening

“AI-generated sites can look ready, but still miss small launch-readiness details that crawlers and preview bots rely on. Fodmapp is already live and looks usable, so let’s check what those systems can actually see.”

## Action

“I’ll enter `fodmapp.fr` and connect its local Next.js project. ShipReady checks the live URL, reads the local project structure, and produces one launch-readiness report.”

Click **Check site**.

## Result

“ShipReady says this needs attention before launch, but it also identifies a narrow safe fix. The project is recognized as Next.js App Router, and two missing crawl files can be created safely: `app/robots.ts` and `app/sitemap.ts`.”

Show the preview and safe-apply section.

## Safety

“This is preview first. ShipReady will not overwrite files. It will not edit metadata or content. It will not commit, push, or deploy. The GUI itself does not write anything; it only shows the exact guarded command.”

Click **Copy command**.

## Close

“The user can copy this command, review the created files, deploy, then re-check the live site. Local files alone do not change what the live website serves.”
