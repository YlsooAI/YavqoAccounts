import { Mail } from "lucide-react";
import AccountShell from "@/components/AccountShell";
import PhoneEditor from "@/components/PhoneEditor";
import { createClient } from "@/lib/supabase/server";
import { getAccountUser } from "@/lib/account";

export const dynamic = "force-dynamic";

export default async function ContactInfoPage() {
  const user = await getAccountUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("phone")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <AccountShell active="personal-contact" user={user}>
      <div className="mx-auto max-w-[660px] pb-16 pt-6 md:pt-10">
        <h2 className="text-[24px] font-normal">Contact info</h2>
        <p className="mt-2 text-[13px] text-[#9aa0a6]">
          How you can be reached across Yavqo services.
        </p>

        <section className="mt-8 rounded-2xl border border-[#3c4043] px-6">
          <h3 className="border-b border-[#3c4043] py-4 text-[16px]">Email</h3>
          <div className="flex items-center justify-between gap-4 py-4">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[14px]">
                <Mail size={14} className="text-[#9aa0a6]" aria-hidden="true" />
                Email
              </p>
              <p className="mt-0.5 truncate text-[13px] text-[#9aa0a6]">
                {user.email}
              </p>
            </div>
            <a
              href="/security"
              className="shrink-0 rounded-full px-5 py-2 text-[13px] font-medium text-[#8ab4f8] transition-colors hover:bg-[#8ab4f8]/10"
            >
              Manage sign-in
            </a>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-[#3c4043] px-6">
          <h3 className="border-b border-[#3c4043] py-4 text-[16px]">Phone</h3>
          <PhoneEditor
            userId={user.id}
            initialPhone={(profile?.phone as string | null) ?? null}
          />
        </section>
      </div>
    </AccountShell>
  );
}
