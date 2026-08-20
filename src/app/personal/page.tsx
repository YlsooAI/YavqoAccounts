import AccountShell from "@/components/AccountShell";
import PersonalInfoEditor from "@/components/PersonalInfoEditor";
import { createClient } from "@/lib/supabase/server";
import { getAccountUser } from "@/lib/account";

export const dynamic = "force-dynamic";

export default async function PersonalInfoPage() {
  const user = await getAccountUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, birthday, gender")
    .eq("id", user.id)
    .maybeSingle();

  const initial = {
    fullName: (profile?.full_name as string | null) ?? null,
    birthday: (profile?.birthday as string | null) ?? null,
    gender: (profile?.gender as string | null) ?? null,
  };

  return (
    <AccountShell active="personal" user={user}>
      <div className="mx-auto max-w-[660px] pb-16 pt-6 md:pt-10">
        <h2 className="text-[24px] font-normal">Basic info</h2>
        <p className="mt-2 text-[13px] text-[#9aa0a6]">
          Basic info on your Yavqo Account. You choose who sees this.
        </p>

        <section className="mt-8 rounded-2xl border border-[#3c4043] px-6">
          <h3 className="border-b border-[#3c4043] py-4 text-[16px]">
            Basic info
          </h3>
          <PersonalInfoEditor userId={user.id} initial={initial} />
        </section>
      </div>
    </AccountShell>
  );
}
