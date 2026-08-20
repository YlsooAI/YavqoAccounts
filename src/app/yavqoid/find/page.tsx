import AccountShell from "@/components/AccountShell";
import FindPeople from "@/components/FindPeople";
import { getAccountUser } from "@/lib/account";

export const dynamic = "force-dynamic";

export default async function FindPeoplePage() {
  const user = await getAccountUser();

  return (
    <AccountShell active="yavqoid-find" user={user}>
      <FindPeople />
    </AccountShell>
  );
}
