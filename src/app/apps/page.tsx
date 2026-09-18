import AccountShell from "@/components/AccountShell";
import ConnectedAppsManager from "@/components/ConnectedAppsManager";
import { getAccountUser } from "@/lib/account";

export const dynamic = "force-dynamic";

export default async function ConnectedAppsPage() {
  const user = await getAccountUser();

  return (
    <AccountShell active="apps" user={user}>
      <ConnectedAppsManager userId={user.id} />
    </AccountShell>
  );
}
