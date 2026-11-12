import { checkRateLimit, clientIpFromRequest } from "@/lib/rate-limit";

export function oauthError(
  error: string,
  description: string,
  status: number,
  extraHeaders?: Record<string, string>
) {
  return Response.json(
    { error, error_description: description },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        Pragma: "no-cache",
        "Content-Type": "application/json;charset=UTF-8",
        ...extraHeaders,
      },
    }
  );
}

export function enforceOAuthRateLimit(
  request: Request,
  endpoint: string,
  limit = 60,
  extraHeaders?: Record<string, string>
): Response | null {
  const ip = clientIpFromRequest(request);
  const result = checkRateLimit(`${endpoint}:${ip}`, limit, 60_000);
  if (result.allowed) return null;

  const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  return oauthError(
    "temporarily_unavailable",
    "Too many requests. Please slow down and try again.",
    429,
    {
      "Retry-After": String(retryAfter),
      ...extraHeaders,
    }
  );
}

function decodeFormComponent(value: string): string {
  return decodeURIComponent(value.replace(/\+/g, " "));
}

export async function parseOAuthFormRequest(request: Request): Promise<
  | {
      ok: true;
      params: URLSearchParams;
      clientId: string | null;
      clientSecret: string | null;
      usedBasicAuth: boolean;
    }
  | { ok: false }
> {
  let params: URLSearchParams;
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json = (await request.json()) as Record<string, unknown>;
      if (!json || typeof json !== "object" || Array.isArray(json)) {
        return { ok: false };
      }
      params = new URLSearchParams(
        Object.entries(json)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => [k, String(v)])
      );
    } else {
      params = new URLSearchParams(await request.text());
    }
  } catch {
    return { ok: false };
  }

  let clientId = params.get("client_id");
  let clientSecret = params.get("client_secret");
  let usedBasicAuth = false;

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Basic ")) {
    usedBasicAuth = true;
    try {
      const decoded = Buffer.from(
        authorization.slice("Basic ".length).trim(),
        "base64"
      ).toString("utf8");
      const separator = decoded.indexOf(":");
      if (separator > 0) {
        clientId = decodeFormComponent(decoded.slice(0, separator));
        clientSecret = decodeFormComponent(decoded.slice(separator + 1));
      }
    } catch {
      // Fall through with body-provided credentials if Basic header is malformed.
    }
  }

  return { ok: true, params, clientId, clientSecret, usedBasicAuth };
}
