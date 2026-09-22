import { verifyAccessToken } from "@/lib/oauth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// OAuth userinfo endpoint — returns the consented claims for the bearer
// of a valid access token issued by /oauth/token.
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : null;

  if (!token) {
    return Response.json({ error: "invalid_token" }, { status: 401 });
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    return Response.json(
      { error: "invalid_token", error_description: "Token is invalid or expired." },
      { status: 401 }
    );
  }

  // A signed JWT alone is insufficient: removing the connected app must
  // invalidate already-issued tokens on the very next request.
  const supabase = await createClient();
  const { data: active, error } = await supabase.rpc("oauth_authorization_active", {
    p_authorization_id: payload.authorization_id,
    p_user_id: payload.sub,
    p_client_id: payload.aud,
    p_scope: payload.scope,
  });
  if (error || active !== true) {
    return Response.json({ error: "invalid_token" }, {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const scopes = new Set(payload.scope.split(/\s+/).filter(Boolean));
  const info: Record<string, unknown> = { sub: payload.sub };

  if (scopes.has("email")) {
    info.email = payload.email;
    info.email_verified = payload.email_verified;
  }
  if (scopes.has("profile")) {
    info.name = payload.name;
    info.picture = payload.picture;
  }
  if (scopes.has("profile") || scopes.has("avatar")) {
    info.avatar_url = payload.avatar_url;
  }
  if (scopes.has("yavqoid")) {
    info.yavqoid_handle = payload.handle;
    info.yavqoid_name = payload.id_display_name;
  }
  if (scopes.has("full_name")) info.full_name = payload.full_name;
  if (scopes.has("avatar") && !scopes.has("profile")) info.picture = payload.picture;
  if (scopes.has("username")) info.username = payload.username;
  if (scopes.has("gender")) info.gender = payload.gender;
  if (scopes.has("birthday")) info.birthday = payload.birthday;
  if (scopes.has("phone")) info.phone = payload.phone;

  return Response.json(info, {
    headers: { "Cache-Control": "no-store" },
  });
}
