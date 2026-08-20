"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Status =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string };

const inputClass =
  "h-11 w-full rounded-lg border border-[#5f6368] bg-transparent px-3 text-[14px] text-[#e8eaed] outline-none transition-colors placeholder:text-[#9aa0a6] focus:border-[#8ab4f8]";

function friendlyAuthError(error: { message?: string } | null): string {
  const message = error?.message ?? "";
  if (/invalid login credentials/i.test(message)) {
    return "Your current password is incorrect.";
  }
  if (/password.*short|weak password/i.test(message)) {
    return "That password is too weak. Use at least 8 characters.";
  }
  return message || "Something went wrong. Please try again.";
}

export default function ChangePasswordCard({ email }: { email: string }) {
  const [expanded, setExpanded] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const busy = status.kind === "busy";

  function reset() {
    setExpanded(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setStatus({ kind: "idle" });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;

    if (newPassword.length < 8) {
      setStatus({
        kind: "error",
        message: "New password must be at least 8 characters.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus({ kind: "error", message: "New passwords don't match." });
      return;
    }

    setStatus({ kind: "busy" });
    const supabase = createClient();

    // Confirm the current password before allowing the change.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (signInError) {
      setStatus({ kind: "error", message: friendlyAuthError(signInError) });
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (updateError) {
      setStatus({ kind: "error", message: friendlyAuthError(updateError) });
      return;
    }

    setStatus({ kind: "success", message: "Password changed." });
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  if (!expanded) {
    return (
      <div className="flex items-center justify-between gap-4 py-4">
        <div>
          <p className="text-[14px]">Password</p>
          <p className="mt-0.5 text-[13px] text-[#9aa0a6]">
            Last changed recently
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setExpanded(true);
            setStatus({ kind: "idle" });
          }}
          className="rounded-full px-5 py-2 text-[13px] font-medium text-[#8ab4f8] transition-colors hover:bg-[#8ab4f8]/10"
        >
          Change password
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="py-4">
      <p className="text-[14px]">Change password</p>
      <p className="mt-0.5 text-[13px] text-[#9aa0a6]">
        Choose a strong password you haven&apos;t used before.
      </p>

      <div className="mt-4 flex max-w-sm flex-col gap-3">
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Current password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className={inputClass}
          required
          disabled={busy}
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClass}
          required
          disabled={busy}
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputClass}
          required
          disabled={busy}
        />
      </div>

      {status.kind === "error" && (
        <p className="mt-3 text-[13px] text-[#f28b82]">{status.message}</p>
      )}
      {status.kind === "success" && (
        <p className="mt-3 text-[13px] text-[#81c995]">{status.message}</p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-[#8ab4f8] px-5 py-2 text-[13px] font-medium text-[#202124] transition-colors hover:bg-[#aecbfa] disabled:opacity-60"
        >
          {busy ? "Saving…" : "Change password"}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={busy}
          className="rounded-full px-5 py-2 text-[13px] font-medium text-[#8ab4f8] transition-colors hover:bg-[#8ab4f8]/10"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
