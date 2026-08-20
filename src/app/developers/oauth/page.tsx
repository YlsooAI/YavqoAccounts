import AccountShell from "@/components/AccountShell";
import OAuthDeveloperConsole from "@/components/OAuthDeveloperConsole";
import { getAccountUser } from "@/lib/account";

export const dynamic = "force-dynamic";

export default async function DevelopersOAuthPage() {
  const user = await getAccountUser();

  return (
    <AccountShell active="developers-oauth" user={user}>
      <OAuthDeveloperConsole userId={user.id} />
    </AccountShell>
  );
}
