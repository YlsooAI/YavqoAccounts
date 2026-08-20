"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function DataExportButton({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const [status, setStatus] = useState<"idle" | "busy" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    if (status === "busy") return;
    setStatus("busy");
    setError(null);

    const supabase = createClient();
    const [profileRes, passwordsRes, contactsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase
        .from("saved_passwords")
        .select("site_name, site_url, username, password, created_at, updated_at")
        .eq("user_id", userId)
        .order("site_name"),
      supabase
        .from("contacts")
        .select("name, email, phone, notes, is_favorite, created_at, updated_at")
        .eq("user_id", userId)
        .order("name"),
    ]);

    const failed = [profileRes, passwordsRes, contactsRes].find(
      (res) => res.error
    );
    if (failed) {
      setError(failed.error?.message ?? "Export failed.");
      setStatus("error");
      return;
    }

    const payload = {
      exported_at: new Date().toISOString(),
      account: {
        id: userId,
        email,
        profile: profileRes.data,
      },
      saved_passwords: passwordsRes.data,
      contacts: contactsRes.data,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "yavqo-account-data.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus("idle");
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleExport}
        disabled={status === "busy"}
        className="flex h-9 items-center gap-2 rounded-full border border-[#5f6368] px-5 text-[13px] font-medium text-[#8ab4f8] transition-colors hover:bg-[#8ab4f8]/10 disabled:opacity-60"
      >
        <Download size={16} aria-hidden="true" />
        {status === "busy" ? "Preparing…" : "Download your data"}
      </button>
      {status === "error" && error && (
        <p className="text-[12px] text-[#f28b82]">{error}</p>
      )}
    </div>
  );
}
