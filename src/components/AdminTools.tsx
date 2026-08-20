"use client";

import { useCallback, useEffect, useState } from "react";
import { Fingerprint, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function AdminTools() {
  const [meId, setMeId] = useState<string | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const id = userData.user?.id ?? null;
    setMeId(id);
    if (!id) return;
    const { data } = await supabase
      .from("id_accounts")
      .select("handle")
      .eq("user_id", id)
      .maybeSingle();
    setHandle((data as { handle: string } | null)?.handle ?? null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function reset() {
    if (!meId) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("id_accounts")
      .delete()
      .eq("user_id", meId);
    setBusy(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setHandle(null);
    setConfirming(false);
    setNotice("YavqoID deleted — the setup flow is back at /yavqoid.");
  }

  return (
    <div className="mt-6 rounded-2xl border border-[#3c4043] bg-[#292a2d] p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#8b5cf6]">
          <Fingerprint size={18} className="text-[#1f1f1f]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px]">Reset YavqoID</h3>
          <p className="mt-0.5 text-[12px] text-[#9aa0a6]">
            {handle
              ? `Current YavqoID: @${handle}`
              : "No YavqoID set up for this account."}
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-[#452b0c] px-4 py-3 text-[13px] text-[#fdd663]">
          {error}
        </p>
      )}
      {notice && !error && (
        <p className="mt-4 rounded-lg bg-[#81c995]/10 px-4 py-3 text-[13px] text-[#81c995]">
          {notice}
        </p>
      )}

      <div className="mt-5 flex items-center justify-end gap-2">
        {confirming && (
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="h-9 rounded-full px-4 text-[13px] text-[#9aa0a6] transition-colors hover:bg-white/5 disabled:opacity-60"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          disabled={busy || !handle}
          onClick={() => {
            if (!confirming) {
              setConfirming(true);
              return;
            }
            void reset();
          }}
          className="flex h-9 items-center gap-2 rounded-full bg-[#f28b82]/10 px-4 text-[13px] font-medium text-[#f28b82] transition-colors hover:bg-[#f28b82]/20 disabled:opacity-50"
        >
          <Trash2 size={15} aria-hidden="true" />
          {busy
            ? "Deleting…"
            : confirming
              ? "Confirm delete"
              : "Reset YavqoID"}
        </button>
      </div>
    </div>
  );
}
