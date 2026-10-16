"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { currentSlot } from "@/lib/remembered-accounts";
import { signOutSlot } from "@/lib/sign-out";

export default function SignInVerifyForm({ factorId, email, nextTarget }: {
  factorId: string | null;
  email: string;
  nextTarget: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!factorId || !/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: verifyError } = await createClient().auth.mfa.challengeAndVerify({
      factorId,
      code,
    });
    if (verifyError) {
      setError("That code didn't work. Try the latest code from your app.");
      setCode("");
      setBusy(false);
      return;
    }
    router.replace(nextTarget);
    router.refresh();
  }

  async function switchAccount() {
    setBusy(true);
    await signOutSlot(currentSlot());
    router.replace(`/accounts?next=${encodeURIComponent(nextTarget)}`);
    router.refresh();
  }

  return (
    <main className="public-page">
      <header className="public-header"><Link href="/" className="public-brand" aria-label="Yavqo Accounts home">Yavqo <span>Accounts</span></Link></header>
      <section className="public-login" aria-labelledby="verify-title">
        <p className="public-overline">2-Step Verification</p>
        <h1 id="verify-title">Enter your verification code</h1>
        <p className="public-description">
          {email ? `${email} is protected with 2-Step Verification. ` : ""}
          Open your authenticator app and enter the 6-digit code for Yavqo.
        </p>
        {factorId ? (
          <form onSubmit={handleSubmit} noValidate className="public-form">
            <div className="public-field">
              <label htmlFor="verify-code">Verification code</label>
              <input
                id="verify-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                placeholder="6-digit code"
                aria-invalid={!!error}
                disabled={busy}
              />
            </div>
            {error && <p className="public-message public-error" role="alert">{error}</p>}
            <button type="submit" disabled={busy || code.length !== 6} className="public-primary">
              {busy ? "Checking…" : "Verify"}
            </button>
          </form>
        ) : (
          <p className="public-message public-error" role="alert">
            This account needs a second step, but no authenticator app is available for this sign-in. Sign in with your passkey instead.
          </p>
        )}
        <div className="public-login-secondary">
          <button type="button" onClick={switchAccount} disabled={busy}>
            Sign out and use another account
          </button>
        </div>
      </section>
      <footer className="public-footer"><span>Yavqo Accounts</span><nav aria-label="Legal"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav></footer>
    </main>
  );
}
