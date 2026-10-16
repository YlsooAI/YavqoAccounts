import AccountShell from "@/components/AccountShell";
import PasswordManager from "@/components/PasswordManager";
import SecurityGate from "@/components/SecurityGate";
import { getAccountUser } from "@/lib/account";
import { getSecurityStatus } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PasswordPage() {
  const user = await getAccountUser("/password");
  const security = await getSecurityStatus(await createClient());

  return (
    <AccountShell active="password" user={user}>
      <SecurityGate
        feature="saved-passwords"
        status={security}
        heading="Yavqo Password"
      >
        <PasswordManager userId={user.id} />
      </SecurityGate>
    </AccountShell>
  );
}
