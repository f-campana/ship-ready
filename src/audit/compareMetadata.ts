import type {
  ExtractedPageMetadata,
  RawRenderedComparison,
} from "../types/audit";

type FieldAccessor = {
  field: string;
  getValue: (snapshot: ExtractedPageMetadata) => string | undefined;
};

const COMPARISON_FIELDS: FieldAccessor[] = [
  { field: "title", getValue: (snapshot) => snapshot.metadata.title },
  { field: "description", getValue: (snapshot) => snapshot.metadata.description },
  { field: "canonical", getValue: (snapshot) => snapshot.metadata.canonical },
  { field: "robots", getValue: (snapshot) => snapshot.metadata.robots },
  { field: "html.lang", getValue: (snapshot) => snapshot.metadata.htmlLang },
  { field: "viewport", getValue: (snapshot) => snapshot.metadata.viewport },
  { field: "theme-color", getValue: (snapshot) => snapshot.metadata.themeColor },
  {
    field: "favicon",
    getValue: (snapshot) => snapshot.metadata.faviconLinks.join(", ") || undefined,
  },
  { field: "og:title", getValue: (snapshot) => snapshot.metadata.openGraph.title },
  {
    field: "og:description",
    getValue: (snapshot) => snapshot.metadata.openGraph.description,
  },
  { field: "og:image", getValue: (snapshot) => snapshot.metadata.openGraph.image },
  { field: "og:url", getValue: (snapshot) => snapshot.metadata.openGraph.url },
  { field: "og:type", getValue: (snapshot) => snapshot.metadata.openGraph.type },
  {
    field: "og:site_name",
    getValue: (snapshot) => snapshot.metadata.openGraph.siteName,
  },
  { field: "twitter:card", getValue: (snapshot) => snapshot.metadata.twitter.card },
  { field: "twitter:title", getValue: (snapshot) => snapshot.metadata.twitter.title },
  {
    field: "twitter:description",
    getValue: (snapshot) => snapshot.metadata.twitter.description,
  },
  { field: "twitter:image", getValue: (snapshot) => snapshot.metadata.twitter.image },
];

export function compareMetadata(
  raw: ExtractedPageMetadata,
  rendered: ExtractedPageMetadata,
): RawRenderedComparison {
  return {
    fields: COMPARISON_FIELDS.map(({ field, getValue }) => {
      const rawValue = normalizeValue(getValue(raw));
      const renderedValue = normalizeValue(getValue(rendered));

      if (!rawValue && !renderedValue) {
        return { field, status: "missing_in_both" as const };
      }

      if (!rawValue && renderedValue) {
        return {
          field,
          renderedValue,
          status: "present_after_render_only" as const,
        };
      }

      if (rawValue && renderedValue && rawValue !== renderedValue) {
        return {
          field,
          rawValue,
          renderedValue,
          status: "changed_after_render" as const,
        };
      }

      return {
        field,
        rawValue,
        renderedValue,
        status: "present_in_raw" as const,
      };
    }),
  };
}

function normalizeValue(value: string | undefined): string | undefined {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed || undefined;
}

