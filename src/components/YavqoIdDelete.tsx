"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function YavqoIdDelete({ userId, handle }: { userId: string; handle: string }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openDialog() {
    setError(null);
    dialogRef.current?.showModal();
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("id_accounts").delete().eq("user_id", userId);
    if (deleteError) {
      setError(deleteError.message);
      setBusy(false);
      return;
    }
    dialogRef.current?.close();
    router.refresh();
  }

  return (
    <section className="yid-danger" aria-labelledby="yid-delete-title">
      <h2 id="yid-delete-title">Retire your YavqoID</h2>
      <p>Your handle will become available to someone else. Your Yavqo Account and existing Yavqo TV friends will remain.</p>
      <button type="button" onClick={openDialog} className="yid-danger-trigger">Delete YavqoID</button>
      <dialog ref={dialogRef} className="yid-delete-dialog" aria-labelledby="yid-confirm-title" onCancel={(event) => { if (busy) event.preventDefault(); }}>
        <h2 id="yid-confirm-title">Delete @{handle}?</h2>
        <p>This removes your YavqoID profile and releases @{handle}. Someone else may then claim it. This won’t delete your Yavqo Account or your existing friends.</p>
        {error && <p role="alert" className="public-message public-error">{error}</p>}
        <div className="yid-delete-actions">
          <button type="button" className="yid-delete-cancel" disabled={busy} onClick={() => dialogRef.current?.close()}>Cancel</button>
          <button type="button" className="yid-delete-confirm" disabled={busy} onClick={remove}>{busy ? "Deleting…" : "Delete YavqoID"}</button>
        </div>
      </dialog>
    </section>
  );
}
