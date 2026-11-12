import { createClient } from "@/lib/supabase/server";
import {
  TOKEN_LIFETIME_SECONDS,
  getOAuthIssuer,
  hasUnsupportedScopes,
  parseClientCredentialsScopes,
  parseScopes,
  signAccessToken,
  signClientCredentialsToken,
  signIdToken,
  type OAuthClaims,
} from "@/lib/oauth";
import { OAUTH_CORS_HEADERS, oauthCorsPreflight } from "@/lib/oauth-cors";
import {
  enforceOAuthRateLimit,
  oauthError,
  parseOAuthFormRequest,
} from "@/lib/oauth-request";

export const dynamic = "force-dynamic";

type TokenRpcResult = OAuthClaims & {
  error?: string;
  granted_scope?: string;
  authorization_id?: string;
  nonce?: string | null;
  auth_time?: number | null;
  refresh_token?: string | null;
  refresh_family_id?: string | null;
};

function extractClaims(result: TokenRpcResult): OAuthClaims {
  return {
    sub: result.sub,
    email: result.email ?? null,
    email_verified: Boolean(result.email_verified),
    name: result.name ?? null,
    full_name: result.full_name ?? null,
    picture: result.picture ?? null,
    avatar_url: result.avatar_url ?? null,
    handle: result.handle ?? null,
    id_display_name: result.id_display_name ?? null,
    username: result.username ?? null,
    gender: result.gender ?? null,
    birthday: result.birthday ?? null,
    phone: result.phone ?? null,
  };
}

function mapRpcError(
  rpcError: { message?: string } | null,
  rpcResultError: string | undefined,
  usedBasicAuth: boolean
) {
  const code = rpcResultError || rpcError?.message || "";
  if (code.includes("invalid_client")) {
    return oauthError(
      "invalid_client",
      "Unknown client or bad secret.",
      401,
      usedBasicAuth
        ? { "WWW-Authenticate": 'Basic realm="Yavqo OAuth"', ...OAUTH_CORS_HEADERS }
        : OAUTH_CORS_HEADERS
    );
  }
  if (code.includes("unauthorized_client")) {
    return oauthError(
      "unauthorized_client",
      "This client is not authorized for the requested grant type.",
      400,
      OAUTH_CORS_HEADERS
    );
  }
  if (code.includes("invalid_scope")) {
    return oauthError(
      "invalid_scope",
      "The requested scope exceeds the original grant.",
      400,
      OAUTH_CORS_HEADERS
    );
  }
  return oauthError(
    "invalid_grant",
    "Code or refresh token is invalid, used, revoked, or expired.",
    400,
    OAUTH_CORS_HEADERS
  );
}

export function OPTIONS() {
  return oauthCorsPreflight();
}

// OAuth 2.0 / OIDC token endpoint:
// Supports authorization_code (with PKCE), refresh_token (with rotation),
// and client_credentials grants.
export async function POST(request: Request) {
  const rateLimited = enforceOAuthRateLimit(
    request,
    "oauth_token",
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
  const grantType = params.get("grant_type");
  const issuer = getOAuthIssuer(request.url);
  const supabase = await createClient();

  if (grantType === "authorization_code") {
    const code = params.get("code");
    const redirectUri = params.get("redirect_uri");
    if (!clientId || !code || !redirectUri) {
      return oauthError(
        "invalid_request",
        "client_id, code, and redirect_uri are required.",
        400,
        OAUTH_CORS_HEADERS
      );
    }

    const { data, error } = await supabase.rpc("oauth_consume_code", {
      p_client_id: clientId,
      p_client_secret: clientSecret,
      p_code: code,
      p_redirect_uri: redirectUri,
      p_code_verifier: params.get("code_verifier"),
    });

    const result = data as TokenRpcResult | null;
    if (error || !result || result.error || !result.sub || !result.authorization_id) {
      return mapRpcError(error, result?.error, usedBasicAuth);
    }

    const scopes = parseScopes(result.granted_scope ?? null);
    const claims = extractClaims(result);
    const accessToken = signAccessToken(
      claims,
      issuer,
      clientId,
      scopes,
      result.authorization_id,
      { familyId: result.refresh_family_id }
    );
    const idToken = signIdToken(claims, issuer, clientId, scopes, {
      nonce: result.nonce,
      authTime: result.auth_time,
      accessToken,
    });

    return Response.json(
      {
        access_token: accessToken,
        id_token: idToken,
        token_type: "Bearer",
        expires_in: TOKEN_LIFETIME_SECONDS,
        scope: scopes.join(" "),
        ...(result.refresh_token ? { refresh_token: result.refresh_token } : {}),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          Pragma: "no-cache",
          ...OAUTH_CORS_HEADERS,
        },
      }
    );
  }

  if (grantType === "refresh_token") {
    const refreshToken = params.get("refresh_token");
    const requestedScope = params.get("scope");
    if (!clientId || !refreshToken) {
      return oauthError(
        "invalid_request",
        "client_id and refresh_token are required.",
        400,
        OAUTH_CORS_HEADERS
      );
    }
    if (requestedScope && hasUnsupportedScopes(requestedScope)) {
      return oauthError(
        "invalid_scope",
        "Requested scope is not supported.",
        400,
        OAUTH_CORS_HEADERS
      );
    }

    const { data, error } = await supabase.rpc("oauth_rotate_refresh_token", {
      p_client_id: clientId,
      p_client_secret: clientSecret,
      p_refresh_token: refreshToken,
      p_scope: requestedScope,
    });

    const result = data as TokenRpcResult | null;
    if (error || !result || result.error || !result.sub || !result.authorization_id) {
      return mapRpcError(error, result?.error, usedBasicAuth);
    }

    const scopes = parseScopes(result.granted_scope ?? null);
    const claims = extractClaims(result);
    const accessToken = signAccessToken(
      claims,
      issuer,
      clientId,
      scopes,
      result.authorization_id,
      { familyId: result.refresh_family_id }
    );
    const idToken = signIdToken(claims, issuer, clientId, scopes, {
      accessToken,
    });

    return Response.json(
      {
        access_token: accessToken,
        id_token: idToken,
        token_type: "Bearer",
        expires_in: TOKEN_LIFETIME_SECONDS,
        scope: scopes.join(" "),
        ...(result.refresh_token ? { refresh_token: result.refresh_token } : {}),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          Pragma: "no-cache",
          ...OAUTH_CORS_HEADERS,
        },
      }
    );
  }

  if (grantType === "client_credentials") {
    if (!clientId || !clientSecret) {
      return oauthError(
        "invalid_client",
        "Client credentials are required.",
        401,
        usedBasicAuth
          ? { "WWW-Authenticate": 'Basic realm="Yavqo OAuth"', ...OAUTH_CORS_HEADERS }
          : OAUTH_CORS_HEADERS
      );
    }

    const scopes = parseClientCredentialsScopes(params.get("scope"));
    if (!scopes) {
      return oauthError(
        "invalid_scope",
        "One or more requested scopes are invalid.",
        400,
        OAUTH_CORS_HEADERS
      );
    }

    const { data, error } = await supabase.rpc("oauth_authenticate_client", {
      p_client_id: clientId,
      p_client_secret: clientSecret,
      p_require_confidential: true,
    });
    if (error || !data) {
      return mapRpcError(error, undefined, usedBasicAuth);
    }

    const accessToken = signClientCredentialsToken(issuer, clientId, scopes);
    return Response.json(
      {
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: TOKEN_LIFETIME_SECONDS,
        scope: scopes.join(" "),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          Pragma: "no-cache",
          ...OAUTH_CORS_HEADERS,
        },
      }
    );
  }

  return oauthError(
    "unsupported_grant_type",
    "Supported grant_types: authorization_code, refresh_token, client_credentials.",
    400,
    OAUTH_CORS_HEADERS
  );
}
