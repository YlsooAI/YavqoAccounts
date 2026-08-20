"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function YavqoIdDelete({ userId }: { userId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("id_accounts")
      .delete()
      .eq("user_id", userId);
    setBusy(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-6 rounded-2xl border border-[#f28b82]/30 bg-[#292a2d] p-6">
      <h3 className="text-[15px] text-[#f28b82]">Retire your YavqoID</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-[#9aa0a6]">
        Deleting your YavqoID frees your handle so anyone can claim it.
        Friends added through it stay in your YavqoTV friends list.
      </p>
      {error && (
        <p className="mt-3 rounded-lg bg-[#452b0c] px-4 py-3 text-[13px] text-[#fdd663]">
          {error}
        </p>
      )}
      <div className="mt-4 flex items-center justify-end gap-2">
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
          disabled={busy}
          onClick={() => {
            if (!confirming) {
              setConfirming(true);
              return;
            }
            void remove();
          }}
          className="flex h-9 items-center gap-2 rounded-full bg-[#f28b82]/10 px-4 text-[13px] font-medium text-[#f28b82] transition-colors hover:bg-[#f28b82]/20 disabled:opacity-50"
        >
          <Trash2 size={15} aria-hidden="true" />
          {busy ? "Deleting…" : confirming ? "Confirm delete" : "Delete YavqoID"}
        </button>
      </div>
    </div>
  );
}
