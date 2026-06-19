import { z } from "zod";

export const PackageManagerSchema = z.enum(["pnpm", "npm", "yarn", "bun", "unknown"]);

export const FrameworkIdSchema = z.enum([
  "next_app_router",
  "next_pages_router",
  "vite_react",
  "astro",
  "remix",
  "static_html",
  "unknown",
]);

export const FrameworkConfidenceSchema = z.enum(["high", "medium", "low"]);

export const EvidenceItemSchema = z.object({
  kind: z.enum([
    "package_dependency",
    "config_file",
    "directory",
    "file",
    "source_pattern",
    "lockfile",
  ]),
  path: z.string().optional(),
  value: z.string(),
  weight: z.enum(["strong", "medium", "weak"]),
});

export const DetectedFrameworkSchema = z.object({
  id: FrameworkIdSchema,
  name: z.string(),
  confidence: FrameworkConfidenceSchema,
  evidence: z.array(EvidenceItemSchema),
});

export const ImportantFileSchema = z.object({
  path: z.string(),
  kind: z.enum([
    "package_file",
    "lockfile",
    "config_file",
    "directory",
    "route_file",
    "metadata_file",
    "public_asset",
    "source_file",
  ]),
  reason: z.string(),
});

export const RouteCandidateSchema = z.object({
  path: z.string(),
  route: z.string().optional(),
  kind: z.enum(["page", "layout", "route_module", "app_entry", "html_page", "unknown"]),
  confidence: z.enum(["high", "medium", "low"]),
  reason: z.string(),
});

export const MetadataLocationSchema = z.object({
  path: z.string(),
  kind: z.enum(["file", "directory", "pattern", "source_pattern"]),
  exists: z.boolean(),
  reason: z.string(),
});

export const SupportedFixSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  safety: z.enum(["safe", "review_required", "unsupported"]),
});

export const RepoInspectionResultSchema = z.object({
  path: z.string(),
  inspectedAt: z.string(),
  packageManager: PackageManagerSchema,
  framework: DetectedFrameworkSchema,
  importantFiles: z.array(ImportantFileSchema),
  routes: z.array(RouteCandidateSchema),
  metadataLocations: z.array(MetadataLocationSchema),
  supportedFixes: z.array(SupportedFixSchema),
  limitations: z.array(z.string()),
  warnings: z.array(z.string()),
});

export type PackageManager = z.infer<typeof PackageManagerSchema>;
export type FrameworkId = z.infer<typeof FrameworkIdSchema>;
export type FrameworkConfidence = z.infer<typeof FrameworkConfidenceSchema>;
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;
export type DetectedFramework = z.infer<typeof DetectedFrameworkSchema>;
export type ImportantFile = z.infer<typeof ImportantFileSchema>;
export type RouteCandidate = z.infer<typeof RouteCandidateSchema>;
export type MetadataLocation = z.infer<typeof MetadataLocationSchema>;
export type SupportedFix = z.infer<typeof SupportedFixSchema>;
export type RepoInspectionResult = z.infer<typeof RepoInspectionResultSchema>;
