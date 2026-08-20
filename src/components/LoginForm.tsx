"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

  // Resume an OAuth authorize request (or other internal page) after login.
  const nextParam = searchParams.get("next");
  const nextTarget =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/";

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
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-[400px] rounded-2xl bg-[#292a2d] p-8">
        <div className="flex flex-col items-center text-center">
          <img
            src="/img/logo.png"
            alt="Yavqo"
            className="h-20 w-20 rounded-3xl"
          />
          <h1 className="mt-4 text-[22px] font-normal">
            {mode === "signin"
              ? "Sign in to your Yavqo Account"
              : "Create your Yavqo Account"}
          </h1>
          <p className="mt-1 text-[13px] text-[#9aa0a6]">
            One account for everything Yavqo.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Email address"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-11 rounded-lg border border-[#3c4043] bg-[#202124] px-4 text-[14px] outline-none placeholder:text-[#9aa0a6] focus:border-[#8ab4f8]"
          />
          <input
            type="password"
            required
            minLength={6}
            autoComplete={
              mode === "signin" ? "current-password" : "new-password"
            }
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11 rounded-lg border border-[#3c4043] bg-[#202124] px-4 text-[14px] outline-none placeholder:text-[#9aa0a6] focus:border-[#8ab4f8]"
          />

          {error && <p className="text-[13px] text-[#f28b82]">{error}</p>}
          {notice && <p className="text-[13px] text-[#81c995]">{notice}</p>}
          {confirmationFailed && !error && (
            <p className="text-[13px] text-[#f28b82]">
              Email confirmation failed or expired. Try signing in again.
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-11 rounded-full bg-[#8ab4f8] text-[14px] font-medium text-[#202124] transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loading
              ? "Please wait…"
              : mode === "signin"
                ? "Sign In"
                : "Create Account"}
          </button>
        </form>

        <p className="mt-6 text-center text-[13px] text-[#9aa0a6]">
          {mode === "signin" ? (
            <>
              No account yet?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setNotice(null);
                }}
                className="font-medium text-[#8ab4f8] hover:underline"
              >
                Create your Yavqo Account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setNotice(null);
                }}
                className="font-medium text-[#8ab4f8] hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
