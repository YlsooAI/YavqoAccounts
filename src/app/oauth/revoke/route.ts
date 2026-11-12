import { verifyAccessToken } from "@/lib/oauth";
import { OAUTH_CORS_HEADERS, oauthCorsPreflight } from "@/lib/oauth-cors";
import {
  enforceOAuthRateLimit,
  oauthError,
  parseOAuthFormRequest,
} from "@/lib/oauth-request";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return oauthCorsPreflight();
}

// RFC 7009 OAuth 2.0 Token Revocation endpoint.
export async function POST(request: Request) {
  const rateLimited = enforceOAuthRateLimit(
    request,
    "oauth_revoke",
    60,
    OAUTH_CORS_HEADERS
  );
  if (rateLimited) return rateLimited;

  const parsed = await parseOAuthFormRequest(request);
  if (!parsed.ok) {
    return oauthError(
      "invalid_request",
      "Malformed request body.",
      400,
      OAUTH_CORS_HEADERS
    );
  }

  const { params, clientId, clientSecret, usedBasicAuth } = parsed;
  const token = params.get("token");

  if (!clientId) {
    return oauthError(
      "invalid_client",
      "client_id is required.",
      401,
      usedBasicAuth
        ? { "WWW-Authenticate": 'Basic realm="Yavqo OAuth"', ...OAUTH_CORS_HEADERS }
        : OAUTH_CORS_HEADERS
    );
  }
  if (!token) {
    return oauthError(
      "invalid_request",
      "token parameter is required.",
      400,
      OAUTH_CORS_HEADERS
    );
  }

  let jti: string | null = null;
  let jtiExp: number | null = null;
  const jwtPayload = verifyAccessToken(token);
  if (jwtPayload && jwtPayload.aud === clientId && jwtPayload.jti) {
    jti = jwtPayload.jti;
    jtiExp = jwtPayload.exp;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("oauth_revoke_token", {
    p_client_id: clientId,
    p_client_secret: clientSecret,
    p_token: token,
    p_jti: jti,
    p_jti_exp: jtiExp,
  });

  if (error?.message?.includes("invalid_client")) {
    return oauthError(
      "invalid_client",
      "Unknown client or bad secret.",
      401,
      usedBasicAuth
        ? { "WWW-Authenticate": 'Basic realm="Yavqo OAuth"', ...OAUTH_CORS_HEADERS }
        : OAUTH_CORS_HEADERS
    );
  }

  // RFC 7009 Section 2.2: respond 200 OK whether the token was active, expired,
  // or unrecognized (after client authentication succeeded).
  return new Response(null, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      Pragma: "no-cache",
      ...OAUTH_CORS_HEADERS,
    },
  });
}
