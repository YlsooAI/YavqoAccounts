"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  PROTECTED_FEATURES,
  REQUIREMENTS,
  type ProtectedFeature,
  type SecurityRequirement,
} from "@/lib/security-requirements";

const SETUP_LINKS: Partial<Record<SecurityRequirement, string>> = {
  email: "/security#account-status",
  "two-step": "/security#two-step",
};

export default function LockedFeature({ feature, missing, totpFactorId }: {
  feature: ProtectedFeature;
  missing: SecurityRequirement[];
  totpFactorId: string | null;
}) {
  const { title } = PROTECTED_FEATURES[feature];
  // Only the code prompt is left: the user has set everything up and just
  // needs to prove it's them again.
  const stepUpOnly = missing.length === 1 && missing[0] === "recent-verification";

  return (
    <section
      className="mt-6 rounded-2xl border border-[#3c4043] px-6 py-6"
      aria-labelledby={`locked-${feature}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#8ab4f8]/15 text-[#8ab4f8]">
          <Lock size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 id={`locked-${feature}`} className="text-[16px]">
            {stepUpOnly ? `Verify it's you to open ${title.toLowerCase()}` : `${title} are locked for your security`}
          </h3>
          <p className="mt-1 text-[13px] text-[#9aa0a6]">
            {stepUpOnly
              ? REQUIREMENTS["recent-verification"].description
              : `Finish these security steps to use ${title.toLowerCase()}.`}
          </p>
        </div>
      </div>

      {stepUpOnly ? (
        <StepUpVerify factorId={totpFactorId} />
      ) : (
        <ul className="mt-5 border-t border-[#3c4043]">
          {missing
            .filter((requirement) => requirement !== "recent-verification")
            .map((requirement) => (
              <li key={requirement} className="border-b border-[#3c4043] last:border-b-0">
                <Link
                  href={SETUP_LINKS[requirement] ?? "/security"}
                  className="flex items-center justify-between gap-4 py-4 transition-opacity hover:opacity-80"
                >
                  <span>
                    <span className="block text-[14px]">{REQUIREMENTS[requirement].label}</span>
                    <span className="mt-0.5 block text-[13px] text-[#9aa0a6]">
                      {REQUIREMENTS[requirement].description}
                    </span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-[#9aa0a6]" aria-hidden="true" />
                </Link>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}

function StepUpVerify({ factorId }: { factorId: string | null }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!factorId || !/^\d{6}$/.test(code)) return;
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
    router.refresh();
  }

  if (!factorId) {
    return (
      <p className="mt-4 text-[13px] text-[#f28b82]" role="alert">
        No authenticator app is set up. Turn on 2-Step Verification first.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 flex max-w-sm flex-wrap items-center gap-3">
      <label htmlFor="step-up-code" className="sr-only">Verification code</label>
      <input
        id="step-up-code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="6-digit code"
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
        disabled={busy}
        aria-invalid={!!error}
        className="h-11 min-w-0 flex-1 rounded-lg border border-[#5f6368] bg-transparent px-3 text-center text-[16px] tracking-[0.3em] text-[#e8eaed] outline-none transition-colors placeholder:tracking-normal placeholder:text-[#9aa0a6] focus:border-[#8ab4f8]"
      />
      <button
        type="submit"
        disabled={busy || code.length !== 6}
        className="shrink-0 rounded-full bg-[#8ab4f8] px-5 py-2 text-[13px] font-medium text-[#202124] transition-colors hover:bg-[#aecbfa] disabled:opacity-60"
      >
        {busy ? "Checking…" : "Verify"}
      </button>
      {error && <p className="basis-full text-[13px] text-[#f28b82]" role="alert">{error}</p>}
    </form>
  );
}
