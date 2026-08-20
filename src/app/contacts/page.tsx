import AccountShell from "@/components/AccountShell";
import ContactsManager from "@/components/ContactsManager";
import { getAccountUser } from "@/lib/account";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const user = await getAccountUser();

  return (
    <AccountShell active="contacts" user={user}>
      <ContactsManager userId={user.id} />
    </AccountShell>
  );
}
