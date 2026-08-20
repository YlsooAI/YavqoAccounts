"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ResendVerificationButton({ email }: { email: string }) {
  const [status, setStatus] = useState<"idle" | "busy" | "sent" | "error">(
    "idle"
  );

  async function resend() {
    if (status === "busy") return;
    setStatus("busy");
    const supabase = createClient();
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setStatus(error ? "error" : "sent");
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={resend}
        disabled={status === "busy"}
        className="rounded-full px-5 py-2 text-[13px] font-medium text-[#8ab4f8] transition-colors hover:bg-[#8ab4f8]/10 disabled:opacity-60"
      >
        {status === "busy" ? "Sending…" : "Resend confirmation"}
      </button>
      {status === "sent" && (
        <span className="text-[12px] text-[#81c995]">
          Confirmation email sent.
        </span>
      )}
      {status === "error" && (
        <span className="text-[12px] text-[#f28b82]">
          Couldn&apos;t send the email. Try again later.
        </span>
      )}
    </div>
  );
}
