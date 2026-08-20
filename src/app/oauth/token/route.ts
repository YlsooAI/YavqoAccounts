import { createClient } from "@/lib/supabase/server";
import {
  parseScopes,
  signAccessToken,
  type OAuthClaims,
} from "@/lib/oauth";

export const dynamic = "force-dynamic";

function oauthError(error: string, description: string, status: number) {
  return Response.json(
    { error, error_description: description },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json;charset=UTF-8",
      },
    }
  );
}

// OAuth 2.0 token endpoint — authorization_code grant.
// Accepts form-encoded or JSON bodies; client credentials may come from
// an HTTP Basic Authorization header or from the body.
export async function POST(request: Request) {
  let params: URLSearchParams;
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json = (await request.json()) as Record<string, unknown>;
      params = new URLSearchParams(
        Object.entries(json).map(([k, v]) => [k, String(v ?? "")])
      );
    } else {
      params = new URLSearchParams(await request.text());
    }
  } catch {
    return oauthError("invalid_request", "Malformed request body.", 400);
  }

  let clientId = params.get("client_id");
  let clientSecret = params.get("client_secret");

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(
        authorization.slice("Basic ".length),
        "base64"
      ).toString("utf8");
      const separator = decoded.indexOf(":");
      if (separator > 0) {
        clientId = decodeURIComponent(decoded.slice(0, separator));
        clientSecret = decodeURIComponent(decoded.slice(separator + 1));
      }
    } catch {
      // Fall through with body-provided credentials.
    }
  }

  if (params.get("grant_type") !== "authorization_code") {
    return oauthError(
      "unsupported_grant_type",
      "Only grant_type=authorization_code is supported.",
      400
    );
  }
  const code = params.get("code");
  const redirectUri = params.get("redirect_uri");
  if (!clientId || !code || !redirectUri) {
    return oauthError(
      "invalid_request",
      "client_id, code, and redirect_uri are required.",
      400
    );
  }

  const issuer =
    process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("oauth_consume_code", {
    p_client_id: clientId,
    p_client_secret: clientSecret,
    p_code: code,
    p_redirect_uri: redirectUri,
    p_code_verifier: params.get("code_verifier"),
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("invalid_client")) {
      return oauthError("invalid_client", "Unknown client or bad secret.", 401);
    }
    return oauthError("invalid_grant", "Code is invalid, used, or expired.", 400);
  }

  const result = data as (OAuthClaims & { granted_scope?: string }) | null;
  if (!result?.sub) {
    return oauthError("invalid_grant", "Code is invalid, used, or expired.", 400);
  }

  // The scopes the user actually consented to travel with the code row.
  const scopes = parseScopes(result.granted_scope ?? null);
  const claims: OAuthClaims = {
    sub: result.sub,
    email: result.email,
    email_verified: result.email_verified,
    name: result.name,
    picture: result.picture,
    handle: result.handle,
    id_display_name: result.id_display_name,
  };
  const accessToken = signAccessToken(claims, issuer, clientId, scopes);

  return Response.json(
    {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 3600,
      scope: scopes.join(" "),
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
