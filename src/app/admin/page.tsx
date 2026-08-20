import AccountShell from "@/components/AccountShell";
import AdminTools from "@/components/AdminTools";
import { getAccountUser } from "@/lib/account";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getAccountUser();

  return (
    <AccountShell active="admin" user={user}>
      <div className="mx-auto max-w-[560px] pb-16 pt-6 md:pt-10">
        <h2 className="text-[24px] font-normal">Admin</h2>
        <p className="mt-2 text-[13px] text-[#9aa0a6]">
          Testing utilities for this deployment. Actions only ever affect the
          signed-in account — nothing here can touch other users.
        </p>
        <AdminTools />
      </div>
    </AccountShell>
  );
}
