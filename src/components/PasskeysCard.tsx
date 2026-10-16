"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Trash2 } from "lucide-react";
import type { PasskeyListItem } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

function formatDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("en-US", { dateStyle: "medium" });
}

export default function PasskeysCard() {
  const router = useRouter();
  const [passkeys, setPasskeys] = useState<PasskeyListItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await createClient().auth.passkey.list();
    if (error) setMessage({ kind: "error", text: error.message });
    setPasskeys(data ?? []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function addPasskey() {
    setBusy(true);
    setMessage(null);
    const { error } = await createClient().auth.registerPasskey();
    if (error) {
      setMessage({ kind: "error", text: error.message || "Could not create the passkey." });
    } else {
      setMessage({ kind: "success", text: "Passkey created. You can use it to sign in." });
      await load();
      router.refresh();
    }
    setBusy(false);
  }

  async function removePasskey(id: string) {
    if (removingId !== id) {
      setRemovingId(id);
      return;
    }
    setBusy(true);
    setMessage(null);
    const { error } = await createClient().auth.passkey.delete({ passkeyId: id });
    if (error) {
      setMessage({ kind: "error", text: error.message });
    } else {
      setMessage({ kind: "success", text: "Passkey removed." });
      await load();
      router.refresh();
    }
    setRemovingId(null);
    setBusy(false);
  }

  return (
    <div id="passkeys" className="scroll-mt-24 py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[14px]">Passkeys</p>
          <p className="mt-0.5 text-[13px] text-[#9aa0a6]">
            Sign in with your fingerprint, face, or screen lock instead of a password.
          </p>
        </div>
        <button
          type="button"
          onClick={addPasskey}
          disabled={busy || passkeys === null}
          className="shrink-0 rounded-full bg-[#8ab4f8] px-5 py-2 text-[13px] font-medium text-[#202124] transition-colors hover:bg-[#aecbfa] disabled:opacity-60"
        >
          {busy && !removingId ? "Waiting…" : "Create passkey"}
        </button>
      </div>

      {passkeys && passkeys.length > 0 && (
        <ul className="mt-3 grid gap-2">
          {passkeys.map((passkey) => {
            const created = formatDate(passkey.created_at);
            const used = formatDate(passkey.last_used_at);
            return (
              <li key={passkey.id} className="flex items-center gap-3 rounded-xl border border-[#3c4043] px-4 py-3">
                <KeyRound size={18} className="shrink-0 text-[#9aa0a6]" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px]">{passkey.friendly_name || "Passkey"}</span>
                  <span className="block text-[12px] text-[#9aa0a6]">
                    {[created && `Created ${created}`, used && `Last used ${used}`].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removePasskey(passkey.id)}
                  disabled={busy}
                  aria-label={removingId === passkey.id ? "Confirm removing this passkey" : "Remove passkey"}
                  className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] text-[#f28b82] transition-colors hover:bg-[#f28b82]/10 disabled:opacity-60"
                >
                  <Trash2 size={15} aria-hidden="true" />
                  {removingId === passkey.id ? "Confirm" : "Remove"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {message && (
        <p
          className={`mt-3 text-[13px] ${message.kind === "error" ? "text-[#f28b82]" : "text-[#81c995]"}`}
          role={message.kind === "error" ? "alert" : "status"}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
