export class TaskBridgeApiError extends Error {
  status: number;
  body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "TaskBridgeApiError";
    this.status = status;
    this.body = body;
  }
}

function trimTrailingSlash(value: string) {
  if (value.endsWith("/")) {
    return value.slice(0, -1);
  }
  return value;
}

export function resolveBaseUrl() {
  const fromEnv = process.env.TASK_BRIDGE_URL;
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    return trimTrailingSlash(fromEnv.trim());
  }
  return "https://task-bridge.fookiecloud.com";
}

export function resolveToken() {
  const fookieKey = process.env.FOOKIE_API_KEY;
  if (typeof fookieKey === "string" && fookieKey.trim().length > 0) {
    return fookieKey.trim();
  }
  const fromEnv = process.env.TASK_BRIDGE_TOKEN;
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }
  return "";
}

function buildQuery(params: Record<string, string | number | boolean | null>) {
  const search = new URLSearchParams();
  for (const key of Object.keys(params)) {
    const value = params[key];
    if (value === null) {
      continue;
    }
    search.set(key, String(value));
  }
  const text = search.toString();
  if (text.length === 0) {
    return "";
  }
  return `?${text}`;
}

export class TaskBridgeApi {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = trimTrailingSlash(baseUrl);
    this.token = token.trim();
  }

  static fromEnv() {
    const token = resolveToken();
    if (token.length === 0) {
      throw new Error("FOOKIE_API_KEY or TASK_BRIDGE_TOKEN is required");
    }
    return new TaskBridgeApi(resolveBaseUrl(), token);
  }

  async request<T>(
    method: string,
    path: string,
    options: {
      query: Record<string, string | number | boolean | null> | null;
      body: object | null;
      auth: boolean;
    },
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;
    if (options.query !== null) {
      url = `${url}${buildQuery(options.query)}`;
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (options.auth) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    let bodyText: string | null = null;
    if (options.body !== null) {
      headers["Content-Type"] = "application/json";
      bodyText = JSON.stringify(options.body);
    }

    const response = await fetch(url, {
      method,
      headers,
      body: bodyText,
    });

    if (response.status === 204) {
      return null as T;
    }

    const text = await response.text();
    if (!response.ok) {
      let message = text;
      try {
        const parsed = JSON.parse(text) as { error: string };
        if (typeof parsed.error === "string" && parsed.error.length > 0) {
          message = parsed.error;
        }
      } catch {
        message = text;
      }
      throw new TaskBridgeApiError(message, response.status, text);
    }

    if (text.length === 0) {
      return null as T;
    }

    return JSON.parse(text) as T;
  }

  get<T>(path: string, query: Record<string, string | number | boolean | null> | null = null) {
    return this.request<T>("GET", path, { query, body: null, auth: true });
  }

  getPublic<T>(path: string) {
    return this.request<T>("GET", path, { query: null, body: null, auth: false });
  }

  post<T>(path: string, body: object | null = null) {
    return this.request<T>("POST", path, { query: null, body, auth: true });
  }

  patch<T>(path: string, body: object) {
    return this.request<T>("PATCH", path, { query: null, body, auth: true });
  }

  put<T>(path: string, body: object) {
    return this.request<T>("PUT", path, { query: null, body, auth: true });
  }

  async getBinary(path: string): Promise<{
    base64: string;
    contentType: string;
    contentHash: string;
    filename: string;
    sizeBytes: number;
  }> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new TaskBridgeApiError(text || response.statusText, response.status, text);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const disposition = response.headers.get("Content-Disposition") || "";
    let filename = "download.bin";
    const match = /filename="([^"]+)"/.exec(disposition);
    if (match && match[1]) filename = match[1];
    return {
      base64: buffer.toString("base64"),
      contentType: response.headers.get("Content-Type") || "application/octet-stream",
      contentHash: response.headers.get("X-Content-Hash") || "",
      filename,
      sizeBytes: buffer.byteLength,
    };
  }
}
