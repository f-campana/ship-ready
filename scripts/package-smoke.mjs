#!/usr/bin/env node
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = await mkdtemp(join(tmpdir(), "shipready-package-smoke-"));
const packDir = join(tempRoot, "pack");
const consumerDir = join(tempRoot, "consumer");

let server;

try {
  await assertNoRepoTarballs("before smoke");
  await mkdir(packDir, { recursive: true });
  await mkdir(consumerDir, { recursive: true });
  await run("pnpm", ["build"], { cwd: repoRoot });
  await run("pnpm", ["pack", "--pack-destination", packDir], { cwd: repoRoot });

  const tarballPath = await findSingleTarball(packDir);
  if (basename(tarballPath) !== "ship-ready-cli-0.1.0.tgz") {
    throw new Error(`Expected scoped package tarball ship-ready-cli-0.1.0.tgz; found ${basename(tarballPath)}.`);
  }
  await writeFile(join(consumerDir, "package.json"), JSON.stringify({
    name: "shipready-package-smoke-consumer",
    private: true,
    type: "module",
  }, null, 2), "utf8");
  await run("pnpm", ["add", tarballPath, "--ignore-scripts"], { cwd: consumerDir });

  server = await startFixtureServer();
  const fixtureUrl = server.url;

  await run("pnpm", ["exec", "shipready", "--version"], { cwd: consumerDir });
  await runJson("pnpm", ["exec", "shipready", "status", "--json"], { cwd: consumerDir });
  await runJson("pnpm", ["exec", "shipready", "doctor", "--json"], { cwd: consumerDir });
  await runJson("pnpm", ["exec", "shipready", "audit", fixtureUrl, "--no-render", "--json"], { cwd: consumerDir });
  await run("pnpm", ["exec", "shipready", "tui", "--url", fixtureUrl, "--no-render"], {
    cwd: consumerDir,
    env: { CI: "true" },
  });

  await assertNoRepoTarballs("after smoke");
  process.stdout.write("ShipReady package smoke passed.\n");
} finally {
  await server?.close();
  await rm(tempRoot, { recursive: true, force: true });
}

async function run(command, args, options) {
  process.stdout.write(`$ ${command} ${args.join(" ")}\n`);
  try {
    const result = await execFileAsync(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      timeout: 120_000,
      maxBuffer: 20 * 1024 * 1024,
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    return result;
  } catch (error) {
    if (error.stdout) process.stdout.write(error.stdout);
    if (error.stderr) process.stderr.write(error.stderr);
    throw error;
  }
}

async function runJson(command, args, options) {
  const result = await run(command, args, options);
  JSON.parse(result.stdout);
  return result;
}

async function findSingleTarball(directory) {
  const names = await readdir(directory);
  const tarballs = names.filter((name) => name.endsWith(".tgz"));
  if (tarballs.length !== 1) {
    throw new Error(`Expected exactly one packed tarball in ${directory}; found ${tarballs.length}.`);
  }
  return join(directory, tarballs[0]);
}

async function assertNoRepoTarballs(label) {
  const tarballs = await findTarballs(repoRoot, 3);
  if (tarballs.length > 0) {
    throw new Error(`Unexpected package tarball(s) in repository ${label}: ${tarballs.join(", ")}`);
  }
}

async function findTarballs(directory, maxDepth, depth = 0) {
  if (depth > maxDepth) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  const found = [];

  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const path = join(directory, entry.name);
    if (entry.isFile() && entry.name.endsWith(".tgz")) {
      found.push(relative(repoRoot, path));
    } else if (entry.isDirectory()) {
      found.push(...await findTarballs(path, maxDepth, depth + 1));
    }
  }

  return found;
}

async function startFixtureServer() {
  const testServer = createServer(async (request, response) => {
    const host = request.headers.host;
    const baseUrl = `http://${host}`;

    if (request.url === "/robots.txt") {
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      response.end(`User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml\n`);
      return;
    }

    if (request.url === "/sitemap.xml") {
      response.writeHead(200, { "content-type": "application/xml; charset=utf-8" });
      response.end(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${baseUrl}/</loc></url></urlset>`);
      return;
    }

    if (request.url === "/og.png" || request.url === "/logo.png" || request.url === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }

    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(pageHtml(baseUrl));
  });

  await new Promise((resolveListen, rejectListen) => {
    testServer.once("error", rejectListen);
    testServer.listen(0, "127.0.0.1", resolveListen);
  });

  const address = testServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not bind local package-smoke fixture server.");
  }

  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise((resolveClose, rejectClose) => {
      testServer.close((error) => {
        if (error) rejectClose(error);
        else resolveClose();
      });
    }),
  };
}

function pageHtml(baseUrl) {
  return `<!doctype html>
<html lang="en">
  <head>
    <title>ShipReady package smoke fixture</title>
    <meta name="description" content="A deterministic local page for ShipReady package smoke checks.">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="index,follow">
    <link rel="canonical" href="${baseUrl}/">
    <meta property="og:title" content="ShipReady package smoke fixture">
    <meta property="og:description" content="A deterministic local page for smoke checks.">
    <meta property="og:image" content="${baseUrl}/og.png">
    <meta property="og:url" content="${baseUrl}/">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="ShipReady package smoke fixture">
    <meta name="twitter:description" content="A deterministic local page for smoke checks.">
    <meta name="twitter:image" content="${baseUrl}/og.png">
  </head>
  <body>
    <main>
      <h1>Package smoke fixture</h1>
      <img src="/logo.png" alt="ShipReady logo">
    </main>
  </body>
</html>`;
}
