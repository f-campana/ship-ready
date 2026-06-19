import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { GUI_CLIENT_JS } from "./guiClient";
import { renderGuiHtml } from "./guiHtml";
import { GUI_CSS } from "./guiStyles";
import {
  createUiReportApiResult,
  invalidJsonApiResult,
  type GuiApiOptions,
} from "./guiApi";

export type GuiServerOptions = GuiApiOptions & {
  host?: string;
  port?: number;
};

export type RunningGuiServer = {
  server: Server;
  host: string;
  port: number;
  url: string;
  close: () => Promise<void>;
};

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 4317;
const MAX_BODY_BYTES = 1_000_000;

export async function startGuiServer(options: GuiServerOptions = {}): Promise<RunningGuiServer> {
  const host = options.host ?? DEFAULT_HOST;
  const port = options.port ?? DEFAULT_PORT;
  const server = createServer((request, response) => {
    handleGuiRequest(request, response, options).catch((error: unknown) => {
      sendJson(response, 500, {
        ok: false,
        error: {
          message: error instanceof Error ? error.message : "ShipReady local UI failed.",
          stage: "server",
        },
      });
    });
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException) => {
      server.off("listening", onListening);
      if (error.code === "EADDRINUSE") {
        reject(new Error(`Port ${port} is unavailable on ${host}. Choose another port with --port.`));
        return;
      }
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });

  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;

  return {
    server,
    host,
    port: actualPort,
    url: `http://${host}:${actualPort}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}

async function handleGuiRequest(
  request: IncomingMessage,
  response: ServerResponse,
  options: GuiApiOptions,
): Promise<void> {
  const requestUrl = new URL(request.url ?? "/", "http://localhost");

  if (request.method === "GET" && requestUrl.pathname === "/") {
    sendText(response, 200, "text/html; charset=utf-8", renderGuiHtml());
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/assets/gui.css") {
    sendText(response, 200, "text/css; charset=utf-8", GUI_CSS);
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/assets/gui.js") {
    sendText(response, 200, "application/javascript; charset=utf-8", GUI_CLIENT_JS);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/ui-report") {
    const payload = await readJsonBody(request);
    const result = payload.ok
      ? await createUiReportApiResult(payload.value, options)
      : invalidJsonApiResult(payload.error);
    sendJson(response, result.statusCode, result.body);
    return;
  }

  if (requestUrl.pathname === "/api/ui-report") {
    sendJson(response, 405, {
      ok: false,
      error: {
        message: "Use POST /api/ui-report.",
        stage: "server",
      },
    });
    return;
  }

  sendText(response, 404, "text/plain; charset=utf-8", "Not found");
}

async function readJsonBody(
  request: IncomingMessage,
): Promise<{ ok: true; value: unknown } | { ok: false; error: unknown }> {
  try {
    const body = await readRequestBody(request);
    return {
      ok: true,
      value: body.trim() ? JSON.parse(body) : {},
    };
  } catch (error) {
    return { ok: false, error };
  }
}

async function readRequestBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;

    if (totalBytes > MAX_BODY_BYTES) {
      throw new Error("Request body is too large.");
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function sendText(
  response: ServerResponse,
  statusCode: number,
  contentType: string,
  body: string,
): void {
  response.writeHead(statusCode, {
    "content-type": contentType,
    "cache-control": "no-store",
  });
  response.end(body);
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  sendText(response, statusCode, "application/json; charset=utf-8", `${JSON.stringify(body, null, 2)}\n`);
}
