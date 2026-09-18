import AccountShell from "@/components/AccountShell";
import DeleteAccountForm from "@/components/DeleteAccountForm";
import { getAccountUser } from "@/lib/account";

export const dynamic = "force-dynamic";

export default async function DeleteAccountPage() {
  const user = await getAccountUser();

  return (
    <AccountShell active="delete-account" user={user}>
      <DeleteAccountForm email={user.email} userId={user.id} />
    </AccountShell>
  );
}
