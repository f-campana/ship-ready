import { auditUrl } from "../audit/auditUrl";
import type { AuditResult, ExtractedPageMetadata } from "../types/audit";
import {
  CONTRACT_NAMES,
  SocialPreviewJsonContractSchema,
  type CliErrorCode,
} from "../types/contracts";
import { normalizeAuditUrl } from "../utils/url";
import {
  createMockSocialPreviewAudit,
  parseSocialPreviewMockScenario,
} from "./mockSocialPreviewProvider";
import {
  SOCIAL_PREVIEW_SOURCE_MODES,
  SocialPreviewError,
  type SocialPreviewInput,
  type SocialPreviewResult,
  type SocialPreviewSourceMode,
} from "./socialPreviewTypes";

type SourceFieldName = SocialPreviewResult["fields"][number]["name"];
type FieldSource = SocialPreviewResult["fields"][number]["selectedSource"];
type FieldStatus = SocialPreviewResult["fields"][number]["status"];
type PreviewSurface = SocialPreviewResult["previews"][keyof SocialPreviewResult["previews"]];
type PreviewField = PreviewSurface["fields"]["title"];
type ImageField = NonNullable<PreviewSurface["fields"]["image"]>;
type AssetStatus = ImageField["assetStatus"];

type FieldDef = {
  name: SourceFieldName;
  getValue: (snapshot: ExtractedPageMetadata) => string | undefined;
};

type BuildInput = {
  audit: AuditResult;
  checkedAt: string;
  mode: SocialPreviewResult["mode"];
  sourceMode: SocialPreviewSourceMode;
  checkAssets: boolean;
  mockImageAssetStatus?: AssetStatus;
};

const SOURCE_FIELDS: FieldDef[] = [
  { name: "title", getValue: (snapshot) => snapshot.metadata.title },
  { name: "meta description", getValue: (snapshot) => snapshot.metadata.description },
  { name: "canonical", getValue: (snapshot) => snapshot.metadata.canonical },
  { name: "og:title", getValue: (snapshot) => snapshot.metadata.openGraph.title },
  { name: "og:description", getValue: (snapshot) => snapshot.metadata.openGraph.description },
  { name: "og:url", getValue: (snapshot) => snapshot.metadata.openGraph.url },
  { name: "og:image", getValue: (snapshot) => snapshot.metadata.openGraph.image },
  { name: "og:type", getValue: (snapshot) => snapshot.metadata.openGraph.type },
  { name: "og:site_name", getValue: (snapshot) => snapshot.metadata.openGraph.siteName },
  { name: "twitter:card", getValue: (snapshot) => snapshot.metadata.twitter.card },
  { name: "twitter:title", getValue: (snapshot) => snapshot.metadata.twitter.title },
  { name: "twitter:description", getValue: (snapshot) => snapshot.metadata.twitter.description },
  { name: "twitter:image", getValue: (snapshot) => snapshot.metadata.twitter.image },
];

const FIELD_NAMES = new Set<SourceFieldName>(SOURCE_FIELDS.map((field) => field.name));

export async function getSocialPreview(
  input: SocialPreviewInput,
): Promise<SocialPreviewResult> {
  const sourceMode = parseSourceMode(input.source);
  const url = normalizeAuditUrl(input.url);

  if (input.mock) {
    const scenario = parseSocialPreviewMockScenario(input.mock);
    const mock = createMockSocialPreviewAudit(scenario, url);
    return createSocialPreviewFromAudit({
      audit: mock.audit,
      checkedAt: mock.checkedAt,
      mode: "mock",
      sourceMode,
      checkAssets: Boolean(input.checkAssets),
      mockImageAssetStatus: mock.imageAssetStatus,
    });
  }

  const audit = await auditUrl(url, {
    timeoutMs: input.timeoutMs,
    userAgent: input.userAgent,
    render: sourceMode !== "raw",
  });

  return createSocialPreviewFromAudit({
    audit,
    checkedAt: audit.auditedAt,
    mode: "live",
    sourceMode,
    checkAssets: Boolean(input.checkAssets),
  });
}

export function createSocialPreviewFromAudit(input: BuildInput): SocialPreviewResult {
  const context = {
    raw: input.audit.raw,
    rendered: input.audit.rendered,
    sourceMode: input.sourceMode,
  };
  const observedFields = SOURCE_FIELDS.map((field) => observedField(field, context));
  const canonical = selectField(
    "URL",
    ["canonical"],
    [],
    context,
    "No canonical URL was observed.",
  );
  const canonicalUrl = canonical.value;
  const genericImage = imageField(
    selectField("Image", ["og:image"], ["twitter:image"], context, "No social image URL was observed."),
    input,
  );

  const previews = {
    google_search: googlePreview(context),
    generic_social: socialPreview(context, "generic_social", "Generic social preview"),
    x_twitter: twitterPreview(context),
    slack_discord: slackDiscordPreview(context),
    linkedin: linkedinPreview(context),
  };

  previews.generic_social.fields.image = imageField(previews.generic_social.fields.image!, input);
  previews.x_twitter.fields.image = imageField(previews.x_twitter.fields.image!, input);
  previews.slack_discord.fields.image = imageField(previews.slack_discord.fields.image!, input);
  previews.linkedin.fields.image = imageField(previews.linkedin.fields.image!, input);

  const comparison = {
    rawVsRendered: input.audit.comparison.fields
      .filter((field) => isSourceFieldName(field.field))
      .map((field) => ({
        field: field.field as SourceFieldName,
        rawValue: field.rawValue,
        renderedValue: field.renderedValue,
        status: field.status,
      })),
  };

  const warnings = unique([
    ...Object.values(previews).flatMap((preview) => preview.warnings),
    ...consistencyWarnings(previews),
    ...assetWarnings(genericImage, input),
  ]);
  const limitations = limitationsFor(input);
  const verdict = verdictFor(previews, warnings, genericImage);
  const nextActions = nextActionsFor(verdict.status, previews, comparison.rawVsRendered, genericImage);

  return SocialPreviewJsonContractSchema.parse({
    contract: CONTRACT_NAMES.socialPreview,
    url: input.audit.url,
    checkedAt: input.checkedAt,
    mode: input.mode,
    sourceMode: input.sourceMode,
    canonicalUrl,
    previews,
    fields: observedFields,
    image: genericImage,
    warnings,
    limitations,
    comparison,
    verdict,
    nextActions,
  });
}

export function parseSourceMode(value: string | undefined): SocialPreviewSourceMode {
  const sourceMode = value ?? "both";
  if ((SOCIAL_PREVIEW_SOURCE_MODES as readonly string[]).includes(sourceMode)) {
    return sourceMode as SocialPreviewSourceMode;
  }
  throw new SocialPreviewError(
    "invalid_mode",
    `Unsupported social preview source: ${sourceMode}. Use raw, rendered, or both.`,
  );
}

export function classifySocialPreviewError(error: unknown): CliErrorCode {
  if (error instanceof SocialPreviewError) return error.code;
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("Invalid URL")) return "invalid_url";
  if (/timed out|timeout/i.test(message)) return "timeout";
  if (/fetch|network|getaddrinfo|enotfound|econnrefused|ECONNREFUSED|ENOTFOUND/i.test(message)) return "network_error";
  return "internal_error";
}

function googlePreview(context: SelectionContext): PreviewSurface {
  const title = selectField("Title", ["title"], [], context, "No document title was observed.");
  const description = selectField(
    "Description",
    ["meta description"],
    [],
    context,
    "No meta description was observed.",
  );
  const url = selectField("URL", ["canonical"], [], context, "No canonical URL was observed.");
  const warnings = [
    ...missingWarnings("Google-style preview", { title, description, url }),
    ...renderedOnlyWarnings(context, [
      ["title", "Google-style title"],
      ["meta description", "Google-style description"],
    ]),
  ];

  return {
    surface: "google_search",
    label: "Google-style search preview",
    fields: { title, description, url },
    warnings,
  };
}

function socialPreview(
  context: SelectionContext,
  surface: "generic_social",
  label: string,
): PreviewSurface {
  const title = selectField("Title", ["og:title"], ["title"], context, "No Open Graph title or document title was observed.");
  const description = selectField(
    "Description",
    ["og:description"],
    ["meta description"],
    context,
    "No Open Graph or meta description was observed.",
  );
  const url = selectField("URL", ["og:url"], ["canonical"], context, "No Open Graph URL or canonical URL was observed.");
  const cardType = selectField("Card type", ["og:type"], [], context, "No Open Graph type was observed.");
  const image = selectField("Image", ["og:image"], ["twitter:image"], context, "No Open Graph or Twitter image was observed.");
  const warnings = [
    ...openGraphWarnings(context),
    ...fallbackWarnings(label, { title, description, url, image }),
    ...renderedOnlyWarnings(context, [
      ["og:title", `${label} title`],
      ["og:description", `${label} description`],
      ["og:url", `${label} URL`],
      ["og:image", `${label} image`],
    ]),
  ];

  return {
    surface,
    label,
    fields: { title, description, url, cardType, image: imageField(image, { checkAssets: false } as BuildInput) },
    warnings,
  };
}

function twitterPreview(context: SelectionContext): PreviewSurface {
  const title = selectField("Title", ["twitter:title"], ["og:title", "title"], context, "No Twitter, Open Graph, or document title was observed.");
  const description = selectField(
    "Description",
    ["twitter:description"],
    ["og:description", "meta description"],
    context,
    "No Twitter, Open Graph, or meta description was observed.",
  );
  const url = selectField("URL", ["og:url"], ["canonical"], context, "No Open Graph URL or canonical URL was observed.");
  const cardType = selectField("Card type", ["twitter:card"], ["og:type"], context, "No Twitter card type was observed.");
  const image = selectField("Image", ["twitter:image"], ["og:image"], context, "No Twitter or Open Graph image was observed.");
  const warnings = [
    ...twitterWarnings(context),
    ...fallbackWarnings("X/Twitter preview", { title, description, url, cardType, image }),
    ...renderedOnlyWarnings(context, [
      ["twitter:title", "X/Twitter title"],
      ["twitter:description", "X/Twitter description"],
      ["twitter:image", "X/Twitter image"],
    ]),
  ];

  return {
    surface: "x_twitter",
    label: "X/Twitter preview",
    fields: { title, description, url, cardType, image: imageField(image, { checkAssets: false } as BuildInput) },
    warnings,
  };
}

function slackDiscordPreview(context: SelectionContext): PreviewSurface {
  const title = selectField("Title", ["og:title"], ["title"], context, "No Open Graph title or document title was observed.");
  const description = selectField(
    "Description",
    ["og:description"],
    ["meta description"],
    context,
    "No Open Graph or meta description was observed.",
  );
  const url = selectField("URL", ["og:url"], ["canonical"], context, "No Open Graph URL or canonical URL was observed.");
  const image = selectField("Image", ["og:image"], ["twitter:image"], context, "No Open Graph or Twitter image was observed.");
  const warnings = [
    ...missingWarnings("Slack/Discord-style preview", { description, image }),
    ...fallbackWarnings("Slack/Discord-style preview", { title, description, url, image }),
    ...renderedOnlyWarnings(context, [
      ["og:title", "Slack/Discord title"],
      ["og:description", "Slack/Discord description"],
      ["og:image", "Slack/Discord image"],
    ]),
  ];

  return {
    surface: "slack_discord",
    label: "Slack/Discord preview",
    fields: { title, description, url, image: imageField(image, { checkAssets: false } as BuildInput) },
    warnings,
  };
}

function linkedinPreview(context: SelectionContext): PreviewSurface {
  const title = selectField("Title", ["og:title"], ["title"], context, "No Open Graph title or document title was observed.");
  const description = selectField(
    "Description",
    ["og:description"],
    ["meta description"],
    context,
    "No Open Graph or meta description was observed.",
  );
  const url = selectField("URL", ["og:url"], ["canonical"], context, "No Open Graph URL or canonical URL was observed.");
  const image = selectField("Image", ["og:image"], [], context, "No Open Graph image was observed.");
  const warnings = [
    ...linkedinWarnings(context),
    ...fallbackWarnings("LinkedIn-style preview", { title, description, url, image }),
    ...renderedOnlyWarnings(context, [
      ["og:title", "LinkedIn title"],
      ["og:description", "LinkedIn description"],
      ["og:image", "LinkedIn image"],
    ]),
  ];

  return {
    surface: "linkedin",
    label: "LinkedIn preview",
    fields: { title, description, url, image: imageField(image, { checkAssets: false } as BuildInput) },
    warnings,
  };
}

type SelectionContext = {
  raw: ExtractedPageMetadata;
  rendered: ExtractedPageMetadata;
  sourceMode: SocialPreviewSourceMode;
};

function observedField(
  field: FieldDef,
  context: SelectionContext,
): SocialPreviewResult["fields"][number] {
  const rawValue = cleanValue(field.getValue(context.raw));
  const renderedValue = cleanValue(field.getValue(context.rendered));
  let selectedValue: string | undefined;
  let selectedSource: FieldSource = "unknown";
  let status: FieldStatus = "missing";

  if (context.sourceMode === "raw") {
    selectedValue = rawValue;
    selectedSource = rawValue ? "raw_html" : "unknown";
    status = rawValue ? "present" : "missing";
  } else if (context.sourceMode === "rendered") {
    selectedValue = renderedValue;
    selectedSource = renderedValue ? "rendered_html" : "unknown";
    status = renderedValue ? "present" : "missing";
  } else if (rawValue) {
    selectedValue = rawValue;
    selectedSource = "raw_html";
    status = "present";
  } else if (renderedValue) {
    selectedValue = renderedValue;
    selectedSource = "rendered_html";
    status = "fallback";
  }

  return {
    name: field.name,
    rawValue,
    renderedValue,
    selectedValue,
    selectedSource,
    status,
  };
}

function selectField(
  label: string,
  primaryFields: SourceFieldName[],
  fallbackFields: SourceFieldName[],
  context: SelectionContext,
  missingMessage: string,
): PreviewField {
  const orderedFields = [...primaryFields, ...fallbackFields];
  const sourceOrder: Array<"raw" | "rendered"> =
    context.sourceMode === "both"
      ? ["raw", "rendered"]
      : [context.sourceMode];

  for (const source of sourceOrder) {
    const snapshot = source === "raw" ? context.raw : context.rendered;
    for (const field of orderedFields) {
      const value = cleanValue(getFieldValue(snapshot, field));
      if (!value) continue;
      const isPrimary = primaryFields.includes(field);
      const selectedSource: FieldSource = source === "raw" ? "raw_html" : "rendered_html";
      const status: FieldStatus =
        isPrimary && (context.sourceMode !== "both" || source === "raw") ? "present" : "fallback";
      return {
        status,
        value,
        source: selectedSource,
        sourceField: field,
        message: status === "present"
          ? `${label} comes from ${field} in ${source === "raw" ? "raw HTML" : "rendered HTML"}.`
          : `${label} uses a fallback from ${field} in ${source === "raw" ? "raw HTML" : "rendered HTML"}.`,
      };
    }
  }

  return {
    status: "missing",
    source: "unknown",
    message: missingMessage,
  };
}

function imageField(field: PreviewField, input: Pick<BuildInput, "checkAssets" | "mockImageAssetStatus">): ImageField {
  const assetStatus = imageAssetStatus(field, input);
  return {
    ...field,
    assetStatus,
    assetMessage: assetMessage(assetStatus, field, input.checkAssets),
  };
}

function imageAssetStatus(
  field: PreviewField,
  input: Pick<BuildInput, "checkAssets" | "mockImageAssetStatus">,
): AssetStatus {
  if (!field.value) return "unknown";
  if (input.mockImageAssetStatus) return input.mockImageAssetStatus;
  return "not_checked";
}

function assetMessage(
  status: AssetStatus,
  field: PreviewField,
  checkAssets: boolean,
): string {
  if (!field.value) return "No image URL was observed.";
  if (status === "reachable") return "The deterministic mock marks this image URL as reachable.";
  if (status === "unreachable") return "The deterministic mock marks this image URL as unreachable.";
  if (status === "unknown") return "Image URL reachability is unknown.";
  if (checkAssets) {
    return "Live image asset checks are not performed by this read-only simulator; verify the URL separately.";
  }
  return "Image asset reachability was not checked.";
}

function getFieldValue(snapshot: ExtractedPageMetadata, field: SourceFieldName): string | undefined {
  return SOURCE_FIELDS.find((item) => item.name === field)?.getValue(snapshot);
}

function cleanValue(value: string | undefined): string | undefined {
  const cleaned = value?.replace(/\s+/g, " ").trim();
  return cleaned || undefined;
}

function isSourceFieldName(value: string): boolean {
  return FIELD_NAMES.has(value as SourceFieldName);
}

function missingWarnings(
  label: string,
  fields: Record<string, PreviewField | ImageField>,
): string[] {
  return Object.entries(fields)
    .filter(([, field]) => field.status === "missing")
    .map(([field]) => `${label} is missing ${field}.`);
}

function fallbackWarnings(
  label: string,
  fields: Record<string, PreviewField | ImageField>,
): string[] {
  return Object.entries(fields)
    .filter(([, field]) => field.status === "fallback")
    .map(([field, value]) => `${label} uses a fallback for ${field} from ${value.sourceField ?? "another observed field"}.`);
}

function openGraphWarnings(context: SelectionContext): string[] {
  return missingSourceWarnings("Generic social preview", context, [
    ["og:title", "Open Graph title"],
    ["og:description", "Open Graph description"],
    ["og:url", "Open Graph URL"],
    ["og:image", "Open Graph image"],
  ]);
}

function twitterWarnings(context: SelectionContext): string[] {
  return missingSourceWarnings("X/Twitter preview", context, [
    ["twitter:card", "Twitter card type"],
    ["twitter:title", "Twitter title"],
    ["twitter:description", "Twitter description"],
    ["twitter:image", "Twitter image"],
  ]);
}

function linkedinWarnings(context: SelectionContext): string[] {
  return missingSourceWarnings("LinkedIn-style preview", context, [
    ["og:title", "Open Graph title"],
    ["og:description", "Open Graph description"],
    ["og:image", "Open Graph image"],
  ]);
}

function missingSourceWarnings(
  label: string,
  context: SelectionContext,
  fields: Array<[SourceFieldName, string]>,
): string[] {
  return fields.flatMap(([field, fieldLabel]) => {
    const rawValue = cleanValue(getFieldValue(context.raw, field));
    const renderedValue = cleanValue(getFieldValue(context.rendered, field));
    if (context.sourceMode === "raw" && !rawValue) {
      return [`${label} is missing ${fieldLabel} in raw HTML.`];
    }
    if (context.sourceMode === "rendered" && !renderedValue) {
      return [`${label} is missing ${fieldLabel} in rendered HTML.`];
    }
    if (context.sourceMode === "both" && !rawValue && !renderedValue) {
      return [`${label} is missing ${fieldLabel}.`];
    }
    return [];
  });
}

function renderedOnlyWarnings(
  context: SelectionContext,
  fields: Array<[SourceFieldName, string]>,
): string[] {
  if (context.sourceMode === "raw") return [];
  return fields.flatMap(([field, label]) => {
    const rawValue = cleanValue(getFieldValue(context.raw, field));
    const renderedValue = cleanValue(getFieldValue(context.rendered, field));
    if (!rawValue && renderedValue) {
      return [`${label} appears only after rendering; raw HTML is usually safer for preview bots.`];
    }
    return [];
  });
}

function consistencyWarnings(previews: SocialPreviewResult["previews"]): string[] {
  const warnings: string[] = [];
  for (const field of ["title", "description", "url", "image"] as const) {
    const values = new Set<string>();
    for (const preview of Object.values(previews)) {
      const value = preview.fields[field]?.value;
      if (value) values.add(value);
    }
    if (values.size > 1) {
      warnings.push(`Observed ${field} inputs differ across simulated preview surfaces.`);
    }
  }
  return warnings;
}

function assetWarnings(image: ImageField, input: BuildInput): string[] {
  if (!image.value) return ["No image URL was available for social preview simulation."];
  if (image.assetStatus === "unreachable") return ["The selected image URL is marked unreachable in the deterministic mock scenario."];
  if (image.assetStatus === "not_checked" && input.checkAssets) {
    return ["Image asset reachability was requested but is not checked by the live simulator in this pass."];
  }
  return [];
}

function limitationsFor(input: BuildInput): string[] {
  return [
    "This is a simulated preview and approximation based on observed metadata, not an official platform API output.",
    "Platform behavior may differ by crawler, cache state, account settings, locale, page history, and platform-specific rules.",
    "Raw HTML metadata is usually safer for preview bots than metadata injected only after JavaScript rendering.",
    "ShipReady does not render screenshots, generate images, scrape platform preview endpoints, deploy changes, or call social platform APIs.",
    input.mode === "mock"
      ? "Mock mode uses deterministic local fixtures and no network request."
      : "Live mode audits one URL through ShipReady's existing read-only single-page audit.",
  ];
}

function verdictFor(
  previews: SocialPreviewResult["previews"],
  warnings: string[],
  image: ImageField,
): SocialPreviewResult["verdict"] {
  const missing = Object.values(previews).some((preview) =>
    Object.values(preview.fields).some((field) => field?.status === "missing"));
  if (missing || image.assetStatus === "unreachable" || warnings.length > 0) {
    return {
      status: "needs_attention",
      summary: "One or more simulated preview inputs are missing, fallback-based, rendered-only, or have image evidence that needs attention.",
    };
  }
  if (image.assetStatus === "unknown") {
    return {
      status: "unknown",
      summary: "Preview metadata was observed, but image evidence is inconclusive.",
    };
  }
  return {
    status: "ready",
    summary: "Core simulated preview inputs are present and consistent in the observed metadata.",
  };
}

function nextActionsFor(
  verdict: SocialPreviewResult["verdict"]["status"],
  previews: SocialPreviewResult["previews"],
  differences: SocialPreviewResult["comparison"]["rawVsRendered"],
  image: ImageField,
): string[] {
  const actions = new Set<string>();
  if (verdict === "ready") {
    actions.add("Use this report as a review aid; confirm important shares manually in the target apps if exact rendering matters.");
  }
  if (Object.values(previews).some((preview) => preview.fields.title.status === "missing")) {
    actions.add("Add a clear page title and the relevant Open Graph or Twitter title fields in the page's raw HTML metadata.");
  }
  if (Object.values(previews).some((preview) => preview.fields.description.status === "missing")) {
    actions.add("Add a concise meta description plus Open Graph and Twitter descriptions where those surfaces matter.");
  }
  if (Object.values(previews).some((preview) => preview.fields.url.status === "missing")) {
    actions.add("Add a canonical URL and matching og:url so previews use a stable page URL.");
  }
  if (image.status === "missing") {
    actions.add("Add an absolute, shareable og:image and twitter:image URL sized for social cards.");
  }
  if (image.assetStatus === "unreachable") {
    actions.add("Review the selected image URL outside ShipReady before relying on it for sharing.");
  }
  if (differences.some((difference) => difference.status === "present_after_render_only")) {
    actions.add("Move important preview metadata into raw HTML when preview-bot visibility matters.");
  }
  if (actions.size === 0) {
    actions.add("Review fallback warnings and align title, description, URL, card type, and image metadata where consistency matters.");
  }
  return [...actions];
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
