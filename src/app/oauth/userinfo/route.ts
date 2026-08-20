import { verifyAccessToken } from "@/lib/oauth";

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
  if (scopes.has("yavqoid")) {
    info.yavqoid_handle = payload.handle;
    info.yavqoid_name = payload.id_display_name;
  }

  return Response.json(info, {
    headers: { "Cache-Control": "no-store" },
  });
}
