"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import Avatar from "@/components/Avatar";
import { currentSlot, rememberedAccounts, type RememberedAccount } from "@/lib/remembered-accounts";

export default function AccountChooser({ nextTarget }: { nextTarget: string }) {
  const [accounts, setAccounts] = useState<RememberedAccount[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAccounts(rememberedAccounts());
      setActiveSlot(currentSlot());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function accountAction(action: "add" | "switch", slot?: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, slot }),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not switch accounts.");
      window.location.assign(action === "add"
        ? `/login?next=${encodeURIComponent(nextTarget)}`
        : nextTarget);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not switch accounts.");
      setBusy(false);
    }
  }

  return (
    <main className="account-shell chooser-page">
      <div className="chooser-column">
        <Link href="/" className="chooser-brand" aria-label="Yavqo home">
          <img src="/img/logo.png" width={34} height={34} alt="" />
          <span>Yavqo</span>
        </Link>
        <h1>Log in with your Yavqo Account</h1>
        <div className="chooser-list">
          {accounts.map((account) => (
            <button key={account.slot} type="button" disabled={busy}
              className="chooser-account" onClick={() => accountAction("switch", account.slot)}>
              <Avatar avatarUrl={account.avatarUrl}
                initial={(account.name[0] ?? "Y").toUpperCase()}
                className="h-14 w-14 shrink-0 text-xl" />
              <span className="chooser-account-label">
                <span>{account.slot === activeSlot ? "Continue as" : "Switch to"} {account.name}</span>
                <span className="chooser-account-email">{account.maskedEmail}</span>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          ))}
          <button type="button" disabled={busy} className="chooser-add"
            onClick={() => accountAction("add")}>
            {accounts.length === 0 && <Plus size={18} aria-hidden="true" />}
            Log in to another account
          </button>
        </div>
        {error && <p role="alert" className="chooser-error">{error}</p>}
        {busy && <p role="status" className="chooser-status">Switching account…</p>}
      </div>
      <footer className="chooser-footer">
        <Link href="/privacy">Privacy</Link><span>·</span>
        <Link href="/terms">Terms</Link><span>·</span>
        <span>English</span>
      </footer>
    </main>
  );
}
