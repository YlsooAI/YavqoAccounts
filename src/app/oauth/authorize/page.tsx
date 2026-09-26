import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Check, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAccountUser } from "@/lib/account";
import { originFromUrl } from "@/lib/connectedApps";
import {
  SCOPE_DESCRIPTIONS,
  hasUnsupportedScopes,
  parseScopes,
  signConsentRequest,
  verifyConsentRequest,
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
};

type AuthRequest = {
  client: OAuthClient;
  redirectUri: string;
  scopes: OAuthScope[];
  state: string | null;
  codeChallenge: string | null;
  codeChallengeMethod: "S256" | "plain" | null;
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | null {
  return typeof value === "string" && value ? value : null;
}

// Validates the authorize request. Anything invalid here cannot be
// redirected back (no trusted redirect_uri), so it renders an error card.
async function resolveAuthRequest(
  searchParams: SearchParams
): Promise<{ ok: true; request: AuthRequest } | { ok: false; error: string }> {
  const clientId = first(searchParams.client_id);
  const redirectUri = first(searchParams.redirect_uri);

  if (!clientId || !redirectUri) {
    return { ok: false, error: "Missing client_id or redirect_uri." };
  }
  if (first(searchParams.response_type) !== "code") {
    return { ok: false, error: "Only response_type=code is supported." };
  }
  if (hasUnsupportedScopes(first(searchParams.scope))) {
    return { ok: false, error: "This app requested an unsupported permission." };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("id_oauth_clients")
    .select("client_id, name, redirect_uris")
    .eq("client_id", clientId)
    .maybeSingle();
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

  const codeChallenge = first(searchParams.code_challenge);
  const rawMethod = first(searchParams.code_challenge_method);
  const codeChallengeMethod: "S256" | "plain" | null = codeChallenge
    ? rawMethod === "plain"
      ? "plain"
      : "S256"
    : null;

  return {
    ok: true,
    request: {
      client,
      redirectUri,
      scopes: parseScopes(first(searchParams.scope)),
      state: first(searchParams.state),
      codeChallenge,
      codeChallengeMethod,
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
  const consentSignature = String(formData.get("consent_signature") ?? "");
  const nonce = String(formData.get("passkey_nonce") ?? "");
  const issuedAt = Number(formData.get("issued_at"));
  const previousSessionId = String(formData.get("previous_session_id") ?? "");
  if (hasUnsupportedScopes(scope) || parseScopes(scope).join(" ") !== scope) redirect("/");
  if (!/^[a-f0-9-]{36}$/.test(nonce) || !Number.isSafeInteger(issuedAt) ||
      issuedAt > Date.now() / 1000 || issuedAt < Date.now() / 1000 - 600) redirect("/");

  // Re-validate everything server-side; form data is user-controlled.
  const supabase = await createClient();
  const { data } = await supabase
    .from("id_oauth_clients")
    .select("client_id, name, redirect_uris")
    .eq("client_id", clientId)
    .maybeSingle();
  const client = data as OAuthClient | null;
  if (!client || !client.redirect_uris.includes(redirectUri)) {
    redirect("/");
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !verifyConsentRequest(
    [user.id, clientId, redirectUri, scope, state, codeChallenge, codeChallengeMethod,
      nonce, String(issuedAt), previousSessionId],
    consentSignature
  )) redirect("/");

  if (!approved) {
    const url = new URL(redirectUri);
    url.searchParams.set("error", "access_denied");
    url.searchParams.set("error_description", "The user denied the request.");
    if (state) url.searchParams.set("state", state);
    redirect(url.toString());
  }

  const { data: passkeys, error: passkeyError } = await supabase.auth.passkey.list();
  const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
  const passkeysDisabled = passkeyError?.code === "passkey_disabled";
  if ((passkeyError && !passkeysDisabled) || (!passkeys && !passkeysDisabled) ||
      factorError || !factors) redirect("/");
  if ((passkeys?.length ?? 0) > 0) {
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const claims = claimsData?.claims;
    const hasFreshPasskey = Array.isArray(claims?.amr) && claims.amr.some((entry) =>
      typeof entry === "string"
        ? entry === "passkey"
        : entry.method === "passkey" &&
          typeof entry.timestamp === "number" && entry.timestamp >= issuedAt
    );
    if (claimsError || !claims || claims.sub !== user.id ||
        claims.session_id === previousSessionId || claims.iat < issuedAt ||
        !hasFreshPasskey) redirect("/");
  }

  const { data: code, error } = await supabase.rpc("oauth_issue_code", {
    p_nonce: nonce,
    p_client_id: clientId,
    p_redirect_uri: redirectUri,
    p_scope: scope,
    p_code_challenge: codeChallenge || null,
    p_code_challenge_method: codeChallenge ? codeChallengeMethod || "S256" : null,
  });
  if (error || typeof code !== "string") redirect("/");

  const { siteUrl, siteHost } = originFromUrl(redirectUri);
  const { error: authorizationError } = await supabase.from("id_oauth_authorizations").upsert(
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
    return (
      <main className="account-shell oauth-page">
        <div className="oauth-column">
          <Link href="/" className="oauth-back" aria-label="Back to your account">
            <ChevronLeft size={24} aria-hidden="true" />
          </Link>
          <h1 className="oauth-heading">
            Unable to authorize this app
          </h1>
          <p className="oauth-error" role="alert">{resolved.error}</p>
          <p className="oauth-description">
            If you followed a link here, contact the app that sent you.
          </p>
          <Link href="/" className="oauth-primary oauth-return">Back to your account</Link>
        </div>
      </main>
    );
  }

  const { client, redirectUri, scopes, state, codeChallenge, codeChallengeMethod } =
    resolved.request;
  const user = await getAccountUser();
  const targetHost = new URL(redirectUri).hostname;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
    else if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
  }
  const chooserHref = `/accounts?next=${encodeURIComponent(`/oauth/authorize?${query.toString()}`)}`;
  const supabase = await createClient();
  const [passkeyResult, factorResult, claimsResult] = await Promise.all([
    supabase.auth.passkey.list(),
    supabase.auth.mfa.listFactors(),
    supabase.auth.getClaims(),
  ]);
  const previousSessionId = claimsResult.data?.claims?.session_id;
  const passkeysDisabled = passkeyResult.error?.code === "passkey_disabled";
  if ((passkeyResult.error && !passkeysDisabled) ||
      (!passkeyResult.data && !passkeysDisabled) || factorResult.error ||
      !factorResult.data || claimsResult.error || !previousSessionId) {
    return (
      <main className="account-shell oauth-page">
        <div className="oauth-column">
          <h1 className="oauth-heading">Authorization is unavailable</h1>
          <p className="oauth-error" role="alert">
            Additional verification is not available right now. Please try again later.
          </p>
          <Link href="/" className="oauth-primary oauth-return">Back to your account</Link>
        </div>
      </main>
    );
  }
  const { data: challenge, error: challengeError } = await supabase.rpc(
    "oauth_begin_passkey_challenge"
  );
  const checkpoint = challenge as {
    nonce?: string;
    issued_at?: number;
    previous_session_id?: string;
  } | null;
  if (challengeError || !checkpoint?.nonce ||
      !Number.isSafeInteger(checkpoint.issued_at) ||
      checkpoint.previous_session_id !== previousSessionId) {
    return (
      <main className="account-shell oauth-page">
        <div className="oauth-column">
          <h1 className="oauth-heading">Authorization is unavailable</h1>
          <p className="oauth-error" role="alert">The security checkpoint could not start. Please try again.</p>
          <Link href="/" className="oauth-primary oauth-return">Back to your account</Link>
        </div>
      </main>
    );
  }
  const nonce = checkpoint.nonce;
  const issuedAt = checkpoint.issued_at as number;
  const consentSignature = signConsentRequest([
    user.id, client.client_id, redirectUri, scopes.join(" "), state ?? "",
    codeChallenge ?? "", codeChallengeMethod ?? "", nonce,
    String(issuedAt), previousSessionId,
  ]);

  return (
    <main className="account-shell oauth-page">
      <div className="oauth-column">
        <button type="submit" form="oauth-deny" className="oauth-back" aria-label="Cancel authorization and go back">
          <ChevronLeft size={24} aria-hidden="true" />
        </button>
        <div>
          <h1 className="oauth-heading">
            Authorize {client.name}?
          </h1>
          <p className="oauth-description">
            Connect your Yavqo Account to {client.name}. Review the information
            you&apos;ll share before continuing.
          </p>
          <div className="oauth-identity">
            <UserRound size={22} aria-hidden="true" />
            <div className="min-w-0">
              <span className="oauth-label">Signed in with Yavqo</span>
              <p className="oauth-email">{user.email}</p>
            </div>
          </div>
          <Link href={chooserHref} className="oauth-switch-account">Use another account</Link>
        </div>

        <section className="oauth-permissions" aria-labelledby="oauth-permissions-title">
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
          Only continue if you trust {targetHost}. You can always revoke
          access later in <Link href="/apps">Connected apps</Link>.
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
              consentSignature={consentSignature}
              nonce={nonce}
              issuedAt={issuedAt}
              previousSessionId={previousSessionId}
            />
            <AuthorizeButton />
          </form>
          </OAuthPasskeyGate>
          <form action={deny} noValidate id="oauth-deny" className="oauth-cancel-form">
            <HiddenRequestFields
              clientId={client.client_id}
              redirectUri={redirectUri}
              scope={scopes.join(" ")}
              state={state}
              codeChallenge={codeChallenge}
              codeChallengeMethod={codeChallengeMethod}
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
    </>
  );
}
