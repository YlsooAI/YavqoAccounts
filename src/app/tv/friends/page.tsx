import AccountShell from "@/components/AccountShell";
import FriendsManager from "@/components/FriendsManager";
import { getAccountUser } from "@/lib/account";

export const dynamic = "force-dynamic";

export default async function TvFriendsPage() {
  const user = await getAccountUser();

  return (
    <AccountShell active="tv-friends" user={user}>
      <FriendsManager />
    </AccountShell>
  );
}
