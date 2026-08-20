"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Copy, Link2, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type OAuthClient = {
  id: string;
  client_id: string;
  name: string;
  redirect_uris: string[];
  created_at: string;
};

type CreatedCredentials = {
  client_id: string;
  client_secret: string;
};

export default function OAuthDeveloperConsole({ userId }: { userId: string }) {
  const [clients, setClients] = useState<OAuthClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [redirectUris, setRedirectUris] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreatedCredentials | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error: loadError } = await supabase
      .from("id_oauth_clients")
      .select("id, client_id, name, redirect_uris, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (loadError) {
      setError(loadError.message);
    } else {
      setClients((data as OAuthClient[]) ?? []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
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

    const uris = redirectUris
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("oauth_register_client", {
      p_name: name.trim(),
      p_redirect_uris: uris,
    });

    if (rpcError) {
      setError(rpcError.message);
    } else {
      setCreated(data as CreatedCredentials);
      setFormOpen(false);
      setName("");
      setRedirectUris("");
      await load();
    }
    setSaving(false);
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
      <h2 className="text-[24px] font-normal">OAuth</h2>
      <p className="mt-1 text-[13px] text-[#9aa0a6]">
        Register apps so people can sign in with their Yavqo Account.
        Authorization Code flow with PKCE.
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-[#452b0c] p-3 text-[13px] text-[#fdd663]">
          {error}
        </p>
      )}

      {created && (
        <div className="mt-6 rounded-xl border border-[#81c995]/40 bg-[#1d2f23] p-5">
          <p className="text-[14px] font-medium text-[#81c995]">
            App registered. Copy the client secret now — it is only shown once.
          </p>
          <div className="mt-4 space-y-3">
            <CredentialRow
              label="client_id"
              value={created.client_id}
              copyKey="created-id"
              copied={copied}
              onCopy={copy}
            />
            <CredentialRow
              label="client_secret"
              value={created.client_secret}
              copyKey="created-secret"
              copied={copied}
              onCopy={copy}
            />
          </div>
          <button
            type="button"
            onClick={() => setCreated(null)}
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
          No apps yet. Register one to get a client_id and client_secret.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {clients.map((client) => (
            <div
              key={client.id}
              className="rounded-xl border border-[#3c4043] bg-[#292a2d] p-5"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fcad70]">
                  <Link2 size={15} className="text-[#1f1f1f]" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">{client.name}</p>
                  <p className="truncate text-[12px] text-[#9aa0a6]">
                    {new Date(client.created_at).toLocaleDateString("en-US", {
                      dateStyle: "medium",
                    })}
                    {client.redirect_uris.length > 0 &&
                      ` · ${client.redirect_uris[0]}`}
                  </p>
                </div>
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
              <div className="mt-3">
                <CredentialRow
                  label="client_id"
                  value={client.client_id}
                  copyKey={client.id}
                  copied={copied}
                  onCopy={copy}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-10 rounded-xl border border-[#3c4043] bg-[#292a2d] p-5">
        <h3 className="text-[15px] font-medium">Integration guide</h3>
        <ol className="mt-3 list-inside list-decimal space-y-2 text-[13px] text-[#bdc1c6]">
          <li>
            Send the user to{" "}
            <code className="rounded bg-[#202124] px-1.5 py-0.5 text-[12px] text-[#8ab4f8]">
              {origin}/oauth/authorize
            </code>{" "}
            with{" "}
            <code className="rounded bg-[#202124] px-1.5 py-0.5 text-[12px]">
              client_id, redirect_uri, response_type=code, scope, state
            </code>
            . PKCE is supported and recommended (
            <code className="rounded bg-[#202124] px-1.5 py-0.5 text-[12px]">
              code_challenge
            </code>{" "}
            with S256).
          </li>
          <li>
            After consent, the user returns to your redirect_uri with{" "}
            <code className="rounded bg-[#202124] px-1.5 py-0.5 text-[12px]">
              ?code=…
            </code>
            . Codes are single-use and expire in 10 minutes.
          </li>
          <li>
            Exchange the code server-side at{" "}
            <code className="rounded bg-[#202124] px-1.5 py-0.5 text-[12px] text-[#8ab4f8]">
              POST {origin}/oauth/token
            </code>{" "}
            with{" "}
            <code className="rounded bg-[#202124] px-1.5 py-0.5 text-[12px]">
              grant_type=authorization_code
            </code>
            , your credentials, and the same redirect_uri.
          </li>
          <li>
            Fetch the profile from{" "}
            <code className="rounded bg-[#202124] px-1.5 py-0.5 text-[12px] text-[#8ab4f8]">
              GET {origin}/oauth/userinfo
            </code>{" "}
            with{" "}
            <code className="rounded bg-[#202124] px-1.5 py-0.5 text-[12px]">
              Authorization: Bearer &lt;access_token&gt;
            </code>
            . Access tokens last 1 hour.
          </li>
        </ol>
        <p className="mt-3 text-[12px] text-[#9aa0a6]">
          Scopes: <code className="text-[#bdc1c6]">openid profile email yavqoid</code>.
          Example:{" "}
          <code className="break-all text-[12px] text-[#bdc1c6]">
            {origin}/oauth/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_URI&response_type=code&scope=openid%20profile%20email&state=RANDOM
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
