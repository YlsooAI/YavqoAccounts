import AccountShell from "@/components/AccountShell";
import PasswordManager from "@/components/PasswordManager";
import { getAccountUser } from "@/lib/account";

export const dynamic = "force-dynamic";

export default async function PasswordPage() {
  const user = await getAccountUser();

  return (
    <AccountShell active="password" user={user}>
      <PasswordManager userId={user.id} />
    </AccountShell>
  );
}
