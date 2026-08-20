"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Status =
  | { kind: "idle" }
  | { kind: "confirming" }
  | { kind: "busy" }
  | { kind: "done" }
  | { kind: "error"; message: string };

export default function DeleteDataCard({ userId }: { userId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const busy = status.kind === "busy";

  async function deleteEverything() {
    setStatus({ kind: "busy" });
    const supabase = createClient();
    const { error: passwordsError } = await supabase
      .from("saved_passwords")
      .delete()
      .eq("user_id", userId);
    if (passwordsError) {
      setStatus({ kind: "error", message: passwordsError.message });
      return;
    }
    const { error: contactsError } = await supabase
      .from("contacts")
      .delete()
      .eq("user_id", userId);
    if (contactsError) {
      setStatus({ kind: "error", message: contactsError.message });
      return;
    }
    setStatus({ kind: "done" });
    router.refresh();
  }

  if (status.kind === "done") {
    return (
      <div className="py-4">
        <p className="text-[14px] text-[#81c995]">
          Your saved passwords and contacts have been deleted.
        </p>
        <p className="mt-1 text-[13px] text-[#9aa0a6]">
          Your profile and avatar were kept. You can also delete your whole
          Yavqo Account by contacting support.
        </p>
      </div>
    );
  }

  return (
    <div className="py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[14px]">Delete your data</p>
          <p className="mt-0.5 text-[13px] text-[#9aa0a6]">
            Permanently removes all saved passwords and contacts from your
            account.
          </p>
        </div>
        {status.kind !== "confirming" && status.kind !== "busy" && (
          <button
            type="button"
            onClick={() => setStatus({ kind: "confirming" })}
            className="shrink-0 rounded-full px-5 py-2 text-[13px] font-medium text-[#f28b82] transition-colors hover:bg-[#f28b82]/10"
          >
            Delete data
          </button>
        )}
      </div>

      {(status.kind === "confirming" || status.kind === "busy") && (
        <div className="mt-4 rounded-xl border border-[#f28b82]/40 bg-[#f28b82]/5 p-4">
          <p className="flex items-center gap-2 text-[13px] text-[#f28b82]">
            <TriangleAlert size={16} aria-hidden="true" />
            This can&apos;t be undone. All passwords and contacts will be gone.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={deleteEverything}
              disabled={busy}
              className="rounded-full bg-[#f28b82] px-5 py-2 text-[13px] font-medium text-[#202124] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Deleting…" : "Yes, delete everything"}
            </button>
            <button
              type="button"
              onClick={() => setStatus({ kind: "idle" })}
              disabled={busy}
              className="rounded-full px-5 py-2 text-[13px] font-medium text-[#8ab4f8] transition-colors hover:bg-[#8ab4f8]/10 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {status.kind === "error" && (
        <p className="mt-3 text-[13px] text-[#f28b82]">{status.message}</p>
      )}
    </div>
  );
}
