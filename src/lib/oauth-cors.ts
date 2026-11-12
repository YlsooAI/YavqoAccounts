export const OAUTH_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

export function oauthCorsPreflight() {
  return new Response(null, {
    status: 204,
    headers: OAUTH_CORS_HEADERS,
  });
}
