"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import Avatar from "@/components/Avatar";
import { currentSlot, forgetAllAccounts, forgetCurrentAccount, maskEmail } from "@/lib/remembered-accounts";
import { savedSessionSlots, signOutSlot } from "@/lib/sign-out";

export default function SignOutButton({
  name,
  email,
  avatarUrl,
  initial,
}: {
  name: string;
  email: string;
  avatarUrl: string | null;
  initial: string;
}) {
  const router = useRouter();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"one" | "all" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    busyRef.current = busy !== null;
  }, [busy]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    dialogRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busyRef.current) {
        setOpen(false);
        setError(null);
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  function openDialog() {
    setError(null);
    setOpen(true);
  }

  async function confirmSignOut(scope: "one" | "all") {
    if (busy) return;
    setBusy(scope);
    setError(null);
    try {
      if (scope === "all") {
        for (const slot of savedSessionSlots()) {
          await signOutSlot(slot);
        }
        forgetAllAccounts();
      } else {
        await signOutSlot(currentSlot());
        forgetCurrentAccount();
      }
      router.push("/accounts");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not log out. Try again.");
      setBusy(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="flex items-center gap-1.5 rounded-full p-2 pl-0 text-[13px] text-[#9aa0a6] transition-colors hover:text-white"
      >
        <LogOut size={16} aria-hidden="true" />
        <span>Sign out</span>
      </button>
      {open && (
        <div
          className="signout-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) {
              setOpen(false);
              setError(null);
            }
          }}
        >
          <div
            ref={dialogRef}
            className="signout-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
          >
            <h2 id={titleId}>Log out of {name}?</h2>
            <p>You’ll need to sign in again to use this account on this device.</p>
            <div className="switching-account">
              <Avatar
                avatarUrl={avatarUrl}
                initial={initial}
                className="h-12 w-12 shrink-0 text-lg"
              />
              <span className="switching-account-label">
                <span>{name}</span>
                <span className="switching-account-email">{maskEmail(email) || email}</span>
              </span>
            </div>
            {error && <p role="alert" className="signout-error">{error}</p>}
            <div className="signout-actions">
              <button
                type="button"
                className="signout-primary"
                disabled={busy !== null}
                onClick={() => confirmSignOut("one")}
              >
                {busy === "one" ? "Logging out…" : "Log out"}
              </button>
              <button
                type="button"
                className="signout-secondary"
                disabled={busy !== null}
                onClick={() => confirmSignOut("all")}
              >
                {busy === "all" ? "Logging out…" : "Log out of all accounts"}
              </button>
              <button
                type="button"
                className="signout-cancel"
                disabled={busy !== null}
                onClick={() => {
                  setOpen(false);
                  setError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
