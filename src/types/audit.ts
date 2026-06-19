import { z } from "zod";

export const OpenGraphMetadataSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  image: z.string().optional(),
  url: z.string().optional(),
  type: z.string().optional(),
  siteName: z.string().optional(),
});

export const TwitterMetadataSchema = z.object({
  card: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  image: z.string().optional(),
});

export const PageMetadataSchema = z.object({
  htmlLang: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  viewport: z.string().optional(),
  robots: z.string().optional(),
  canonical: z.string().optional(),
  favicon: z.string().optional(),
  faviconLinks: z.array(z.string()),
  themeColor: z.string().optional(),
  openGraph: OpenGraphMetadataSchema,
  twitter: TwitterMetadataSchema,
});

export const HeadingSchema = z.object({
  level: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
  text: z.string(),
});

export const ExtractedHeadingsSchema = z.object({
  h1: z.array(z.string()),
  all: z.array(HeadingSchema),
});

export const ExtractedImagesSchema = z.object({
  total: z.number(),
  missingAlt: z.number(),
  items: z.array(
    z.object({
      src: z.string().optional(),
      alt: z.string().optional(),
      role: z.string().optional(),
      ariaHidden: z.boolean().optional(),
    }),
  ),
});

export const ExtractedLinksSchema = z.object({
  total: z.number(),
  missingAccessibleText: z.number(),
  items: z.array(
    z.object({
      href: z.string().optional(),
      text: z.string(),
      ariaLabel: z.string().optional(),
      title: z.string().optional(),
    }),
  ),
});

export const JsonLdBlockSchema = z.object({
  raw: z.string(),
  valid: z.boolean(),
  parsed: z.unknown().optional(),
  error: z.string().optional(),
  types: z.array(z.string()),
});

export const ExtractedPageMetadataSchema = z.object({
  source: z.enum(["raw", "rendered"]),
  url: z.string(),
  metadata: PageMetadataSchema,
  headings: ExtractedHeadingsSchema,
  images: ExtractedImagesSchema,
  links: ExtractedLinksSchema,
  jsonLd: z.array(JsonLdBlockSchema),
});

export const ComparisonFieldSchema = z.object({
  field: z.string(),
  rawValue: z.string().optional(),
  renderedValue: z.string().optional(),
  status: z.enum([
    "missing_in_both",
    "present_in_raw",
    "present_after_render_only",
    "changed_after_render",
  ]),
});

export const RawRenderedComparisonSchema = z.object({
  fields: z.array(ComparisonFieldSchema),
});

export const AuditCheckSchema = z.object({
  id: z.string(),
  category: z.enum([
    "metadata",
    "social",
    "schema",
    "crawlability",
    "structure",
    "accessibility",
    "launch_hygiene",
  ]),
  severity: z.enum(["critical", "warning", "info", "passed"]),
  title: z.string(),
  description: z.string(),
  evidence: z.record(z.string(), z.unknown()).optional(),
  recommendation: z.string().optional(),
  confidence: z.enum(["high", "medium", "low"]),
  fixability: z.enum(["auto_fixable", "plan_only", "manual", "not_fixable"]),
  fixStrategy: z.string().optional(),
});

export const ResourceCheckSchema = z.object({
  url: z.string(),
  finalUrl: z.string().optional(),
  exists: z.boolean(),
  ok: z.boolean(),
  statusCode: z.number().optional(),
  error: z.string().optional(),
  blocksPage: z.boolean().optional(),
  includesAuditedUrl: z.boolean().optional(),
});

export const AuditResourcesSchema = z.object({
  robotsTxt: ResourceCheckSchema,
  sitemapXml: ResourceCheckSchema,
});

export const AuditResultSchema = z.object({
  url: z.string(),
  finalUrl: z.string(),
  auditedAt: z.string(),
  httpStatus: z.number().optional(),
  score: z.number(),
  status: z.enum(["good", "needs_work", "critical"]),
  raw: ExtractedPageMetadataSchema,
  rendered: ExtractedPageMetadataSchema,
  comparison: RawRenderedComparisonSchema,
  checks: z.array(AuditCheckSchema),
  resources: AuditResourcesSchema,
});

export type OpenGraphMetadata = z.infer<typeof OpenGraphMetadataSchema>;
export type TwitterMetadata = z.infer<typeof TwitterMetadataSchema>;
export type PageMetadata = z.infer<typeof PageMetadataSchema>;
export type ExtractedHeadings = z.infer<typeof ExtractedHeadingsSchema>;
export type ExtractedImages = z.infer<typeof ExtractedImagesSchema>;
export type ExtractedLinks = z.infer<typeof ExtractedLinksSchema>;
export type JsonLdBlock = z.infer<typeof JsonLdBlockSchema>;
export type ExtractedPageMetadata = z.infer<typeof ExtractedPageMetadataSchema>;
export type ComparisonField = z.infer<typeof ComparisonFieldSchema>;
export type RawRenderedComparison = z.infer<typeof RawRenderedComparisonSchema>;
export type AuditCheck = z.infer<typeof AuditCheckSchema>;
export type ResourceCheck = z.infer<typeof ResourceCheckSchema>;
export type AuditResources = z.infer<typeof AuditResourcesSchema>;
export type AuditResult = z.infer<typeof AuditResultSchema>;

