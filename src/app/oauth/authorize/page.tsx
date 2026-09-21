import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Check, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAccountUser } from "@/lib/account";
import { originFromUrl } from "@/lib/connectedApps";
import {
  SCOPE_DESCRIPTIONS,
  generateAuthorizationCode,
  parseScopes,
  type OAuthScope,
} from "@/lib/oauth";

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

  if (!approved) {
    const url = new URL(redirectUri);
    url.searchParams.set("error", "access_denied");
    url.searchParams.set("error_description", "The user denied the request.");
    if (state) url.searchParams.set("state", state);
    redirect(url.toString());
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const code = generateAuthorizationCode();
  const { error } = await supabase.from("id_oauth_codes").insert({
    code,
    client_id: clientId,
    user_id: user.id,
    redirect_uri: redirectUri,
    scope,
    code_challenge: codeChallenge || null,
    code_challenge_method: codeChallenge ? codeChallengeMethod || "S256" : null,
  });
  if (error) redirect("/");

  const { siteUrl, siteHost } = originFromUrl(redirectUri);
  await supabase.from("id_oauth_authorizations").upsert(
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
  const resolved = await resolveAuthRequest(await searchParams);

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
          <form action={approve} className="oauth-approve-form">
            <HiddenRequestFields
              clientId={client.client_id}
              redirectUri={redirectUri}
              scope={scopes.join(" ")}
              state={state}
              codeChallenge={codeChallenge}
              codeChallengeMethod={codeChallengeMethod}
            />
            <button
              type="submit"
              className="oauth-primary"
            >
              Authorize
            </button>
          </form>
          <form action={deny} id="oauth-deny" className="oauth-cancel-form">
            <HiddenRequestFields
              clientId={client.client_id}
              redirectUri={redirectUri}
              scope={scopes.join(" ")}
              state={state}
              codeChallenge={codeChallenge}
              codeChallengeMethod={codeChallengeMethod}
            />
            <button
              type="submit"
              className="oauth-secondary"
            >
              Cancel
            </button>
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
}: {
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string | null;
  codeChallenge: string | null;
  codeChallengeMethod: string | null;
}) {
  return (
    <>
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="redirect_uri" value={redirectUri} />
      <input type="hidden" name="scope" value={scope} />
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
