import { verifyAccessToken } from "@/lib/oauth";
import {
  enforceOAuthRateLimit,
  oauthError,
  parseOAuthFormRequest,
} from "@/lib/oauth-request";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function inactiveResponse() {
  return Response.json(
    { active: false },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        Pragma: "no-cache",
      },
    }
  );
}

// RFC 7662 OAuth 2.0 Token Introspection endpoint (confidential clients only).
export async function POST(request: Request) {
  const rateLimited = enforceOAuthRateLimit(request, "oauth_introspect", 60);
  if (rateLimited) return rateLimited;

  const parsed = await parseOAuthFormRequest(request);
  if (!parsed.ok) {
    return oauthError("invalid_request", "Malformed request body.", 400);
  }

  const { params, clientId, clientSecret, usedBasicAuth } = parsed;
  if (!clientId || !clientSecret) {
    return oauthError(
      "invalid_client",
      "Confidential client credentials are required.",
      401,
      usedBasicAuth ? { "WWW-Authenticate": 'Basic realm="Yavqo OAuth"' } : undefined
    );
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.rpc(
    "oauth_authenticate_client",
    {
      p_client_id: clientId,
      p_client_secret: clientSecret,
      p_require_confidential: true,
    }
  );

  if (authError || !authData) {
    const code = authError?.message ?? "";
    if (code.includes("unauthorized_client")) {
      return oauthError(
        "unauthorized_client",
        "Public clients cannot use token introspection.",
        400
      );
    }
    return oauthError(
      "invalid_client",
      "Unknown client or bad secret.",
      401,
      usedBasicAuth ? { "WWW-Authenticate": 'Basic realm="Yavqo OAuth"' } : undefined
    );
  }

  const token = params.get("token");
  if (!token) {
    return oauthError("invalid_request", "token parameter is required.", 400);
  }

  const jwtPayload = verifyAccessToken(token);
  if (jwtPayload) {
    if (jwtPayload.aud !== clientId) {
      return inactiveResponse();
    }

    if (jwtPayload.token_use === "client_credentials") {
      const { data: active, error } = await supabase.rpc("oauth_client_active", {
        p_client_id: clientId,
        p_jti: jwtPayload.jti ?? null,
      });
      if (error || active !== true) return inactiveResponse();

      return Response.json(
        {
          active: true,
          scope: jwtPayload.scope,
          client_id: jwtPayload.aud,
          sub: jwtPayload.sub,
          aud: jwtPayload.aud,
          iss: jwtPayload.iss,
          iat: jwtPayload.iat,
          exp: jwtPayload.exp,
          ...(jwtPayload.jti ? { jti: jwtPayload.jti } : {}),
          token_type: "Bearer",
          token_use: "client_credentials",
        },
        {
          status: 200,
          headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
        }
      );
    }

    const { data: active, error } = await supabase.rpc("oauth_token_active", {
      p_authorization_id: jwtPayload.authorization_id,
      p_user_id: jwtPayload.sub,
      p_client_id: jwtPayload.aud,
      p_scope: jwtPayload.scope,
      p_jti: jwtPayload.jti ?? null,
      p_family_id: jwtPayload.rt_family ?? null,
    });
    if (error || active !== true) return inactiveResponse();

    return Response.json(
      {
        active: true,
        scope: jwtPayload.scope,
        client_id: jwtPayload.aud,
        sub: jwtPayload.sub,
        aud: jwtPayload.aud,
        iss: jwtPayload.iss,
        iat: jwtPayload.iat,
        exp: jwtPayload.exp,
        ...(jwtPayload.jti ? { jti: jwtPayload.jti } : {}),
        ...(jwtPayload.email ? { email: jwtPayload.email } : {}),
        ...(jwtPayload.username ? { username: jwtPayload.username } : {}),
        token_type: "Bearer",
        token_use: "user",
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
      }
    );
  }

  const { data: rtData, error: rtError } = await supabase.rpc(
    "oauth_introspect_refresh_token",
    {
      p_client_id: clientId,
      p_refresh_token: token,
    }
  );
  if (rtError || !rtData || (rtData as { active?: boolean }).active !== true) {
    return inactiveResponse();
  }

  return Response.json(rtData, {
    status: 200,
    headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
  });
}
