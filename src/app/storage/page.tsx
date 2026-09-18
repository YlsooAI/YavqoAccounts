import {
  Contact,
  Fingerprint,
  Image as ImageIcon,
  KeyRound,
  Network,
  Users,
} from "lucide-react";
import AccountShell from "@/components/AccountShell";
import StorageBoard from "@/components/StorageBoard";
import { getAccountUser } from "@/lib/account";
import { createClient } from "@/lib/supabase/server";
import { rowBytes } from "@/lib/storageUsage";

export const dynamic = "force-dynamic";

export default async function StoragePage() {
  const user = await getAccountUser();
  const supabase = await createClient();

  const [
    passwordsRes,
    contactsRes,
    authorizationsRes,
    idRes,
    familyRes,
    avatarList,
    driveList,
  ] = await Promise.all([
    supabase.from("saved_passwords").select("*").eq("user_id", user.id),
    supabase.from("contacts").select("*").eq("user_id", user.id),
    supabase.from("id_oauth_authorizations").select("*").eq("user_id", user.id),
    supabase.from("id_accounts").select("*").eq("user_id", user.id),
    supabase
      .from("family_members")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active"),
    supabase.storage.from("avatars").list(user.id, { limit: 100 }),
    supabase.storage.from("files").list(user.id, { limit: 200 }),
  ]);

  const passwords = passwordsRes.data ?? [];
  const contacts = contactsRes.data ?? [];
  const authorizations = authorizationsRes.data ?? [];
  const ids = idRes.data ?? [];
  const family = familyRes.data ?? [];
  const avatarFiles = avatarList.data ?? [];
  const driveFiles = (driveList.data ?? []).filter(
    (item) => item.id && !item.name.endsWith("/")
  );

  const photoBytes = avatarFiles.reduce(
    (sum, file) => sum + (file.metadata?.size ?? 0),
    0
  );
  const driveBytes = driveFiles.reduce(
    (sum, file) => sum + (file.metadata?.size ?? 0),
    0
  );
  const passwordBytes = passwords.reduce((sum, row) => sum + rowBytes(row), 0);
  const contactBytes = contacts.reduce((sum, row) => sum + rowBytes(row), 0);
  const appBytes = authorizations.reduce((sum, row) => sum + rowBytes(row), 0);
  const idBytes = ids.reduce((sum, row) => sum + rowBytes(row), 0);
  const familyBytes = family.reduce((sum, row) => sum + rowBytes(row), 0);

  const otherBuckets = [
    {
      href: "/personal/photo",
      icon: ImageIcon,
      color: "#81c995",
      title: "Photos & avatars",
      items:
        avatarFiles.length === 1 ? "1 file" : `${avatarFiles.length} files`,
      bytes: photoBytes,
    },
    {
      href: "/password",
      icon: KeyRound,
      color: "#8ab4f8",
      title: "Yavqo Password",
      items:
        passwords.length === 1
          ? "1 saved password"
          : `${passwords.length} saved passwords`,
      bytes: passwordBytes,
    },
    {
      href: "/contacts",
      icon: Contact,
      color: "#ff8bcb",
      title: "Contacts",
      items:
        contacts.length === 1 ? "1 contact" : `${contacts.length} contacts`,
      bytes: contactBytes,
    },
    {
      href: "/apps",
      icon: Network,
      color: "#8ab4f8",
      title: "Connected apps",
      items:
        authorizations.length === 1
          ? "1 authorized app"
          : `${authorizations.length} authorized apps`,
      bytes: appBytes,
    },
    {
      href: "/yavqoid",
      icon: Fingerprint,
      color: "#8b5cf6",
      title: "YavqoID",
      items: ids.length ? "Profile on file" : "Not set up",
      bytes: idBytes,
    },
    {
      href: "/family",
      icon: Users,
      color: "#8ab4f8",
      title: "Family",
      items: family.length ? "Family membership" : "No family group",
      bytes: familyBytes,
    },
  ];

  const otherBytes =
    photoBytes + passwordBytes + contactBytes + appBytes + idBytes + familyBytes;

  return (
    <AccountShell active="storage" user={user}>
      <div className="mx-auto max-w-[660px] pb-16 pt-6 md:pt-10">
        <h2 className="text-[24px] font-normal">Account storage</h2>
        <p className="mt-2 text-[13px] text-[#9aa0a6]">
          Store images, videos, and other files up to 50 MB each. Account data
          also counts toward your 1 GB quota.
        </p>

        <StorageBoard
          userId={user.id}
          otherBytes={otherBytes}
          initialDriveBytes={driveBytes}
          initialDriveCount={driveFiles.length}
          otherBuckets={otherBuckets}
        />

        <p className="mt-6 text-[12px] leading-relaxed text-[#9aa0a6]">
          Drive files are private to your account. Card details stay with Stripe
          and do not count toward this quota.
        </p>
      </div>
    </AccountShell>
  );
}
