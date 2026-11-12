import { verifyAccessToken } from "@/lib/oauth";
import { OAUTH_CORS_HEADERS, oauthCorsPreflight } from "@/lib/oauth-cors";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function unauthorized(description?: string) {
  return Response.json(
    description
      ? { error: "invalid_token", error_description: description }
      : { error: "invalid_token" },
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
        "WWW-Authenticate": 'Bearer error="invalid_token"',
        ...OAUTH_CORS_HEADERS,
      },
    }
  );
}

async function handleUserInfo(token: string | null) {
  if (!token) {
    return unauthorized();
  }

  const payload = verifyAccessToken(token);
  if (!payload || payload.token_use === "client_credentials" || !payload.authorization_id) {
    return unauthorized("Token is invalid or expired.");
  }

  // Live check: revoking the connected app, refresh family, or token JTI
  // invalidates already-issued tokens immediately.
  const supabase = await createClient();
  const { data: active, error } = await supabase.rpc("oauth_token_active", {
    p_authorization_id: payload.authorization_id,
    p_user_id: payload.sub,
    p_client_id: payload.aud,
    p_scope: payload.scope,
    p_jti: payload.jti ?? null,
    p_family_id: payload.rt_family ?? null,
  });
  if (error || active !== true) {
    return unauthorized();
  }

  const scopes = new Set(payload.scope.split(/\s+/).filter(Boolean));
  const info: Record<string, unknown> = { sub: payload.sub };

  if (scopes.has("email")) {
    info.email = payload.email ?? null;
    info.email_verified = Boolean(payload.email_verified);
  }
  if (scopes.has("profile")) {
    info.name = payload.name ?? null;
    info.picture = payload.picture ?? null;
  }
  if (scopes.has("profile") || scopes.has("avatar")) {
    info.avatar_url = payload.avatar_url ?? null;
  }
  if (scopes.has("yavqoid")) {
    info.yavqoid_handle = payload.handle ?? null;
    info.yavqoid_name = payload.id_display_name ?? null;
  }
  if (scopes.has("full_name")) info.full_name = payload.full_name ?? null;
  if (scopes.has("avatar") && !scopes.has("profile")) {
    info.picture = payload.picture ?? null;
  }
  if (scopes.has("username")) {
    info.username = payload.username ?? null;
    info.preferred_username = payload.username ?? null;
  }
  if (scopes.has("gender")) info.gender = payload.gender ?? null;
  if (scopes.has("birthday")) {
    info.birthday = payload.birthday ?? null;
    info.birthdate = payload.birthday ?? null;
  }
  if (scopes.has("phone")) {
    info.phone = payload.phone ?? null;
    info.phone_number = payload.phone ?? null;
  }

  return Response.json(info, {
    headers: {
      "Cache-Control": "no-store",
      ...OAUTH_CORS_HEADERS,
    },
  });
}

function bearerFromHeader(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice("Bearer ".length).trim() || null;
}

export function OPTIONS() {
  return oauthCorsPreflight();
}

export async function GET(request: Request) {
  return handleUserInfo(bearerFromHeader(request));
}

export async function POST(request: Request) {
  let token = bearerFromHeader(request);
  if (!token) {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(await request.text());
      token = params.get("access_token")?.trim() || null;
    }
  }
  return handleUserInfo(token);
}
