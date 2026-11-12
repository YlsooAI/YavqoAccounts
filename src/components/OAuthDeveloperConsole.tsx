"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Copy, KeyRound, Link2, Pencil, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { OAUTH_SCOPES, SCOPE_DESCRIPTIONS, type OAuthScope } from "@/lib/oauth-scopes";

type ClientType = "confidential" | "public";

type OAuthClient = {
  id: string;
  client_id: string;
  name: string;
  redirect_uris: string[];
  client_type: ClientType;
  require_pkce: boolean;
  backchannel_logout_uri: string | null;
  secondary_secret_expires_at: string | null;
  created_at: string;
};

type SecretBanner = {
  title: string;
  client_id: string;
  client_secret: string | null;
  secondary_secret_expires_at?: string | null;
};

function parseUriLines(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function OAuthDeveloperConsole({ userId }: { userId: string }) {
  const [clients, setClients] = useState<OAuthClient[]>([]);
  const [loadedAt, setLoadedAt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [clientType, setClientType] = useState<ClientType>("confidential");
  const [requirePkce, setRequirePkce] = useState(true);
  const [redirectUris, setRedirectUris] = useState("");
  const [backchannelUri, setBackchannelUri] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRedirectUris, setEditRedirectUris] = useState("");
  const [editRequirePkce, setEditRequirePkce] = useState(false);
  const [editBackchannelUri, setEditBackchannelUri] = useState("");
  const [updating, setUpdating] = useState(false);

  const [secretBanner, setSecretBanner] = useState<SecretBanner | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [exampleScopes, setExampleScopes] = useState<OAuthScope[]>([
    "openid",
    "email",
    "full_name",
  ]);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error: loadError } = await supabase
      .from("id_oauth_clients")
      .select(
        "id, client_id, name, redirect_uris, client_type, require_pkce, backchannel_logout_uri, secondary_secret_expires_at, created_at"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (loadError) {
      setError(loadError.message);
    } else {
      setClients((data as OAuthClient[]) ?? []);
      setLoadedAt(Date.now());
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((prev) => (prev === key ? null : prev)), 1500);
    } catch {
      // Clipboard unavailable; the value stays selectable on screen.
    }
  }

  async function handleRegister(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("oauth_register_client", {
      p_name: name.trim(),
      p_redirect_uris: parseUriLines(redirectUris),
      p_client_type: clientType,
      p_require_pkce: clientType === "public" ? true : requirePkce,
      p_backchannel_logout_uri: backchannelUri.trim() || null,
    });

    if (rpcError) {
      setError(rpcError.message);
    } else {
      const result = data as {
        client_id: string;
        client_secret: string | null;
      };
      setSecretBanner({
        title: result.client_secret
          ? "App registered. Copy the client secret now — it is only shown once."
          : "Public app registered. Use PKCE (S256) with this client_id — no client secret is needed.",
        client_id: result.client_id,
        client_secret: result.client_secret,
      });
      setFormOpen(false);
      setName("");
      setClientType("confidential");
      setRequirePkce(true);
      setRedirectUris("");
      setBackchannelUri("");
      await load();
    }
    setSaving(false);
  }

  function startEditing(client: OAuthClient) {
    if (editingId === client.id) {
      setEditingId(null);
      return;
    }
    setEditingId(client.id);
    setEditName(client.name);
    setEditRedirectUris(client.redirect_uris.join("\n"));
    setEditRequirePkce(client.require_pkce);
    setEditBackchannelUri(client.backchannel_logout_uri ?? "");
    setError(null);
  }

  async function handleUpdate(event: FormEvent, client: OAuthClient) {
    event.preventDefault();
    setUpdating(true);
    setError(null);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("oauth_update_client", {
      p_id: client.id,
      p_name: editName.trim(),
      p_redirect_uris: parseUriLines(editRedirectUris),
      p_require_pkce: client.client_type === "public" ? true : editRequirePkce,
      p_backchannel_logout_uri: editBackchannelUri.trim() || null,
    });

    if (rpcError) {
      setError(rpcError.message);
    } else {
      setEditingId(null);
      await load();
    }
    setUpdating(false);
  }

  async function handleRotateSecret(client: OAuthClient) {
    if (rotatingId !== client.id) {
      setRotatingId(client.id);
      return;
    }
    setError(null);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("oauth_rotate_client_secret", {
      p_id: client.id,
      p_grace_hours: 24,
    });

    if (rpcError) {
      setError(rpcError.message);
    } else {
      const result = data as {
        client_id: string;
        client_secret: string;
        secondary_secret_expires_at: string | null;
      };
      setSecretBanner({
        title: `New secret generated for ${client.name}. Copy it now — it is only shown once.`,
        client_id: result.client_id,
        client_secret: result.client_secret,
        secondary_secret_expires_at: result.secondary_secret_expires_at,
      });
      await load();
    }
    setRotatingId(null);
  }

  async function handleRevokeSecondarySecret(client: OAuthClient) {
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("oauth_revoke_secondary_secret", {
      p_id: client.id,
    });
    if (rpcError) {
      setError(rpcError.message);
    } else {
      await load();
    }
  }

  async function handleDelete(client: OAuthClient) {
    if (deletingId !== client.id) {
      setDeletingId(client.id);
      return;
    }
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("id_oauth_clients")
      .delete()
      .eq("id", client.id)
      .eq("user_id", userId);
    if (deleteError) {
      setError(deleteError.message);
    } else {
      setClients((prev) => prev.filter((c) => c.id !== client.id));
    }
    setDeletingId(null);
  }

  const origin =
    typeof window === "undefined" ? "" : window.location.origin.replace(/\/$/, "");

  return (
    <div className="mx-auto max-w-[660px] pb-16 pt-6 md:pt-10">
      <h2 className="text-[24px] font-normal">OAuth &amp; OpenID Connect</h2>
      <p className="mt-1 text-[13px] text-[#9aa0a6]">
        Register apps so people can sign in with their Yavqo Account. Supports
        Authorization Code + PKCE, OIDC ID tokens, refresh token rotation, and
        back-channel logout.
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-[#452b0c] p-3 text-[13px] text-[#fdd663]">
          {error}
        </p>
      )}

      {secretBanner && (
        <div className="mt-6 rounded-xl border border-[#81c995]/40 bg-[#1d2f23] p-5">
          <p className="text-[14px] font-medium text-[#81c995]">
            {secretBanner.title}
          </p>
          {secretBanner.secondary_secret_expires_at && (
            <p className="mt-1 text-[12px] text-[#bdc1c6]">
              Your previous secret stays active until{" "}
              {new Date(secretBanner.secondary_secret_expires_at).toLocaleString()} for
              zero-downtime rotation.
            </p>
          )}
          <div className="mt-4 space-y-3">
            <CredentialRow
              label="client_id"
              value={secretBanner.client_id}
              copyKey="banner-id"
              copied={copied}
              onCopy={copy}
            />
            {secretBanner.client_secret && (
              <CredentialRow
                label="client_secret"
                value={secretBanner.client_secret}
                copyKey="banner-secret"
                copied={copied}
                onCopy={copy}
              />
            )}
          </div>
          <button
            type="button"
            onClick={() => setSecretBanner(null)}
            className="mt-4 text-[12px] text-[#9aa0a6] hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <h3 className="text-[15px] font-medium text-[#9aa0a6]">Your apps</h3>
        <button
          type="button"
          onClick={() => {
            setFormOpen((prev) => !prev);
            setError(null);
          }}
          className="flex h-9 items-center gap-2 rounded-full bg-[#8ab4f8] px-4 text-[13px] font-medium text-[#202124] transition-opacity hover:opacity-90"
        >
          <Plus size={14} aria-hidden="true" />
          Register app
        </button>
      </div>

      {formOpen && (
        <form
          onSubmit={handleRegister}
          className="mt-4 rounded-xl border border-[#3c4043] bg-[#292a2d] p-5"
        >
          <label className="block text-[13px] text-[#bdc1c6]">
            App name
            <input
              type="text"
              required
              maxLength={60}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="My awesome app"
              className="mt-1 h-10 w-full rounded-lg border border-[#3c4043] bg-[#202124] px-3 text-[13px] outline-none placeholder:text-[#9aa0a6] focus:border-[#8ab4f8]"
            />
          </label>

          <label className="mt-4 block text-[13px] text-[#bdc1c6]">
            Client type
            <select
              value={clientType}
              onChange={(event) => {
                const next = event.target.value as ClientType;
                setClientType(next);
                if (next === "public") setRequirePkce(true);
              }}
              className="mt-1 h-10 w-full rounded-lg border border-[#3c4043] bg-[#202124] px-3 text-[13px] outline-none focus:border-[#8ab4f8]"
            >
              <option value="confidential">
                Confidential (server-side web app with client_secret)
              </option>
              <option value="public">
                Public (SPA or mobile app, no client_secret, PKCE S256 required)
              </option>
            </select>
          </label>

          <label className="mt-4 block text-[13px] text-[#bdc1c6]">
            Redirect URIs (one per line, exact match)
            <textarea
              required
              rows={3}
              value={redirectUris}
              onChange={(event) => setRedirectUris(event.target.value)}
              placeholder={"https://example.com/auth/callback\nhttp://localhost:3001/callback"}
              className="mt-1 w-full rounded-lg border border-[#3c4043] bg-[#202124] px-3 py-2 text-[13px] outline-none placeholder:text-[#9aa0a6] focus:border-[#8ab4f8]"
            />
          </label>

          <label className="mt-4 block text-[13px] text-[#bdc1c6]">
            Back-channel logout URI (optional)
            <input
              type="url"
              value={backchannelUri}
              onChange={(event) => setBackchannelUri(event.target.value)}
              placeholder="https://example.com/auth/backchannel-logout"
              className="mt-1 h-10 w-full rounded-lg border border-[#3c4043] bg-[#202124] px-3 text-[13px] outline-none placeholder:text-[#9aa0a6] focus:border-[#8ab4f8]"
            />
          </label>

          <label className="mt-4 flex cursor-pointer items-center gap-2 text-[13px] text-[#bdc1c6]">
            <input
              type="checkbox"
              checked={clientType === "public" ? true : requirePkce}
              disabled={clientType === "public"}
              onChange={(event) => setRequirePkce(event.target.checked)}
              className="accent-[#8ab4f8]"
            />
            Require PKCE (recommended)
          </label>

          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="h-9 rounded-full border border-[#5f6368] px-4 text-[13px] transition-colors hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 rounded-full bg-[#8ab4f8] px-4 text-[13px] font-medium text-[#202124] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Registering…" : "Register"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="mt-4 text-[13px] text-[#9aa0a6]">Loading…</p>
      ) : clients.length === 0 && !formOpen ? (
        <p className="mt-4 text-[13px] text-[#9aa0a6]">
          No apps yet. Register one to get a client_id and configure redirect URIs.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {clients.map((client) => {
            const hasActiveGraceSecret = Boolean(
              client.secondary_secret_expires_at &&
                new Date(client.secondary_secret_expires_at).getTime() > loadedAt
            );

            return (
              <div
                key={client.id}
                className="rounded-xl border border-[#3c4043] bg-[#292a2d] p-5"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fcad70]">
                    <Link2 size={15} className="text-[#1f1f1f]" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[14px] font-medium">{client.name}</p>
                      <span className="rounded-full border border-[#3c4043] px-2 py-0.5 text-[11px] text-[#9aa0a6]">
                        {client.client_type === "public" ? "Public" : "Confidential"}
                      </span>
                      {client.require_pkce && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#3c4043] px-2 py-0.5 text-[11px] text-[#81c995]">
                          <ShieldCheck size={11} aria-hidden="true" />
                          PKCE
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[12px] text-[#9aa0a6]">
                      {new Date(client.created_at).toLocaleDateString("en-US", {
                        dateStyle: "medium",
                      })}
                      {client.redirect_uris.length > 0 &&
                        ` · ${client.redirect_uris[0]}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEditing(client)}
                      className="flex h-8 items-center gap-1 rounded-full border border-[#5f6368] px-3 text-[12px] text-[#9aa0a6] transition-colors hover:bg-white/5"
                    >
                      <Pencil size={12} aria-hidden="true" />
                      {editingId === client.id ? "Close" : "Edit"}
                    </button>
                    {client.client_type === "confidential" && (
                      <button
                        type="button"
                        onClick={() => handleRotateSecret(client)}
                        onBlur={() => setRotatingId(null)}
                        className={`flex h-8 items-center gap-1 rounded-full px-3 text-[12px] transition-colors ${
                          rotatingId === client.id
                            ? "bg-[#8ab4f8] text-[#202124]"
                            : "border border-[#5f6368] text-[#9aa0a6] hover:bg-white/5"
                        }`}
                      >
                        <RefreshCw size={12} aria-hidden="true" />
                        {rotatingId === client.id ? "Confirm rotate" : "Rotate secret"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(client)}
                      onBlur={() => setDeletingId(null)}
                      className={`h-8 rounded-full px-3 text-[12px] transition-colors ${
                        deletingId === client.id
                          ? "bg-[#f28b82] text-[#202124]"
                          : "border border-[#5f6368] text-[#9aa0a6] hover:bg-white/5"
                      }`}
                    >
                      {deletingId === client.id ? "Confirm" : "Delete"}
                    </button>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <CredentialRow
                    label="client_id"
                    value={client.client_id}
                    copyKey={client.id}
                    copied={copied}
                    onCopy={copy}
                  />
                  {client.backchannel_logout_uri && (
                    <p className="text-[12px] text-[#9aa0a6]">
                      Back-channel logout:{" "}
                      <code className="text-[#bdc1c6]">{client.backchannel_logout_uri}</code>
                    </p>
                  )}
                  {hasActiveGraceSecret && client.secondary_secret_expires_at && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#3c4043] bg-[#202124] px-3 py-2 text-[12px] text-[#fdd663]">
                      <span className="inline-flex items-center gap-1.5">
                        <KeyRound size={13} aria-hidden="true" />
                        Previous secret active until{" "}
                        {new Date(client.secondary_secret_expires_at).toLocaleString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRevokeSecondarySecret(client)}
                        className="text-[12px] text-[#8ab4f8] hover:underline"
                      >
                        Revoke old secret now
                      </button>
                    </div>
                  )}
                </div>

                {editingId === client.id && (
                  <form
                    onSubmit={(event) => handleUpdate(event, client)}
                    className="mt-4 border-t border-[#3c4043] pt-4"
                  >
                    <label className="block text-[13px] text-[#bdc1c6]">
                      App name
                      <input
                        type="text"
                        required
                        maxLength={60}
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        className="mt-1 h-10 w-full rounded-lg border border-[#3c4043] bg-[#202124] px-3 text-[13px] outline-none focus:border-[#8ab4f8]"
                      />
                    </label>
                    <label className="mt-3 block text-[13px] text-[#bdc1c6]">
                      Redirect URIs (one per line)
                      <textarea
                        required
                        rows={3}
                        value={editRedirectUris}
                        onChange={(event) => setEditRedirectUris(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#3c4043] bg-[#202124] px-3 py-2 text-[13px] outline-none focus:border-[#8ab4f8]"
                      />
                    </label>
                    <label className="mt-3 block text-[13px] text-[#bdc1c6]">
                      Back-channel logout URI (optional)
                      <input
                        type="url"
                        value={editBackchannelUri}
                        onChange={(event) => setEditBackchannelUri(event.target.value)}
                        placeholder="https://example.com/auth/backchannel-logout"
                        className="mt-1 h-10 w-full rounded-lg border border-[#3c4043] bg-[#202124] px-3 text-[13px] outline-none placeholder:text-[#9aa0a6] focus:border-[#8ab4f8]"
                      />
                    </label>
                    <label className="mt-3 flex cursor-pointer items-center gap-2 text-[13px] text-[#bdc1c6]">
                      <input
                        type="checkbox"
                        checked={client.client_type === "public" ? true : editRequirePkce}
                        disabled={client.client_type === "public"}
                        onChange={(event) => setEditRequirePkce(event.target.checked)}
                        className="accent-[#8ab4f8]"
                      />
                      Require PKCE
                    </label>
                    <div className="mt-4 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="h-9 rounded-full border border-[#5f6368] px-4 text-[13px] hover:bg-white/5"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={updating}
                        className="h-9 rounded-full bg-[#8ab4f8] px-4 text-[13px] font-medium text-[#202124] disabled:opacity-60"
                      >
                        {updating ? "Saving…" : "Save changes"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-10 rounded-xl border border-[#3c4043] bg-[#292a2d] p-5">
        <h3 className="text-[15px] font-medium">Integration guide</h3>
        <p className="mt-2 text-[13px] text-[#bdc1c6]">
          Standard OpenID Connect &amp; OAuth 2.0 discovery is published at{" "}
          <code className="rounded bg-[#202124] px-1.5 py-0.5 text-[12px] text-[#8ab4f8]">
            {origin}/.well-known/openid-configuration
          </code>{" "}
          (and{" "}
          <code className="rounded bg-[#202124] px-1.5 py-0.5 text-[12px] text-[#8ab4f8]">
            {origin}/.well-known/jwks.json
          </code>
          ).
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {OAUTH_SCOPES.map((scope) => (
            <label
              key={scope}
              className="flex cursor-pointer items-start gap-2 rounded-lg border border-[#3c4043] p-3 text-[12px]"
            >
              <input
                type="checkbox"
                checked={exampleScopes.includes(scope)}
                disabled={scope === "openid"}
                onChange={(event) =>
                  setExampleScopes((current) =>
                    event.target.checked
                      ? [...current, scope]
                      : current.filter((item) => item !== scope)
                  )
                }
                className="mt-0.5 accent-[#8ab4f8]"
              />
              <span>
                <strong className="block text-[#e8eaed]">{scope}</strong>
                {SCOPE_DESCRIPTIONS[scope]}
              </span>
            </label>
          ))}
        </div>

        <ol className="mt-4 list-inside list-decimal space-y-2 text-[13px] text-[#bdc1c6]">
          <li>
            Send the user to{" "}
            <code className="rounded bg-[#202124] px-1.5 py-0.5 text-[12px] text-[#8ab4f8]">
              {origin}/oauth/authorize
            </code>{" "}
            with{" "}
            <code className="rounded bg-[#202124] px-1.5 py-0.5 text-[12px]">
              client_id, redirect_uri, response_type=code, scope, state
            </code>
            . Optional OIDC parameters:{" "}
            <code className="rounded bg-[#202124] px-1.5 py-0.5 text-[12px]">
              code_challenge, code_challenge_method=S256, nonce, prompt (none | login | consent | select_account), login_hint, max_age
            </code>
            .
          </li>
          <li>
            Exchange the code at{" "}
            <code className="rounded bg-[#202124] px-1.5 py-0.5 text-[12px] text-[#8ab4f8]">
              POST {origin}/oauth/token
            </code>{" "}
            with{" "}
            <code className="rounded bg-[#202124] px-1.5 py-0.5 text-[12px]">
              grant_type=authorization_code
            </code>
            ,{" "}
            <code className="rounded bg-[#202124] px-1.5 py-0.5 text-[12px]">
              refresh_token
            </code>{" "}
            (when <code className="text-[12px]">offline_access</code> was granted), or{" "}
            <code className="rounded bg-[#202124] px-1.5 py-0.5 text-[12px]">
              client_credentials
            </code>
            . Returns <code className="text-[12px]">access_token</code>,{" "}
            <code className="text-[12px]">id_token</code>, and rotated{" "}
            <code className="text-[12px]">refresh_token</code>.
          </li>
          <li>
            Fetch claims from{" "}
            <code className="rounded bg-[#202124] px-1.5 py-0.5 text-[12px] text-[#8ab4f8]">
              GET/POST {origin}/oauth/userinfo
            </code>{" "}
            with{" "}
            <code className="rounded bg-[#202124] px-1.5 py-0.5 text-[12px]">
              Authorization: Bearer &lt;access_token&gt;
            </code>
            .
          </li>
          <li>
            Revoke tokens on sign-out via{" "}
            <code className="rounded bg-[#202124] px-1.5 py-0.5 text-[12px] text-[#8ab4f8]">
              POST {origin}/oauth/revoke
            </code>{" "}
            or inspect active state (confidential clients) via{" "}
            <code className="rounded bg-[#202124] px-1.5 py-0.5 text-[12px] text-[#8ab4f8]">
              POST {origin}/oauth/introspect
            </code>
            .
          </li>
        </ol>

        <p className="mt-3 text-[12px] text-[#9aa0a6]">
          Example with your selected scopes:{" "}
          <code className="break-all text-[12px] text-[#bdc1c6]">
            {origin}/oauth/authorize?client_id=YOUR_CLIENT_ID&amp;redirect_uri=YOUR_URI&amp;response_type=code&amp;scope={encodeURIComponent(exampleScopes.join(" "))}&amp;state=RANDOM&amp;nonce=RANDOM_NONCE
          </code>
        </p>
      </div>
    </div>
  );
}

function CredentialRow({
  label,
  value,
  copyKey,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copyKey: string;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-[12px] text-[#9aa0a6]">{label}</span>
      <code className="min-w-0 flex-1 truncate rounded-lg bg-[#202124] px-3 py-2 text-[12px] text-[#e8eaed]">
        {value}
      </code>
      <button
        type="button"
        aria-label={`Copy ${label}`}
        onClick={() => onCopy(value, copyKey)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#9aa0a6] transition-colors hover:bg-white/10 hover:text-white"
      >
        <Copy size={14} aria-hidden="true" />
      </button>
      {copied === copyKey && (
        <span className="shrink-0 text-[11px] text-[#81c995]">Copied</span>
      )}
    </div>
  );
}
