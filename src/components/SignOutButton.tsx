"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="flex items-center gap-1.5 rounded-full p-2 text-[13px] text-[#9aa0a6] transition-colors hover:bg-white/10 hover:text-white"
    >
      <LogOut size={16} aria-hidden="true" />
      <span className="hidden sm:inline">Sign out</span>
    </button>
  );
}
