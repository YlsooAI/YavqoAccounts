import { buildOAuthServerMetadata } from "@/lib/oauth-metadata";
import { OAUTH_CORS_HEADERS, oauthCorsPreflight } from "@/lib/oauth-cors";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return oauthCorsPreflight();
}

export function GET(request: Request) {
  return Response.json(buildOAuthServerMetadata(request.url), {
    headers: {
      "Cache-Control": "public, max-age=300",
      ...OAUTH_CORS_HEADERS,
    },
  });
}
