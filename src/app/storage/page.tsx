import type { LucideIcon } from "lucide-react";
import {
  ChevronRight,
  Contact,
  Fingerprint,
  Image as ImageIcon,
  KeyRound,
  Network,
  Users,
} from "lucide-react";
import AccountShell from "@/components/AccountShell";
import { getAccountUser } from "@/lib/account";
import { createClient } from "@/lib/supabase/server";
import {
  ACCOUNT_QUOTA_BYTES,
  formatBytes,
  rowBytes,
} from "@/lib/storageUsage";

export const dynamic = "force-dynamic";

type Bucket = {
  href: string;
  icon: LucideIcon;
  color: string;
  title: string;
  items: string;
  bytes: number;
};

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
  ]);

  const passwords = passwordsRes.data ?? [];
  const contacts = contactsRes.data ?? [];
  const authorizations = authorizationsRes.data ?? [];
  const ids = idRes.data ?? [];
  const family = familyRes.data ?? [];
  const avatarFiles = avatarList.data ?? [];

  const photoBytes = avatarFiles.reduce(
    (sum, file) => sum + (file.metadata?.size ?? 0),
    0
  );
  const passwordBytes = passwords.reduce((sum, row) => sum + rowBytes(row), 0);
  const contactBytes = contacts.reduce((sum, row) => sum + rowBytes(row), 0);
  const appBytes = authorizations.reduce((sum, row) => sum + rowBytes(row), 0);
  const idBytes = ids.reduce((sum, row) => sum + rowBytes(row), 0);
  const familyBytes = family.reduce((sum, row) => sum + rowBytes(row), 0);

  const buckets: Bucket[] = [
    {
      href: "/personal/photo",
      icon: ImageIcon,
      color: "#81c995",
      title: "Photos & avatars",
      items:
        avatarFiles.length === 1
          ? "1 file"
          : `${avatarFiles.length} files`,
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

  const used = buckets.reduce((sum, bucket) => sum + bucket.bytes, 0);
  const percent = Math.min(100, (used / ACCOUNT_QUOTA_BYTES) * 100);
  const barWidth = used === 0 ? 0.6 : Math.max(percent, 1.2);

  return (
    <AccountShell active="storage" user={user}>
      <div className="mx-auto max-w-[660px] pb-16 pt-6 md:pt-10">
        <h2 className="text-[24px] font-normal">Account storage</h2>
        <p className="mt-2 text-[13px] text-[#9aa0a6]">
          Photos, saved passwords, contacts, and other account data stored with
          your Yavqo Account.
        </p>

        <section className="mt-8 rounded-2xl border border-[#3c4043] bg-[#292a2d] p-6">
          <p className="text-[15px] font-medium">
            {formatBytes(used)} of {formatBytes(ACCOUNT_QUOTA_BYTES)} used
          </p>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#3c4043]">
            <div
              className="h-full rounded-full bg-[#c58af9]"
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <p className="mt-3 text-[12px] text-[#9aa0a6]">
            {percent < 1 && used > 0
              ? "Less than 1% of your storage is in use."
              : `${percent.toFixed(percent < 10 ? 1 : 0)}% of your storage is in use.`}
          </p>
        </section>

        <h3 className="mt-10 text-[15px] font-medium text-[#9aa0a6]">
          Storage breakdown
        </h3>
        <div className="mt-3 overflow-hidden rounded-2xl border border-[#3c4043]">
          {buckets.map((bucket) => (
            <a
              key={bucket.title}
              href={bucket.href}
              className="flex items-center gap-4 border-b border-[#3c4043] bg-[#292a2d] px-5 py-4 last:border-b-0 transition-colors hover:bg-white/5"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: bucket.color }}
              >
                <bucket.icon
                  size={18}
                  className="text-[#1f1f1f]"
                  aria-hidden="true"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px]">{bucket.title}</span>
                <span className="block truncate text-[12px] text-[#9aa0a6]">
                  {bucket.items}
                </span>
              </span>
              <span className="shrink-0 text-[13px] text-[#9aa0a6]">
                {formatBytes(bucket.bytes)}
              </span>
              <ChevronRight
                size={16}
                className="shrink-0 text-[#9aa0a6]"
                aria-hidden="true"
              />
            </a>
          ))}
        </div>

        <p className="mt-6 text-[12px] leading-relaxed text-[#9aa0a6]">
          Storage is calculated from files in your avatar folder and the size of
          account records. Card details stay with Stripe and do not count toward
          this quota.
        </p>
      </div>
    </AccountShell>
  );
}
