import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccountUser } from "@/lib/account";
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

function buildRedirect(
  request: AuthRequest,
  params: Record<string, string>
): string {
  const url = new URL(request.redirectUri);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
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
    .select("client_id, redirect_uris")
    .eq("client_id", clientId)
    .maybeSingle();
  const client = data as Pick<OAuthClient, "client_id" | "redirect_uris"> | null;
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
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-[420px] rounded-2xl bg-[#292a2d] p-8 text-center">
          <img src="/img/logo.png" alt="Yavqo" className="mx-auto h-16 w-16 rounded-2xl" />
          <h1 className="mt-4 text-[20px] font-normal">
            Sign in with Yavqo Account
          </h1>
          <p className="mt-3 text-[14px] text-[#f28b82]">{resolved.error}</p>
          <p className="mt-2 text-[13px] text-[#9aa0a6]">
            If you followed a link here, contact the app that sent you.
          </p>
        </div>
      </main>
    );
  }

  const { client, redirectUri, scopes, state, codeChallenge, codeChallengeMethod } =
    resolved.request;
  const user = await getAccountUser();
  const targetHost = new URL(redirectUri).hostname;

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-[420px] rounded-2xl bg-[#292a2d] p-8">
        <div className="flex flex-col items-center text-center">
          <img src="/img/logo.png" alt="Yavqo" className="h-16 w-16 rounded-2xl" />
          <h1 className="mt-4 text-[20px] font-normal">
            {client.name} wants to access your Yavqo Account
          </h1>
          <p className="mt-1 text-[13px] text-[#9aa0a6]">{user.email}</p>
        </div>

        <div className="mt-6 rounded-xl border border-[#3c4043] bg-[#202124] p-4">
          <p className="text-[13px] font-medium text-[#e8eaed]">
            This will allow {client.name} ({targetHost}) to:
          </p>
          <ul className="mt-3 space-y-2">
            {scopes.map((scope) => (
              <li key={scope} className="flex gap-2 text-[13px] text-[#bdc1c6]">
                <span className="text-[#81c995]" aria-hidden="true">
                  •
                </span>
                {SCOPE_DESCRIPTIONS[scope]}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-4 text-center text-[12px] leading-relaxed text-[#9aa0a6]">
          Only continue if you trust {targetHost}. You can always revoke
          access later.
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <form action={deny}>
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
              className="h-10 rounded-full border border-[#5f6368] px-5 text-[13px] transition-colors hover:bg-white/5"
            >
              Cancel
            </button>
          </form>
          <form action={approve}>
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
              className="h-10 rounded-full bg-[#8ab4f8] px-5 text-[13px] font-medium text-[#202124] transition-opacity hover:opacity-90"
            >
              Continue
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
