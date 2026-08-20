import { redirect } from "next/navigation";
import AccountShell from "@/components/AccountShell";
import YavqoIdEditor from "@/components/YavqoIdEditor";
import { createClient } from "@/lib/supabase/server";
import { getAccountUser } from "@/lib/account";
import type { IdAccount } from "@/lib/yavqoid";

export const dynamic = "force-dynamic";

export default async function EditYavqoIdPage() {
  const user = await getAccountUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("id_accounts")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const record = (data as IdAccount | null) ?? null;
  if (!record) redirect("/yavqoid");

  return (
    <AccountShell active="yavqoid-edit" user={user}>
      <YavqoIdEditor record={record} user={user} />
    </AccountShell>
  );
}
