import { createHash, createHmac, timingSafeEqual } from "crypto";

// Scopes supported by "Sign in with Yavqo Account".
export const OAUTH_SCOPES = ["openid", "profile", "email", "yavqoid"] as const;
export type OAuthScope = (typeof OAUTH_SCOPES)[number];

export const SCOPE_DESCRIPTIONS: Record<OAuthScope, string> = {
  openid: "Verify your identity",
  profile: "See your name and profile picture",
  email: "See your email address",
  yavqoid: "See your YavqoID handle",
};

export const DEFAULT_SCOPES: OAuthScope[] = ["openid", "profile", "email"];

export const CODE_LIFETIME_SECONDS = 10 * 60; // authorization codes: 10 min
export const TOKEN_LIFETIME_SECONDS = 60 * 60; // access tokens: 1 hour

// Claims captured at consent time and carried inside the access token.
export type OAuthClaims = {
  sub: string;
  email: string | null;
  email_verified: boolean;
  name: string | null;
  picture: string | null;
  handle: string | null;
  id_display_name: string | null;
};

export type OAuthTokenPayload = OAuthClaims & {
  iss: string;
  aud: string; // client_id the token was issued for
  scope: string;
  iat: number;
  exp: number;
};

export function parseScopes(raw: string | null): OAuthScope[] {
  const scopes = (raw ?? "")
    .split(/\s+/)
    .filter((s): s is OAuthScope => (OAUTH_SCOPES as readonly string[]).includes(s));
  if (!scopes.includes("openid")) scopes.unshift("openid");
  return [...new Set(scopes)];
}

function base64UrlEncode(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

function getSecret(): Buffer {
  const secret = process.env.OAUTH_JWT_SECRET;
  if (!secret) {
    throw new Error("OAUTH_JWT_SECRET is not configured");
  }
  return Buffer.from(secret, "utf8");
}

// Self-contained access tokens: HMAC-SHA256 signed JWTs carrying the
// consented claims, so the token and userinfo endpoints need no session.
export function signAccessToken(
  claims: OAuthClaims,
  issuer: string,
  clientId: string,
  scopes: OAuthScope[]
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: OAuthTokenPayload = {
    ...claims,
    iss: issuer,
    aud: clientId,
    scope: scopes.join(" "),
    iat: now,
    exp: now + TOKEN_LIFETIME_SECONDS,
  };

  const header = base64UrlEncode(
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }), "utf8")
  );
  const body = base64UrlEncode(Buffer.from(JSON.stringify(payload), "utf8"));
  const signature = base64UrlEncode(
    createHmac("sha256", getSecret()).update(`${header}.${body}`).digest()
  );
  return `${header}.${body}.${signature}`;
}

export function verifyAccessToken(token: string): OAuthTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;

  const expected = base64UrlEncode(
    createHmac("sha256", getSecret()).update(`${header}.${body}`).digest()
  );
  const given = Buffer.from(signature, "utf8");
  const want = Buffer.from(expected, "utf8");
  if (given.length !== want.length || !timingSafeEqual(given, want)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      base64UrlDecode(body).toString("utf8")
    ) as OAuthTokenPayload;
    if (typeof payload.sub !== "string") return null;
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function generateAuthorizationCode(): string {
  return createHash("sha256")
    .update(crypto.getRandomValues(new Uint8Array(32)))
    .digest("hex");
}
