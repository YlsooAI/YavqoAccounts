import AccountShell from "@/components/AccountShell";
import OAuthDeveloperConsole from "@/components/OAuthDeveloperConsole";
import SecurityGate from "@/components/SecurityGate";
import { getAccountUser } from "@/lib/account";
import { getSecurityStatus } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DevelopersOAuthPage() {
  const user = await getAccountUser("/developers/oauth");
  const security = await getSecurityStatus(await createClient());

  return (
    <AccountShell active="developers-oauth" user={user}>
      <SecurityGate
        feature="developer-credentials"
        status={security}
        heading="OAuth"
      >
        <OAuthDeveloperConsole userId={user.id} />
      </SecurityGate>
    </AccountShell>
  );
}
