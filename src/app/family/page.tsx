import AccountShell from "@/components/AccountShell";
import FamilyManager from "@/components/FamilyManager";
import { getAccountUser } from "@/lib/account";

export const dynamic = "force-dynamic";

export default async function FamilyPage() {
  const user = await getAccountUser();

  return (
    <AccountShell active="family" user={user}>
      <FamilyManager userId={user.id} email={user.email} />
    </AccountShell>
  );
}
