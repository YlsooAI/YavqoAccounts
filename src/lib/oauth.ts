import {
  createECDH,
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  hkdfSync,
  randomUUID,
  sign as cryptoSign,
  timingSafeEqual,
  verify as cryptoVerify,
  type JsonWebKey,
  type KeyObject,
} from "crypto";
import { OAUTH_SCOPES, type OAuthScope } from "@/lib/oauth-scopes";
export { SCOPE_DESCRIPTIONS, DEFAULT_SCOPES, OAUTH_SCOPES } from "@/lib/oauth-scopes";
export type { OAuthScope } from "@/lib/oauth-scopes";

export const CODE_LIFETIME_SECONDS = 10 * 60; // authorization codes: 10 min
export const TOKEN_LIFETIME_SECONDS = 60 * 60; // access tokens: 1 hour
export const REFRESH_TOKEN_LIFETIME_SECONDS = 30 * 24 * 60 * 60; // refresh tokens: 30 days

export const SUPPORTED_PROMPTS = ["none", "login", "consent", "select_account"] as const;
export type OAuthPrompt = (typeof SUPPORTED_PROMPTS)[number];

export const REAUTH_COOKIE = "yavqo-oauth-reauth";
export const ACCOUNT_SELECTED_COOKIE = "yavqo-oauth-account-selected";

// Claims captured at consent time and carried inside tokens.
export type OAuthClaims = {
  sub: string;
  email: string | null;
  email_verified: boolean;
  name: string | null;
  full_name: string | null;
  picture: string | null;
  avatar_url: string | null;
  handle: string | null;
  id_display_name: string | null;
  username: string | null;
  gender: string | null;
  birthday: string | null;
  phone: string | null;
};

export type OAuthTokenPayload = Partial<OAuthClaims> & {
  sub: string;
  authorization_id?: string;
  token_use?: "user" | "client_credentials";
  jti?: string;
  rt_family?: string;
  iss: string;
  aud: string; // client_id the token was issued for
  scope: string;
  iat: number;
  exp: number;
};

type SigningAlg = "RS256" | "ES256";

export type PublicJwk = JsonWebKey & {
  kid: string;
  use: "sig";
  alg: SigningAlg;
};

type VerificationKeyEntry = {
  kid: string;
  alg: SigningAlg;
  publicKey: KeyObject;
  jwk: PublicJwk;
};

type SigningKeyMaterial = {
  alg: SigningAlg;
  kid: string;
  privateKey: KeyObject;
  verificationKeys: VerificationKeyEntry[];
  jwks: PublicJwk[];
};

let cachedKeyMaterial: { cacheKey: string; material: SigningKeyMaterial } | null = null;

export function getCurrentEpochSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function getOAuthIssuer(requestUrl?: string): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (requestUrl) return new URL(requestUrl).origin.replace(/\/+$/, "");
  return "http://localhost:3000";
}

export function parseScopes(raw: string | null): OAuthScope[] {
  const scopes = (raw ?? "")
    .split(/\s+/)
    .filter((s): s is OAuthScope => (OAUTH_SCOPES as readonly string[]).includes(s));
  if (!scopes.includes("openid")) scopes.unshift("openid");
  return [...new Set(scopes)];
}

export function hasUnsupportedScopes(raw: string | null): boolean {
  return (raw ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .some((scope) => !(OAUTH_SCOPES as readonly string[]).includes(scope));
}

export function parseClientCredentialsScopes(raw: string | null): string[] | null {
  if (!raw || !raw.trim()) return ["client"];
  const tokens = [...new Set(raw.trim().split(/\s+/).filter(Boolean))];
  if (tokens.length > 20) return null;
  if (tokens.some((token) => !/^[a-zA-Z0-9._:-]{1,64}$/.test(token))) {
    return null;
  }
  return tokens;
}

export function parsePromptParam(
  raw: string | null
): { ok: true; prompts: OAuthPrompt[] } | { ok: false; error: string } {
  if (!raw || !raw.trim()) return { ok: true, prompts: [] };
  const parts = [...new Set(raw.trim().split(/\s+/).filter(Boolean))];
  for (const part of parts) {
    if (!(SUPPORTED_PROMPTS as readonly string[]).includes(part)) {
      return { ok: false, error: `Unsupported prompt value: ${part}` };
    }
  }
  const prompts = parts as OAuthPrompt[];
  if (prompts.includes("none") && prompts.length > 1) {
    return {
      ok: false,
      error: "prompt=none cannot be combined with other prompt values.",
    };
  }
  return { ok: true, prompts };
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

export function signConsentRequest(fields: string[]): string {
  return createHmac("sha256", getSecret()).update(JSON.stringify(fields)).digest("hex");
}

export function verifyConsentRequest(fields: string[], signature: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = Buffer.from(signConsentRequest(fields), "hex");
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

export function signCookieToken(
  payload: Record<string, unknown>,
  lifetimeSeconds = 120
): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + lifetimeSeconds };
  const encoded = base64UrlEncode(Buffer.from(JSON.stringify(fullPayload), "utf8"));
  const sig = base64UrlEncode(
    createHmac("sha256", getSecret()).update(encoded).digest()
  );
  return `${encoded}.${sig}`;
}

export function verifyCookieToken<T extends Record<string, unknown>>(
  token: string | undefined | null
): (T & { iat: number; exp: number }) | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expected = base64UrlEncode(
    createHmac("sha256", getSecret()).update(encoded).digest()
  );
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const decoded = JSON.parse(base64UrlDecode(encoded).toString("utf8")) as T & {
      iat?: number;
      exp?: number;
    };
    if (
      typeof decoded.iat !== "number" ||
      typeof decoded.exp !== "number" ||
      decoded.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return decoded as T & { iat: number; exp: number };
  } catch {
    return null;
  }
}

function normalizePem(raw: string): string {
  return raw.replace(/\\n/g, "\n").trim();
}

function jwkThumbprint(jwk: JsonWebKey): string {
  let canonical: Record<string, unknown>;
  if (jwk.kty === "EC") {
    canonical = { crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y };
  } else if (jwk.kty === "RSA") {
    canonical = { e: jwk.e, kty: jwk.kty, n: jwk.n };
  } else {
    throw new Error(`Unsupported JWK key type: ${jwk.kty ?? "unknown"}`);
  }
  const digest = createHash("sha256")
    .update(JSON.stringify(canonical))
    .digest();
  return base64UrlEncode(digest);
}

function deriveDeterministicEcPrivateKey(secret: Buffer): KeyObject {
  for (let counter = 0; counter < 16; counter++) {
    const candidate = Buffer.from(
      hkdfSync(
        "sha256",
        secret,
        Buffer.from("yavqo-oidc-p256-salt-v1", "utf8"),
        Buffer.from(`yavqo-oidc-signing-key-${counter}`, "utf8"),
        32
      )
    );
    try {
      const ecdh = createECDH("prime256v1");
      ecdh.setPrivateKey(candidate);
      const pub = ecdh.getPublicKey(); // uncompressed: 0x04 || x(32) || y(32)
      const jwk: JsonWebKey = {
        kty: "EC",
        crv: "P-256",
        x: base64UrlEncode(pub.subarray(1, 33)),
        y: base64UrlEncode(pub.subarray(33, 65)),
        d: base64UrlEncode(candidate),
      };
      return createPrivateKey({ key: jwk, format: "jwk" });
    } catch {
      // Retry if scalar is outside [1, n-1].
    }
  }
  throw new Error("Could not derive P-256 OIDC signing key");
}

function toPublicJwkEntry(publicKey: KeyObject): VerificationKeyEntry {
  const exported = publicKey.export({ format: "jwk" }) as JsonWebKey;
  let alg: SigningAlg;
  if (exported.kty === "RSA") {
    alg = "RS256";
  } else if (exported.kty === "EC" && exported.crv === "P-256") {
    alg = "ES256";
  } else {
    throw new Error("OAUTH_OIDC keys must be RSA or EC P-256");
  }
  const kid = jwkThumbprint(exported);
  const jwk: PublicJwk = {
    ...exported,
    kid,
    use: "sig",
    alg,
  };
  return { kid, alg, publicKey, jwk };
}

function loadSigningKeys(): SigningKeyMaterial {
  const configuredPriv = process.env.OAUTH_OIDC_PRIVATE_KEY?.trim() ?? "";
  const configuredPrevPub = process.env.OAUTH_OIDC_PREVIOUS_PUBLIC_KEY?.trim() ?? "";
  const secretForCache = configuredPriv ? "" : getSecret().toString("hex");
  const cacheKey = `${configuredPriv}|${configuredPrevPub}|${secretForCache}`;

  if (cachedKeyMaterial && cachedKeyMaterial.cacheKey === cacheKey) {
    return cachedKeyMaterial.material;
  }

  const privateKey = configuredPriv
    ? createPrivateKey(normalizePem(configuredPriv))
    : deriveDeterministicEcPrivateKey(getSecret());
  const publicKey = createPublicKey(privateKey);
  const activeEntry = toPublicJwkEntry(publicKey);

  const verificationKeys: VerificationKeyEntry[] = [activeEntry];
  if (configuredPrevPub) {
    const prevPubKey = createPublicKey(normalizePem(configuredPrevPub));
    const prevEntry = toPublicJwkEntry(prevPubKey);
    if (prevEntry.kid !== activeEntry.kid) {
      verificationKeys.push(prevEntry);
    }
  }

  const material: SigningKeyMaterial = {
    alg: activeEntry.alg,
    kid: activeEntry.kid,
    privateKey,
    verificationKeys,
    jwks: verificationKeys.map((entry) => entry.jwk),
  };
  cachedKeyMaterial = { cacheKey, material };
  return material;
}

export function getPublicJwks(): { keys: PublicJwk[] } {
  return { keys: loadSigningKeys().jwks };
}

export function getActiveSigningAlg(): SigningAlg {
  return loadSigningKeys().alg;
}

function signJwtWithActiveKey(
  payload: Record<string, unknown>,
  headerType = "JWT"
): string {
  const { alg, kid, privateKey } = loadSigningKeys();
  const header = base64UrlEncode(
    Buffer.from(JSON.stringify({ alg, typ: headerType, kid }), "utf8")
  );
  const body = base64UrlEncode(Buffer.from(JSON.stringify(payload), "utf8"));
  const signingInput = Buffer.from(`${header}.${body}`, "utf8");

  const rawSignature =
    alg === "RS256"
      ? cryptoSign("RSA-SHA256", signingInput, privateKey)
      : cryptoSign("sha256", signingInput, {
          key: privateKey,
          dsaEncoding: "ieee-p1363",
        });

  return `${header}.${body}.${base64UrlEncode(rawSignature)}`;
}

function computeAtHash(accessToken: string): string {
  // Both RS256 and ES256 use SHA-256; at_hash is base64url of left-most 128 bits.
  const digest = createHash("sha256").update(accessToken, "ascii").digest();
  return base64UrlEncode(digest.subarray(0, 16));
}

export function signAccessToken(
  claims: OAuthClaims,
  issuer: string,
  clientId: string,
  scopes: OAuthScope[],
  authorizationId: string,
  options?: { familyId?: string | null }
): string {
  const now = Math.floor(Date.now() / 1000);
  const granted = new Set(scopes);
  const payload: OAuthTokenPayload = {
    sub: claims.sub,
    authorization_id: authorizationId,
    token_use: "user",
    jti: randomUUID(),
    ...(options?.familyId ? { rt_family: options.familyId } : {}),
    email: granted.has("email") ? claims.email : null,
    email_verified: granted.has("email") ? claims.email_verified : false,
    name: granted.has("profile") ? claims.name : null,
    full_name: granted.has("full_name") ? claims.full_name : null,
    picture: granted.has("profile") || granted.has("avatar") ? claims.picture : null,
    avatar_url:
      granted.has("profile") || granted.has("avatar") ? claims.avatar_url : null,
    handle: granted.has("yavqoid") ? claims.handle : null,
    id_display_name: granted.has("yavqoid") ? claims.id_display_name : null,
    username: granted.has("username") ? claims.username : null,
    gender: granted.has("gender") ? claims.gender : null,
    birthday: granted.has("birthday") ? claims.birthday : null,
    phone: granted.has("phone") ? claims.phone : null,
    iss: issuer,
    aud: clientId,
    scope: scopes.join(" "),
    iat: now,
    exp: now + TOKEN_LIFETIME_SECONDS,
  };

  return signJwtWithActiveKey(payload, "JWT");
}

export function signClientCredentialsToken(
  issuer: string,
  clientId: string,
  scopes: string[]
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: OAuthTokenPayload = {
    sub: clientId,
    token_use: "client_credentials",
    jti: randomUUID(),
    iss: issuer,
    aud: clientId,
    scope: scopes.join(" "),
    iat: now,
    exp: now + TOKEN_LIFETIME_SECONDS,
  };
  return signJwtWithActiveKey(payload, "JWT");
}

export function signIdToken(
  claims: OAuthClaims,
  issuer: string,
  clientId: string,
  scopes: OAuthScope[],
  options?: {
    nonce?: string | null;
    authTime?: number | null;
    accessToken?: string;
  }
): string {
  const now = Math.floor(Date.now() / 1000);
  const granted = new Set(scopes);
  const payload: Record<string, unknown> = {
    iss: issuer,
    sub: claims.sub,
    aud: clientId,
    exp: now + TOKEN_LIFETIME_SECONDS,
    iat: now,
  };

  if (typeof options?.authTime === "number" && Number.isFinite(options.authTime)) {
    payload.auth_time = Math.floor(options.authTime);
  }
  if (options?.nonce) {
    payload.nonce = options.nonce;
  }
  if (options?.accessToken) {
    payload.at_hash = computeAtHash(options.accessToken);
  }

  if (granted.has("email")) {
    payload.email = claims.email;
    payload.email_verified = claims.email_verified;
  }
  if (granted.has("profile")) {
    if (claims.name !== null) payload.name = claims.name;
    if (claims.picture !== null) payload.picture = claims.picture;
    if (claims.avatar_url !== null) payload.avatar_url = claims.avatar_url;
  }
  if (granted.has("full_name") && claims.full_name !== null) {
    payload.full_name = claims.full_name;
    if (!payload.name) payload.name = claims.full_name;
  }
  if (granted.has("avatar")) {
    if (claims.picture !== null) payload.picture = claims.picture;
    if (claims.avatar_url !== null) payload.avatar_url = claims.avatar_url;
  }
  if (granted.has("yavqoid")) {
    if (claims.handle !== null) payload.yavqoid_handle = claims.handle;
    if (claims.id_display_name !== null) payload.yavqoid_name = claims.id_display_name;
  }
  if (granted.has("username") && claims.username !== null) {
    payload.username = claims.username;
    payload.preferred_username = claims.username;
  }
  if (granted.has("gender") && claims.gender !== null) {
    payload.gender = claims.gender;
  }
  if (granted.has("birthday") && claims.birthday !== null) {
    payload.birthday = claims.birthday;
    payload.birthdate = claims.birthday;
  }
  if (granted.has("phone") && claims.phone !== null) {
    payload.phone = claims.phone;
    payload.phone_number = claims.phone;
  }

  return signJwtWithActiveKey(payload, "JWT");
}

export function signBackchannelLogoutToken(
  issuer: string,
  clientId: string,
  userId: string,
  authorizationId?: string
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    iss: issuer,
    sub: userId,
    aud: clientId,
    iat: now,
    jti: randomUUID(),
    events: {
      "http://schemas.openid.net/event/backchannel-logout": {},
    },
    ...(authorizationId ? { sid: authorizationId } : {}),
  };
  return signJwtWithActiveKey(payload, "logout+jwt");
}

export function verifyAccessToken(token: string): OAuthTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, bodyB64, signatureB64] = parts;

  let header: { alg?: string; typ?: string; kid?: string };
  try {
    header = JSON.parse(base64UrlDecode(headerB64).toString("utf8")) as {
      alg?: string;
      typ?: string;
      kid?: string;
    };
  } catch {
    return null;
  }

  if (header.typ === "logout+jwt") return null;

  let signatureValid = false;
  const signingInput = Buffer.from(`${headerB64}.${bodyB64}`, "utf8");

  if (header.alg === "HS256") {
    try {
      const expected = base64UrlEncode(
        createHmac("sha256", getSecret()).update(signingInput).digest()
      );
      const given = Buffer.from(signatureB64, "utf8");
      const want = Buffer.from(expected, "utf8");
      signatureValid = given.length === want.length && timingSafeEqual(given, want);
    } catch {
      signatureValid = false;
    }
  } else if (header.alg === "RS256" || header.alg === "ES256") {
    try {
      const sigBytes = base64UrlDecode(signatureB64);
      const { verificationKeys } = loadSigningKeys();
      const candidates = header.kid
        ? verificationKeys.filter(
            (entry) => entry.kid === header.kid && entry.alg === header.alg
          )
        : verificationKeys.filter((entry) => entry.alg === header.alg);

      for (const entry of candidates) {
        const ok =
          entry.alg === "RS256"
            ? cryptoVerify("RSA-SHA256", signingInput, entry.publicKey, sigBytes)
            : cryptoVerify(
                "sha256",
                signingInput,
                { key: entry.publicKey, dsaEncoding: "ieee-p1363" },
                sigBytes
              );
        if (ok) {
          signatureValid = true;
          break;
        }
      }
    } catch {
      signatureValid = false;
    }
  }

  if (!signatureValid) return null;

  try {
    const payload = JSON.parse(
      base64UrlDecode(bodyB64).toString("utf8")
    ) as OAuthTokenPayload;
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    if (typeof payload.aud !== "string" || !payload.aud) return null;
    if (payload.token_use !== "client_credentials") {
      if (
        typeof payload.authorization_id !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          payload.authorization_id
        )
      ) {
        return null;
      }
    }
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
