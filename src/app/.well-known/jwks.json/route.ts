import { getPublicJwks } from "@/lib/oauth";
import { OAUTH_CORS_HEADERS, oauthCorsPreflight } from "@/lib/oauth-cors";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return oauthCorsPreflight();
}

export function GET() {
  return Response.json(getPublicJwks(), {
    headers: {
      "Cache-Control": "public, max-age=300",
      ...OAUTH_CORS_HEADERS,
    },
  });
}
