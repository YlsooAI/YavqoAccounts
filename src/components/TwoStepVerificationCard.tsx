"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Phase = "idle" | "enrolled" | "verifying" | "busy";

type Enrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

const inputClass =
  "h-11 w-full rounded-lg border border-[#5f6368] bg-transparent px-3 text-center text-[16px] tracking-[0.3em] text-[#e8eaed] outline-none transition-colors placeholder:tracking-normal placeholder:text-[#9aa0a6] focus:border-[#8ab4f8]";

export default function TwoStepVerificationCard() {
  const [enabled, setEnabled] = useState(false);
  const [phase, setPhase] = useState<Phase>("busy");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);

  // Check whether a verified TOTP factor already exists for this user.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.mfa
      .listFactors()
      .then(({ data }) => {
        setEnabled(Boolean(data?.totp && data.totp.length > 0));
      })
      .finally(() => setPhase("idle"));
  }, []);

  async function startEnroll() {
    setMessage(null);
    setPhase("busy");
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
    });
    if (error || !data) {
      setMessage({
        kind: "error",
        text:
          error?.message ??
          "Could not start 2-Step Verification. Check that it is enabled for this project.",
      });
      setPhase("idle");
      return;
    }
    setEnrollment({
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    });
    setPhase("enrolled");
  }

  async function cancelEnroll() {
    if (enrollment) {
      const supabase = createClient();
      await supabase.auth.mfa.unenroll({ factorId: enrollment.factorId });
    }
    setEnrollment(null);
    setCode("");
    setMessage(null);
    setPhase("idle");
  }

  async function verifyCode() {
    if (!enrollment || code.length !== 6) return;
    setMessage(null);
    setPhase("verifying");
    const supabase = createClient();
    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: enrollment.factorId });
    if (challengeError || !challenge) {
      setMessage({
        kind: "error",
        text: challengeError?.message ?? "Could not create a challenge.",
      });
      setPhase("enrolled");
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: enrollment.factorId,
      challengeId: challenge.id,
      code,
    });
    if (verifyError) {
      setMessage({
        kind: "error",
        text: "That code didn't work. Try the latest code from your app.",
      });
      setPhase("enrolled");
      return;
    }
    setEnabled(true);
    setEnrollment(null);
    setCode("");
    setPhase("idle");
    setMessage({ kind: "success", text: "2-Step Verification is turned on." });
  }

  async function turnOff() {
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    const factors = data?.totp ?? [];
    setPhase("busy");
    setMessage(null);
    for (const factor of factors) {
      const { error } = await supabase.auth.mfa.unenroll({
        factorId: factor.id,
      });
      if (error) {
        setMessage({ kind: "error", text: error.message });
        setPhase("idle");
        return;
      }
    }
    setEnabled(false);
    setPhase("idle");
    setMessage({ kind: "success", text: "2-Step Verification is turned off." });
  }

  return (
    <div className="py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[14px]">2-Step Verification</p>
          <p className="mt-0.5 text-[13px] text-[#9aa0a6]">
            {enabled
              ? "On — sign in with your password plus an authenticator app code."
              : "Off — add an extra layer of protection with an authenticator app."}
          </p>
        </div>
        {phase !== "enrolled" && phase !== "verifying" && (
          <button
            type="button"
            disabled={phase === "busy"}
            onClick={enabled ? turnOff : startEnroll}
            className={`rounded-full px-5 py-2 text-[13px] font-medium transition-colors disabled:opacity-60 ${
              enabled
                ? "text-[#8ab4f8] hover:bg-[#8ab4f8]/10"
                : "bg-[#8ab4f8] text-[#202124] hover:bg-[#aecbfa]"
            }`}
          >
            {phase === "busy"
              ? enabled
                ? "Turning off…"
                : "Setting up…"
              : enabled
                ? "Turn off"
                : "Turn on"}
          </button>
        )}
      </div>

      {message && (
        <p
          className={`mt-3 text-[13px] ${
            message.kind === "error" ? "text-[#f28b82]" : "text-[#81c995]"
          }`}
        >
          {message.text}
        </p>
      )}

      {(phase === "enrolled" || phase === "verifying") && enrollment && (
        <div className="mt-4 rounded-xl border border-[#3c4043] p-4">
          <p className="text-[13px] text-[#9aa0a6]">
            1. Scan this QR code with your authenticator app (Yavqo
            Authenticator, Google Authenticator, 1Password, …).
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enrollment.qrCode}
            alt="TOTP enrollment QR code"
            className="mt-3 h-40 w-40 rounded-lg bg-white p-2"
          />
          <p className="mt-3 break-all font-mono text-[12px] text-[#9aa0a6]">
            Can&apos;t scan? Enter this key manually: {enrollment.secret}
          </p>
          <p className="mt-4 text-[13px] text-[#9aa0a6]">
            2. Enter the 6-digit code the app shows.
          </p>
          <div className="mt-3 flex max-w-xs items-center gap-3">
            <input
              inputMode="numeric"
              maxLength={6}
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className={inputClass}
              disabled={phase === "verifying"}
            />
            <button
              type="button"
              onClick={verifyCode}
              disabled={phase === "verifying" || code.length !== 6}
              className="shrink-0 rounded-full bg-[#8ab4f8] px-5 py-2 text-[13px] font-medium text-[#202124] transition-colors hover:bg-[#aecbfa] disabled:opacity-60"
            >
              {phase === "verifying" ? "Checking…" : "Verify"}
            </button>
          </div>
          <button
            type="button"
            onClick={cancelEnroll}
            disabled={phase === "verifying"}
            className="mt-3 rounded-full px-4 py-2 text-[13px] font-medium text-[#8ab4f8] transition-colors hover:bg-[#8ab4f8]/10"
          >
            Cancel setup
          </button>
        </div>
      )}
    </div>
  );
}
