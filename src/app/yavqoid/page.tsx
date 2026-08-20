import { Fingerprint, Pencil, UserSearch } from "lucide-react";
import Link from "next/link";
import AccountShell from "@/components/AccountShell";
import Avatar from "@/components/Avatar";
import CopyId from "@/components/CopyId";
import YavqoIdDelete from "@/components/YavqoIdDelete";
import YavqoIdSetup from "@/components/YavqoIdSetup";
import { createClient } from "@/lib/supabase/server";
import { getAccountUser } from "@/lib/account";
import type { IdAccount } from "@/lib/yavqoid";

export const dynamic = "force-dynamic";

export default async function YavqoIdPage() {
  const user = await getAccountUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("id_accounts")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const record = (data as IdAccount | null) ?? null;

  return (
    <AccountShell active="yavqoid" user={user}>
      {record ? (
        <div className="mx-auto max-w-[560px] pb-16 pt-6 md:pt-10">
          <YavqoIdCard record={record} />
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/yavqoid/edit"
              className="flex h-9 items-center gap-2 rounded-full border border-[#5f6368] px-4 text-[13px] transition-colors hover:bg-white/5"
            >
              <Pencil size={14} aria-hidden="true" />
              Edit YavqoID
            </Link>
            <Link
              href="/yavqoid/find"
              className="flex h-9 items-center gap-2 rounded-full border border-[#5f6368] px-4 text-[13px] transition-colors hover:bg-white/5"
            >
              <UserSearch size={14} aria-hidden="true" />
              Find people
            </Link>
          </div>
          <YavqoIdDelete userId={user.id} />
        </div>
      ) : (
        <YavqoIdSetup user={user} />
      )}
    </AccountShell>
  );
}

function YavqoIdCard({ record }: { record: IdAccount }) {
  const initial = (
    (record.display_name ?? record.handle).charAt(0) || "Y"
  ).toUpperCase();
  const memberSince = record.created_at
    ? new Date(record.created_at).toLocaleDateString("en-US", {
        dateStyle: "medium",
      })
    : null;

  return (
    <>
      <div className="animate-[pop-in_0.4s_ease_both] rounded-2xl border border-[#3c4043] bg-[#292a2d] p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#8b5cf6]">
          <Fingerprint size={22} className="text-[#1f1f1f]" aria-hidden="true" />
        </span>
        <div className="mt-5 flex justify-center">
          <Avatar
            avatarUrl={record.avatar_url}
            initial={initial}
            className="h-24 w-24 text-[36px] font-normal"
          />
        </div>
        <h2 className="mt-4 text-[24px] font-normal">
          {record.display_name ?? record.handle}
        </h2>
        <div className="mt-1 flex items-center justify-center gap-1">
          <p className="text-[14px] text-[#8b5cf6]">@{record.handle}</p>
          <CopyId value={`@${record.handle}`} />
        </div>
        {record.bio && (
          <p className="mx-auto mt-4 max-w-[420px] text-[13px] leading-relaxed text-[#9aa0a6]">
            {record.bio}
          </p>
        )}
        {memberSince && (
          <p className="mt-4 text-[12px] text-[#5f6368]">
            YavqoID since {memberSince}
          </p>
        )}
      </div>
      <p className="mt-4 text-center text-[12px] leading-relaxed text-[#9aa0a6]">
        Your YavqoID is how friends find you across Yavqo products. It is
        unique — no one else can ever take it.
      </p>
    </>
  );
}
