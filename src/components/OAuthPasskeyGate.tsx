"use client";

import { useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

export default function OAuthPasskeyGate({
  userId,
  hasPasskey: initiallyHasPasskey,
  passkeyAvailable,
  totpFactorId,
  children,
}: {
  userId: string;
  hasPasskey: boolean;
  passkeyAvailable: boolean;
  totpFactorId: string | null;
  children: ReactNode;
}) {
  const [hasPasskey, setHasPasskey] = useState(initiallyHasPasskey);
  const [skipped, setSkipped] = useState(!passkeyAvailable && !totpFactorId);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function register() {
    setBusy(true);
    setError(null);
    try {
      const { error: registrationError } = await createClient().auth.registerPasskey();
      if (registrationError) throw registrationError;
      setHasPasskey(true);
      setSkipped(false);
      setVerified(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the passkey.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const { data, error: verificationError } = await createClient().auth.signInWithPasskey();
      if (verificationError) throw verificationError;
      if (data.user?.id !== userId) {
        setError("That passkey belongs to another account. Return to account selection and try again.");
        return;
      }
      setVerified(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Passkey verification failed.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyAuthenticatorCode() {
    if (!totpFactorId || !/^\d{6}$/.test(totpCode)) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactorId,
      });
      if (challengeError || !challenge) throw challengeError ?? new Error("Could not start verification.");
      const { error: verificationError } = await supabase.auth.mfa.verify({
        factorId: totpFactorId,
        challengeId: challenge.id,
        code: totpCode,
      });
      if (verificationError) throw verificationError;
      setVerified(true);
      setTotpCode("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The code could not be verified.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="oauth-passkey-gate">
      {!verified && !skipped && (
        <section className="oauth-passkey-card" aria-labelledby="oauth-passkey-title">
          <h2 id="oauth-passkey-title">
            {hasPasskey
              ? "Verify with your passkey"
              : totpFactorId
                ? "Verify with your authenticator app"
                : "Add a passkey for extra security?"}
          </h2>
          <p>
            {hasPasskey
              ? "Use your saved passkey to verify it’s you before authorizing this app. This is required every time you authorize."
              : totpFactorId
                ? "Enter a fresh 6-digit code before authorizing. After verification, you can also set up a passkey for future approvals."
                : "A passkey lets you confirm future app authorizations with your device’s fingerprint, face, PIN, or security key."}
          </p>
          {error && <p className="oauth-error" role="alert">{error}</p>}
          {hasPasskey ? (
            <button type="button" className="oauth-primary" onClick={verify} disabled={busy}>
              {busy ? "Waiting for passkey…" : "Verify passkey"}
            </button>
          ) : totpFactorId ? (
            <div className="oauth-passkey-options">
              <input
                className="oauth-totp-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={totpCode}
                onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, ""))}
                placeholder="6-digit code"
                aria-label="Authenticator code"
                disabled={busy}
              />
              <button type="button" className="oauth-primary" onClick={verifyAuthenticatorCode} disabled={busy || totpCode.length !== 6}>
                {busy ? "Verifying…" : "Verify code"}
              </button>
            </div>
          ) : (
            <div className="oauth-passkey-options">
              {passkeyAvailable && (
                <button type="button" className="oauth-primary" onClick={register} disabled={busy}>
                  {busy ? "Creating passkey…" : "Set up a passkey"}
                </button>
              )}
              <button type="button" className="oauth-secondary" onClick={() => setSkipped(true)} disabled={busy}>
                Not now
              </button>
            </div>
          )}
        </section>
      )}
      {!passkeyAvailable && !totpFactorId && (
        <p className="oauth-notice">Passkey setup is not available yet. You can continue without it.</p>
      )}
      {verified && (
        <div className="oauth-passkey-success" role="status">
          {hasPasskey ? "Passkey verified." : "Authenticator code verified."} You can now authorize this app.
          {!hasPasskey && passkeyAvailable && totpFactorId && (
            <button type="button" className="oauth-passkey-link" onClick={register} disabled={busy}>
              {busy ? "Creating passkey…" : "Set up a passkey for next time"}
            </button>
          )}
          {error && <p className="oauth-error" role="alert">{error}</p>}
        </div>
      )}
      {(verified || skipped) && children}
    </div>
  );
}
