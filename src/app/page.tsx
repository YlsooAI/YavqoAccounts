import type { LucideIcon } from "lucide-react";
import {
  ChevronRight,
  CircleAlert,
  Contact,
  KeyRound,
  Link2,
  Lock,
  Tv,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import AccountShell from "@/components/AccountShell";
import Avatar from "@/components/Avatar";
import AvatarUploadButton from "@/components/AvatarUploadButton";
import ResendVerificationButton from "@/components/ResendVerificationButton";
import { createClient } from "@/lib/supabase/server";
import { getAccountUser } from "@/lib/account";

export const dynamic = "force-dynamic";

type Subscription = {
  status: string | null;
  gift_access_until: string | null;
  cancel_at_period_end: boolean | null;
};

export default async function AccountPage() {
  const user = await getAccountUser();
  const supabase = await createClient();

  const [passwords, contacts, friends, membership, subscription] =
    await Promise.all([
      supabase
        .from("saved_passwords")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("tv_friends")
        .select("*", { count: "exact", head: true })
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`),
      supabase
        .from("family_members")
        .select("families(name)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle(),
      supabase
        .from("subscriptions")
        .select("status, gift_access_until, cancel_at_period_end")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  const passwordCount = passwords.count ?? 0;
  const contactCount = contacts.count ?? 0;
  const friendCount = friends.count ?? 0;
  const familyRaw = membership.data?.families as
    | { name: string }
    | { name: string }[]
    | null
    | undefined;
  const familyName = Array.isArray(familyRaw)
    ? (familyRaw[0]?.name ?? null)
    : (familyRaw?.name ?? null);
  const sub = (subscription.data as Subscription | null) ?? null;

  const lastSignIn = user.lastSignInAt
    ? new Date(user.lastSignInAt).toLocaleDateString("en-US", {
        dateStyle: "medium",
      })
    : null;

  return (
    <AccountShell active="overview" user={user}>
      <div className="mx-auto max-w-[660px] pb-16 pt-6 md:pt-10">
        <div className="flex flex-col items-center text-center">
          <Avatar
            avatarUrl={user.avatarUrl}
            initial={user.initial}
            className="h-24 w-24 text-[40px] font-normal"
          />
          <AvatarUploadButton userId={user.id} />
          <h2 className="mt-4 text-[24px] font-normal">{user.displayName}</h2>
          <p className="mt-1 text-[13px] text-[#9aa0a6]">{user.email}</p>
        </div>

        {!user.emailConfirmed && (
          <div className="mt-8 rounded-xl bg-[#452b0c] p-5 text-left">
            <div className="flex gap-3">
              <CircleAlert
                size={20}
                className="mt-0.5 shrink-0 text-[#fbbc04]"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium text-[#fdd663]">
                  Confirm your email address
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-[#f6b53f]/90">
                  We sent a confirmation link to {user.email}. Some account
                  features stay limited until you confirm it.
                </p>
                <div className="mt-3">
                  <ResendVerificationButton email={user.email} />
                </div>
              </div>
            </div>
          </div>
        )}

        {sub?.status === "incomplete" && (
          <div className="mt-8 rounded-xl bg-[#452b0c] p-5 text-left">
            <div className="flex gap-3">
              <CircleAlert
                size={20}
                className="mt-0.5 shrink-0 text-[#fbbc04]"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium text-[#fdd663]">
                  Your Yavqo TV payment is incomplete
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-[#f6b53f]/90">
                  Finish setting up a payment method to keep watching without
                  interruption.
                </p>
                <div className="mt-3 flex justify-end">
                  <Link
                    href="/wallet"
                    className="rounded-full bg-[#fbbc04] px-5 py-2 text-[13px] font-medium text-[#201a00] transition-opacity hover:opacity-90"
                  >
                    Review payment
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        <h3 className="mt-10 text-left text-[15px] font-medium text-[#9aa0a6]">
          Your account
        </h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <OverviewCard
            href="/security"
            icon={Lock}
            tint="#8ab4f8"
            title="Security & sign-in"
            lines={[
              user.emailConfirmed
                ? "Email confirmed"
                : "Email not confirmed yet",
              lastSignIn ? `Last sign-in ${lastSignIn}` : "First sign-in",
            ]}
          />
          <OverviewCard
            href="/wallet"
            icon={Wallet}
            tint="#c58af9"
            title="Yavqo Wallet"
            lines={[subscriptionLabel(sub)]}
          />
          <OverviewCard
            href="/password"
            icon={KeyRound}
            tint="#8ab4f8"
            title="Yavqo Password"
            lines={[
              passwordCount === 1
                ? "1 saved password"
                : `${passwordCount} saved passwords`,
            ]}
          />
          <OverviewCard
            href="/contacts"
            icon={Contact}
            tint="#ff8bcb"
            title="Contacts & sharing"
            lines={[
              contactCount === 1 ? "1 contact" : `${contactCount} contacts`,
            ]}
          />
          <OverviewCard
            href="/tv/friends"
            icon={Tv}
            tint="#c58af9"
            title="YavqoTV Friends"
            lines={[friendCount === 1 ? "1 friend" : `${friendCount} friends`]}
          />
          <OverviewCard
            href="/family"
            icon={Users}
            tint="#81c995"
            title="Family"
            lines={[familyName ? `Member of ${familyName}` : "No family group"]}
          />
        </div>

        <h3 className="mt-10 text-left text-[15px] font-medium text-[#9aa0a6]">
          Developers
        </h3>
        <div className="mt-3">
          <Link
            href="/developers/oauth"
            className="flex h-10 w-fit items-center gap-2 rounded-full border border-[#5f6368] px-5 text-[13px] transition-colors hover:bg-white/5"
          >
            <Link2 size={15} className="text-[#fcad70]" aria-hidden="true" />
            OAuth
          </Link>
        </div>
      </div>
    </AccountShell>
  );
}

function subscriptionLabel(sub: Subscription | null): string {
  if (!sub?.status) return "Not subscribed to Yavqo TV";
  if (sub.status === "active") {
    return sub.cancel_at_period_end
      ? "Yavqo TV · Active, cancels at period end"
      : "Yavqo TV · Active";
  }
  if (
    sub.gift_access_until &&
    new Date(sub.gift_access_until).getTime() > Date.now()
  ) {
    return "Yavqo TV · Gift access";
  }
  if (sub.status === "incomplete") return "Yavqo TV · Payment incomplete";
  if (sub.status === "canceled") return "Yavqo TV · Canceled";
  return `Yavqo TV · ${sub.status}`;
}

function OverviewCard({
  href,
  icon: Icon,
  tint,
  title,
  lines,
}: {
  href: string;
  icon: LucideIcon;
  tint: string;
  title: string;
  lines: string[];
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-[#3c4043] bg-[#292a2d] p-5 text-left transition-colors hover:border-[#5f6368]"
    >
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: tint }}
        >
          <Icon size={18} strokeWidth={2} className="text-[#1f1f1f]" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
          {title}
        </span>
        <ChevronRight
          size={16}
          className="shrink-0 text-[#9aa0a6] transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </div>
      <div className="mt-3 space-y-1">
        {lines.map((line) => (
          <p key={line} className="truncate text-[12px] text-[#9aa0a6]">
            {line}
          </p>
        ))}
      </div>
    </Link>
  );
}
