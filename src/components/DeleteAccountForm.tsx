"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { forgetCurrentAccount } from "@/lib/remembered-accounts";

async function emptyFolder(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  userId: string
) {
  const { data: files } = await supabase.storage.from(bucket).list(userId, {
    limit: 200,
  });
  if (files?.length) {
    await supabase.storage
      .from(bucket)
      .remove(files.map((file: { name: string }) => `${userId}/${file.name}`));
  }
}

export default function DeleteAccountForm({
  email,
  userId,
}: {
  email: string;
  userId: string;
}) {
  const router = useRouter();
  const [typedEmail, setTypedEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = typedEmail.trim().toLowerCase() === email.toLowerCase();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!matches || busy) return;
    setBusy(true);
    setError(null);

    const supabase = createClient();

    try {
      await emptyFolder(supabase, "avatars", userId);
      await emptyFolder(supabase, "files", userId);
    } catch {
      // Storage cleanup is best-effort; the auth user delete still proceeds.
    }

    const { error: rpcError } = await supabase.rpc("delete_own_account");
    if (rpcError) {
      setError(rpcError.message);
      setBusy(false);
      return;
    }

    await supabase.auth.signOut();
    forgetCurrentAccount();
    router.push("/login?deleted=1");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-[660px] pb-16 pt-6 md:pt-10">
      <h2 className="text-[24px] font-normal">Delete your Yavqo Account</h2>
      <p className="mt-2 text-[13px] text-[#9aa0a6]">
        This permanently removes your account and the data stored with it.
        This cannot be undone.
      </p>

      <section className="mt-8 rounded-2xl border border-[#f28b82]/40 bg-[#f28b82]/5 p-6">
        <p className="flex items-start gap-2 text-[14px] text-[#f28b82]">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          You will lose access to every Yavqo product signed in with this account.
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-6 text-[13px] text-[#f6b53f]/90">
          <li>YavqoID, profile photo, and personal info</li>
          <li>Uploaded files, videos, and account storage</li>
          <li>Saved passwords, contacts, and family membership</li>
          <li>Connected apps and OAuth access you granted</li>
          <li>YavqoTV friends and wallet cards stored on this account</li>
        </ul>
        <p className="mt-4 text-[12px] leading-relaxed text-[#9aa0a6]">
          Stripe invoices and payment history at the processor may remain for
          legal reasons. Download a copy of your data first if you need it.
        </p>
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href="/privacy"
          className="flex h-9 items-center rounded-full border border-[#5f6368] px-4 text-[13px] transition-colors hover:bg-white/5"
        >
          Download your data first
        </a>
        <a
          href="/"
          className="flex h-9 items-center rounded-full px-4 text-[13px] text-[#8ab4f8] hover:underline"
        >
          Keep my account
        </a>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-8 rounded-2xl border border-[#3c4043] bg-[#292a2d] p-6"
      >
        <label className="block text-[13px] text-[#bdc1c6]">
          Type <span className="font-medium text-white">{email}</span> to confirm
          <input
            type="email"
            autoComplete="off"
            value={typedEmail}
            onChange={(event) => setTypedEmail(event.target.value)}
            placeholder={email}
            className="mt-2 h-11 w-full rounded-lg border border-[#3c4043] bg-[#202124] px-4 text-[14px] outline-none placeholder:text-[#5f6368] focus:border-[#f28b82]"
          />
        </label>

        {error && <p className="mt-3 text-[13px] text-[#f28b82]">{error}</p>}

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={!matches || busy}
            className="h-10 rounded-full bg-[#f28b82] px-5 text-[13px] font-medium text-[#202124] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Deleting…" : "Delete account forever"}
          </button>
        </div>
      </form>
    </div>
  );
}
