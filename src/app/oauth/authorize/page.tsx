import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Check, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_SLOT_COOKIE, validSlot } from "@/lib/account-slots";
import { originFromUrl } from "@/lib/connectedApps";
import {
  ACCOUNT_SELECTED_COOKIE,
  REAUTH_COOKIE,
  SCOPE_DESCRIPTIONS,
  getCurrentEpochSeconds,
  hasUnsupportedScopes,
  parsePromptParam,
  parseScopes,
  signConsentRequest,
  verifyConsentRequest,
  verifyCookieToken,
  type OAuthPrompt,
  type OAuthScope,
} from "@/lib/oauth";
import { AuthorizeButton, CancelButton } from "@/components/OAuthConsentButtons";
import OAuthPasskeyGate from "@/components/OAuthPasskeyGate";
import { sendOAuthAuthorizationEmail } from "@/lib/oauth-notification";

export const dynamic = "force-dynamic";

type OAuthClient = {
  client_id: string;
  name: string;
  redirect_uris: string[];
  client_type: "confidential" | "public";
  require_pkce: boolean;
};

type AuthRequest = {
  client: OAuthClient;
  redirectUri: string;
  scopes: OAuthScope[];
  state: string | null;
  codeChallenge: string | null;
  codeChallengeMethod: "S256" | "plain" | null;
  oidcNonce: string | null;
  prompts: OAuthPrompt[];
  loginHint: string | null;
  maxAge: number | null;
};

type ResolveResult =
  | { ok: true; request: AuthRequest }
  | { ok: false; error: string }
  | {
      ok: false;
      redirectError: {
        redirectUri: string;
        code: string;
        description: string;
        state: string | null;
      };
    };

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | null {
  return typeof value === "string" && value ? value : null;
}

function redirectOAuthError(
  redirectUri: string,
  error: string,
  description: string,
  state: string | null
): never {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  url.searchParams.set("error_description", description);
  if (state) url.searchParams.set("state", state);
  redirect(url.toString());
}

// Validates the authorize request. Client/redirect errors cannot be redirected
// back (untrusted redirect_uri), so they render an error card. Once redirect_uri
// is trusted, protocol errors redirect back per RFC 6749 Section 4.1.2.1.
async function resolveAuthRequest(
  searchParams: SearchParams
): Promise<ResolveResult> {
  const clientId = first(searchParams.client_id);
  const redirectUri = first(searchParams.redirect_uri);

  if (!clientId || !redirectUri) {
    return { ok: false, error: "Missing client_id or redirect_uri." };
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("oauth_get_client_public", {
    p_client_id: clientId,
  });
  const client = data as OAuthClient | null;

  if (!client) {
    return { ok: false, error: "Unknown app. Check the client_id." };
  }

  let parsedRedirect: URL;
  try {
    parsedRedirect = new URL(redirectUri);
  } catch {
    return { ok: false, error: "The redirect_uri is not a valid URL." };
  }
  if (!["http:", "https:"].includes(parsedRedirect.protocol)) {
    return { ok: false, error: "The redirect_uri must use http or https." };
  }
  // Exact match only — prevents open redirects via path/query tricks.
  if (!client.redirect_uris.includes(redirectUri)) {
    return { ok: false, error: "The redirect_uri is not registered for this app." };
  }

  const state = first(searchParams.state);

  if (first(searchParams.response_type) !== "code") {
    return {
      ok: false,
      redirectError: {
        redirectUri,
        code: "unsupported_response_type",
        description: "Only response_type=code is supported.",
        state,
      },
    };
  }
  if (hasUnsupportedScopes(first(searchParams.scope))) {
    return {
      ok: false,
      redirectError: {
        redirectUri,
        code: "invalid_scope",
        description: "This app requested an unsupported permission.",
        state,
      },
    };
  }

  const promptParsed = parsePromptParam(first(searchParams.prompt));
  if (!promptParsed.ok) {
    return {
      ok: false,
      redirectError: {
        redirectUri,
        code: "invalid_request",
        description: promptParsed.error,
        state,
      },
    };
  }

  const rawMaxAge = first(searchParams.max_age);
  let maxAge: number | null = null;
  if (rawMaxAge !== null) {
    if (!/^\d+$/.test(rawMaxAge)) {
      return {
        ok: false,
        redirectError: {
          redirectUri,
          code: "invalid_request",
          description: "max_age must be a non-negative integer.",
          state,
        },
      };
    }
    maxAge = Number(rawMaxAge);
  }

  const codeChallenge = first(searchParams.code_challenge);
  const rawMethod = first(searchParams.code_challenge_method);
  if (
    codeChallenge &&
    rawMethod &&
    rawMethod !== "S256" &&
    rawMethod !== "plain"
  ) {
    return {
      ok: false,
      redirectError: {
        redirectUri,
        code: "invalid_request",
        description: "Unsupported code_challenge_method.",
        state,
      },
    };
  }

  const codeChallengeMethod: "S256" | "plain" | null = codeChallenge
    ? rawMethod === "plain"
      ? "plain"
      : "S256"
    : null;

  if (
    client.client_type === "public" &&
    (!codeChallenge || codeChallengeMethod !== "S256")
  ) {
    return {
      ok: false,
      redirectError: {
        redirectUri,
        code: "invalid_request",
        description: "Public clients must use PKCE with code_challenge_method=S256.",
        state,
      },
    };
  }

  if (client.require_pkce && !codeChallenge) {
    return {
      ok: false,
      redirectError: {
        redirectUri,
        code: "invalid_request",
        description: "This app requires PKCE (code_challenge).",
        state,
      },
    };
  }

  return {
    ok: true,
    request: {
      client,
      redirectUri,
      scopes: parseScopes(first(searchParams.scope)),
      state,
      codeChallenge,
      codeChallengeMethod,
      oidcNonce: first(searchParams.nonce),
      prompts: promptParsed.prompts,
      loginHint: first(searchParams.login_hint),
      maxAge,
    },
  };
}

async function approve(formData: FormData) {
  "use server";
  await completeConsent(formData, true);
}

async function deny(formData: FormData) {
  "use server";
  await completeConsent(formData, false);
}

async function completeConsent(formData: FormData, approved: boolean) {
  const clientId = String(formData.get("client_id") ?? "");
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const scope = String(formData.get("scope") ?? "");
  const state = String(formData.get("state") ?? "");
  const codeChallenge = String(formData.get("code_challenge") ?? "");
  const codeChallengeMethod = String(formData.get("code_challenge_method") ?? "");
  const oidcNonce = String(formData.get("oidc_nonce") ?? "");
  const authTime = Number(formData.get("auth_time"));
  const consentSignature = String(formData.get("consent_signature") ?? "");
  const nonce = String(formData.get("passkey_nonce") ?? "");
  const issuedAt = Number(formData.get("issued_at"));
  const previousSessionId = String(formData.get("previous_session_id") ?? "");

  if (hasUnsupportedScopes(scope) || parseScopes(scope).join(" ") !== scope) redirect("/");
  if (
    !/^[a-f0-9-]{36}$/.test(nonce) ||
    !Number.isSafeInteger(issuedAt) ||
    !Number.isSafeInteger(authTime) ||
    issuedAt > Date.now() / 1000 ||
    issuedAt < Date.now() / 1000 - 600
  ) {
    redirect("/");
  }

  // Re-validate everything server-side; form data is user-controlled.
  const supabase = await createClient();
  const { data } = await supabase.rpc("oauth_get_client_public", {
    p_client_id: clientId,
  });
  const client = data as OAuthClient | null;
  if (!client || !client.redirect_uris.includes(redirectUri)) {
    redirect("/");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (
    !user ||
    !verifyConsentRequest(
      [
        user.id,
        clientId,
        redirectUri,
        scope,
        state,
        codeChallenge,
        codeChallengeMethod,
        oidcNonce,
        String(authTime),
        nonce,
        String(issuedAt),
        previousSessionId,
      ],
      consentSignature
    )
  ) {
    redirect("/");
  }

  if (!approved) {
    redirectOAuthError(
      redirectUri,
      "access_denied",
      "The user denied the request.",
      state || null
    );
  }

  const { data: passkeys, error: passkeyError } = await supabase.auth.passkey.list();
  const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
  const passkeysDisabled = passkeyError?.code === "passkey_disabled";
  if (
    (passkeyError && !passkeysDisabled) ||
    (!passkeys && !passkeysDisabled) ||
    factorError ||
    !factors
  ) {
    redirect("/");
  }
  if ((passkeys?.length ?? 0) > 0) {
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const claims = claimsData?.claims;
    const hasFreshPasskey =
      Array.isArray(claims?.amr) &&
      claims.amr.some((entry) =>
        typeof entry === "string"
          ? entry === "passkey"
          : entry.method === "passkey" &&
            typeof entry.timestamp === "number" &&
            entry.timestamp >= issuedAt
      );
    if (
      claimsError ||
      !claims ||
      claims.sub !== user.id ||
      claims.session_id === previousSessionId ||
      claims.iat < issuedAt ||
      !hasFreshPasskey
    ) {
      redirect("/");
    }
  }

  const { data: code, error } = await supabase.rpc("oauth_issue_code", {
    p_nonce: nonce,
    p_client_id: clientId,
    p_redirect_uri: redirectUri,
    p_scope: scope,
    p_code_challenge: codeChallenge || null,
    p_code_challenge_method: codeChallenge ? codeChallengeMethod || "S256" : null,
    p_oidc_nonce: oidcNonce || null,
    p_auth_time: authTime,
  });
  if (error || typeof code !== "string") redirect("/");

  const { siteUrl, siteHost } = originFromUrl(redirectUri);
  const { error: authorizationError } = await supabase
    .from("id_oauth_authorizations")
    .upsert(
      {
        user_id: user.id,
        client_id: clientId,
        site_title: client.name,
        site_url: siteUrl,
        site_host: siteHost,
        scope,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "user_id,client_id" }
    );
  if (authorizationError) redirect("/");

  if (user.email) {
    try {
      await sendOAuthAuthorizationEmail({
        to: user.email,
        clientName: client.name,
        siteHost,
        authorizationCode: code,
      });
    } catch (notificationError) {
      console.error("OAuth authorization email failed", notificationError);
    }
  }

  const url = new URL(redirectUri);
  url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);
  redirect(url.toString());
}

export default async function OAuthAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const resolved = await resolveAuthRequest(params);

  if (!resolved.ok) {
    if ("redirectError" in resolved) {
      redirectOAuthError(
        resolved.redirectError.redirectUri,
        resolved.redirectError.code,
        resolved.redirectError.description,
        resolved.redirectError.state
      );
    }

    return (
      <main className="account-shell oauth-page">
        <div className="oauth-column">
          <Link href="/" className="oauth-back" aria-label="Back to your account">
            <ChevronLeft size={24} aria-hidden="true" />
          </Link>
          <h1 className="oauth-heading">Unable to authorize this app</h1>
          <p className="oauth-error" role="alert">
            {resolved.error}
          </p>
          <p className="oauth-description">
            If you followed a link here, contact the app that sent you.
          </p>
          <Link href="/" className="oauth-primary oauth-return">
            Back to your account
          </Link>
        </div>
      </main>
    );
  }

  const {
    client,
    redirectUri,
    scopes,
    state,
    codeChallenge,
    codeChallengeMethod,
    oidcNonce,
    prompts,
    loginHint,
    maxAge,
  } = resolved.request;

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
    else if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
  }
  const currentAuthorizeUrl = `/oauth/authorize?${query.toString()}`;
  const chooserHref = `/accounts?next=${encodeURIComponent(currentAuthorizeUrl)}`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (prompts.includes("none")) {
      redirectOAuthError(
        redirectUri,
        "login_required",
        "User is not signed in.",
        state
      );
    }
    if (prompts.includes("select_account")) {
      redirect(chooserHref);
    }
    const loginParams = new URLSearchParams({ next: currentAuthorizeUrl });
    if (loginHint) loginParams.set("login_hint", loginHint);
    redirect(`/login?${loginParams.toString()}`);
  }

  const [passkeyResult, factorResult, claimsResult, existingAuthResult] =
    await Promise.all([
      supabase.auth.passkey.list(),
      supabase.auth.mfa.listFactors(),
      supabase.auth.getClaims(),
      supabase
        .from("id_oauth_authorizations")
        .select("id, scope")
        .eq("user_id", user.id)
        .eq("client_id", client.client_id)
        .maybeSingle(),
    ]);

  const previousSessionId = claimsResult.data?.claims?.session_id;
  const passkeysDisabled = passkeyResult.error?.code === "passkey_disabled";
  if (
    (passkeyResult.error && !passkeysDisabled) ||
    (!passkeyResult.data && !passkeysDisabled) ||
    factorResult.error ||
    !factorResult.data ||
    claimsResult.error ||
    !previousSessionId
  ) {
    return (
      <main className="account-shell oauth-page">
        <div className="oauth-column">
          <h1 className="oauth-heading">Authorization is unavailable</h1>
          <p className="oauth-error" role="alert">
            Additional verification is not available right now. Please try again later.
          </p>
          <Link href="/" className="oauth-primary oauth-return">
            Back to your account
          </Link>
        </div>
      </main>
    );
  }

  const cookieStore = await cookies();
  let reauthPayload: { userId?: string; sessionId?: string; authTime?: number } | null = null;
  let selectedPayload: { slot?: string } | null = null;
  try {
    reauthPayload = verifyCookieToken<{
      userId?: string;
      sessionId?: string;
      authTime?: number;
    }>(cookieStore.get(REAUTH_COOKIE)?.value);
    selectedPayload = verifyCookieToken<{ slot?: string }>(
      cookieStore.get(ACCOUNT_SELECTED_COOKIE)?.value
    );
  } catch {
    // Missing OAUTH_JWT_SECRET falls through to checkpoint error below.
  }

  const validReauth = Boolean(
    reauthPayload &&
      reauthPayload.userId === user.id &&
      reauthPayload.sessionId === previousSessionId
  );
  const lastSignInEpoch = user.last_sign_in_at
    ? Math.floor(Date.parse(user.last_sign_in_at) / 1000)
    : 0;
  const nowEpoch = getCurrentEpochSeconds();
  const authTime =
    validReauth && typeof reauthPayload?.authTime === "number"
      ? Math.max(lastSignInEpoch, reauthPayload.authTime)
      : lastSignInEpoch || nowEpoch;

  const needsLoginPrompt = prompts.includes("login") && !validReauth;
  const needsMaxAge = maxAge !== null && nowEpoch - authTime > maxAge;

  if (needsLoginPrompt || needsMaxAge) {
    if (prompts.includes("none")) {
      redirectOAuthError(
        redirectUri,
        "login_required",
        "Fresh authentication is required.",
        state
      );
    }
    const loginParams = new URLSearchParams({
      prompt: "login",
      next: currentAuthorizeUrl,
    });
    if (loginHint) loginParams.set("login_hint", loginHint);
    redirect(`/login?${loginParams.toString()}`);
  }

  const currentSlot = validSlot(cookieStore.get(ACTIVE_SLOT_COOKIE)?.value);
  if (prompts.includes("select_account") && selectedPayload?.slot !== currentSlot) {
    redirect(chooserHref);
  }

  const existingAuth = existingAuthResult.data as
    | { id: string; scope: string }
    | null;
  const existingScopes = existingAuth?.scope
    ? existingAuth.scope.split(/\s+/).filter(Boolean)
    : [];
  const hasPriorConsent = Boolean(
    existingAuth && scopes.every((scope) => existingScopes.includes(scope))
  );

  const loginHintMismatch = Boolean(
    loginHint &&
      loginHint.includes("@") &&
      user.email &&
      loginHint.toLowerCase() !== user.email.toLowerCase()
  );

  if (prompts.includes("none")) {
    if (loginHintMismatch) {
      redirectOAuthError(
        redirectUri,
        "login_required",
        "The signed-in account does not match login_hint.",
        state
      );
    }
    if (!hasPriorConsent) {
      redirectOAuthError(
        redirectUri,
        "consent_required",
        "User consent is required.",
        state
      );
    }
  }

  if (hasPriorConsent && !prompts.includes("consent") && !loginHintMismatch) {
    const { data: rememberedCode, error: rememberedError } = await supabase.rpc(
      "oauth_issue_remembered_code",
      {
        p_client_id: client.client_id,
        p_redirect_uri: redirectUri,
        p_scope: scopes.join(" "),
        p_code_challenge: codeChallenge,
        p_code_challenge_method: codeChallenge ? codeChallengeMethod || "S256" : null,
        p_oidc_nonce: oidcNonce,
        p_auth_time: authTime,
      }
    );

    if (!rememberedError && typeof rememberedCode === "string") {
      const url = new URL(redirectUri);
      url.searchParams.set("code", rememberedCode);
      if (state) url.searchParams.set("state", state);
      redirect(url.toString());
    }

    if (prompts.includes("none")) {
      const msg = rememberedError?.message ?? "";
      const code = msg.includes("consent_required")
        ? "consent_required"
        : msg.includes("interaction_required")
          ? "interaction_required"
          : "server_error";
      redirectOAuthError(
        redirectUri,
        code,
        "Interactive authorization is required.",
        state
      );
    }
  }

  const targetHost = new URL(redirectUri).hostname;
  const { data: challenge, error: challengeError } = await supabase.rpc(
    "oauth_begin_passkey_challenge"
  );
  const checkpoint = challenge as {
    nonce?: string;
    issued_at?: number;
    previous_session_id?: string;
  } | null;
  if (
    challengeError ||
    !checkpoint?.nonce ||
    !Number.isSafeInteger(checkpoint.issued_at) ||
    checkpoint.previous_session_id !== previousSessionId
  ) {
    return (
      <main className="account-shell oauth-page">
        <div className="oauth-column">
          <h1 className="oauth-heading">Authorization is unavailable</h1>
          <p className="oauth-error" role="alert">
            The security checkpoint could not start. Please try again.
          </p>
          <Link href="/" className="oauth-primary oauth-return">
            Back to your account
          </Link>
        </div>
      </main>
    );
  }
  const nonce = checkpoint.nonce;
  const issuedAt = checkpoint.issued_at as number;
  const consentSignature = signConsentRequest([
    user.id,
    client.client_id,
    redirectUri,
    scopes.join(" "),
    state ?? "",
    codeChallenge ?? "",
    codeChallengeMethod ?? "",
    oidcNonce ?? "",
    String(authTime),
    nonce,
    String(issuedAt),
    previousSessionId,
  ]);

  return (
    <main className="account-shell oauth-page">
      <div className="oauth-column">
        <button
          type="submit"
          form="oauth-deny"
          className="oauth-back"
          aria-label="Cancel authorization and go back"
        >
          <ChevronLeft size={24} aria-hidden="true" />
        </button>
        <div>
          <h1 className="oauth-heading">Authorize {client.name}?</h1>
          <p className="oauth-description">
            {hasPriorConsent
              ? `You previously connected ${client.name}. Confirm verification below to continue.`
              : `Connect your Yavqo Account to ${client.name}. Review the information you'll share before continuing.`}
          </p>
          <div className="oauth-identity">
            <UserRound size={22} aria-hidden="true" />
            <div className="min-w-0">
              <span className="oauth-label">Signed in with Yavqo</span>
              <p className="oauth-email">{user.email}</p>
            </div>
          </div>
          {loginHintMismatch && (
            <p className="oauth-notice" style={{ marginTop: 10 }}>
              {client.name} suggested signing in as <strong>{loginHint}</strong>.
            </p>
          )}
          <Link href={chooserHref} className="oauth-switch-account">
            Use another account
          </Link>
        </div>

        <section
          className="oauth-permissions"
          aria-labelledby="oauth-permissions-title"
        >
          <h2 id="oauth-permissions-title">This app will be able to:</h2>
          <ul>
            {scopes.map((scope) => (
              <li key={scope}>
                <Check size={18} aria-hidden="true" />
                {SCOPE_DESCRIPTIONS[scope]}
              </li>
            ))}
          </ul>
        </section>

        <p className="oauth-notice">
          Only continue if you trust {targetHost}. You can always revoke access
          later in <Link href="/apps">Connected apps</Link>.
        </p>

        <div className="oauth-actions">
          <OAuthPasskeyGate
            userId={user.id}
            hasPasskey={(passkeyResult.data?.length ?? 0) > 0}
            passkeyAvailable={!passkeysDisabled}
            totpFactorId={factorResult.data.totp[0]?.id ?? null}
          >
            <form action={approve} noValidate className="oauth-approve-form">
              <HiddenRequestFields
                clientId={client.client_id}
                redirectUri={redirectUri}
                scope={scopes.join(" ")}
                state={state}
                codeChallenge={codeChallenge}
                codeChallengeMethod={codeChallengeMethod}
                oidcNonce={oidcNonce}
                authTime={authTime}
                consentSignature={consentSignature}
                nonce={nonce}
                issuedAt={issuedAt}
                previousSessionId={previousSessionId}
              />
              <AuthorizeButton />
            </form>
          </OAuthPasskeyGate>
          <form
            action={deny}
            noValidate
            id="oauth-deny"
            className="oauth-cancel-form"
          >
            <HiddenRequestFields
              clientId={client.client_id}
              redirectUri={redirectUri}
              scope={scopes.join(" ")}
              state={state}
              codeChallenge={codeChallenge}
              codeChallengeMethod={codeChallengeMethod}
              oidcNonce={oidcNonce}
              authTime={authTime}
              consentSignature={consentSignature}
              nonce={nonce}
              issuedAt={issuedAt}
              previousSessionId={previousSessionId}
            />
            <CancelButton />
          </form>
        </div>
      </div>
    </main>
  );
}

function HiddenRequestFields({
  clientId,
  redirectUri,
  scope,
  state,
  codeChallenge,
  codeChallengeMethod,
  oidcNonce,
  authTime,
  consentSignature,
  nonce,
  issuedAt,
  previousSessionId,
}: {
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string | null;
  codeChallenge: string | null;
  codeChallengeMethod: string | null;
  oidcNonce: string | null;
  authTime: number;
  consentSignature: string;
  nonce: string;
  issuedAt: number;
  previousSessionId: string;
}) {
  return (
    <>
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="redirect_uri" value={redirectUri} />
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="consent_signature" value={consentSignature} />
      <input type="hidden" name="passkey_nonce" value={nonce} />
      <input type="hidden" name="issued_at" value={issuedAt} />
      <input type="hidden" name="previous_session_id" value={previousSessionId} />
      <input type="hidden" name="state" value={state ?? ""} />
      <input type="hidden" name="code_challenge" value={codeChallenge ?? ""} />
      <input
        type="hidden"
        name="code_challenge_method"
        value={codeChallengeMethod ?? ""}
      />
      <input type="hidden" name="oidc_nonce" value={oidcNonce ?? ""} />
      <input type="hidden" name="auth_time" value={authTime} />
    </>
  );
}
