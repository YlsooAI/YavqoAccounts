"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { currentSlot, maskEmail, rememberAccount } from "@/lib/remembered-accounts";
import Link from "next/link";
import { safeInternalPath } from "@/lib/account-slots";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const confirmationFailed = searchParams.get("error") === "confirmation-failed";
  const accountDeleted = searchParams.get("deleted") === "1";

  // Resume an OAuth authorize request (or other internal page) after login.
  const nextParam = searchParams.get("next");
  const nextTarget = safeInternalPath(nextParam);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    const supabase = createClient();

    if (mode === "signin") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
      } else {
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          const address = data.user.email ?? email;
          rememberAccount({
            slot: currentSlot(), id: data.user.id,
            name: address.split("@")[0] || "Yavqo user",
            maskedEmail: maskEmail(address), avatarUrl: null,
          });
        }
        router.push(nextTarget);
        router.refresh();
      }
    } else {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) {
        setError(signUpError.message);
      } else if (data.session) {
        if (data.user) {
          rememberAccount({
            slot: currentSlot(), id: data.user.id,
            name: email.split("@")[0] || "Yavqo user",
            maskedEmail: maskEmail(email), avatarUrl: null,
          });
        }
        router.push(nextTarget);
        router.refresh();
      } else {
        setNotice(
          "Account created. Check your inbox to confirm your email, then sign in."
        );
      }
    }

    setLoading(false);
  }

  return (
    <main className="public-page">
      <header className="public-header"><Link href="/" className="public-brand" aria-label="Yavqo Accounts home">Yavqo <span>Accounts</span></Link></header>
      <section className="public-login" aria-labelledby="login-title">
        <p className="public-overline">Yavqo Accounts</p>
        <h1 id="login-title">{mode === "signin" ? "Log in to your account" : "Create your account"}</h1>
        <p className="public-description">One account for everything Yavqo.</p>
        <form onSubmit={handleSubmit} noValidate className="public-form">
          <div className="public-field"><label htmlFor="login-email">Email address</label><input id="login-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter your email address" aria-invalid={!!error} /></div>
          <div className="public-field"><label htmlFor="login-password">Password</label><input id="login-password" type="password" required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" aria-invalid={!!error} /></div>
          {error && <p className="public-message public-error" role="alert">{error}</p>}
          {notice && <p className="public-message public-success" role="status">{notice}</p>}
          {accountDeleted && !error && !notice && <p className="public-message public-success" role="status">Your Yavqo Account has been deleted.</p>}
          {confirmationFailed && !error && <p className="public-message public-error" role="alert">Email confirmation failed or expired. Try signing in again.</p>}
          <button type="submit" disabled={loading} className="public-primary">{loading ? "Please wait…" : mode === "signin" ? "Log in" : "Create account"}</button>
        </form>
        <div className="public-login-secondary">
          <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setNotice(null); }}>
            {mode === "signin" ? "Create a new account" : "Already have an account? Log in"}
          </button>
          <Link href={`/accounts?next=${encodeURIComponent(nextTarget)}`}>Choose another account</Link>
        </div>
      </section>
      <footer className="public-footer"><span>Yavqo Accounts</span><nav aria-label="Legal"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav></footer>
    </main>
  );
}
