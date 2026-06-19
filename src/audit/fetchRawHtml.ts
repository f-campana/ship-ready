import { fetchText } from "../utils/http";

export type RawHtmlResult = {
  url: string;
  finalUrl: string;
  statusCode: number;
  html: string;
};

export async function fetchRawHtml(
  url: string,
  options: { timeoutMs: number; userAgent?: string },
): Promise<RawHtmlResult> {
  const response = await fetchText(url, {
    timeoutMs: options.timeoutMs,
    userAgent: options.userAgent,
  });

  return {
    url,
    finalUrl: response.finalUrl,
    statusCode: response.statusCode,
    html: response.body,
  };
}

