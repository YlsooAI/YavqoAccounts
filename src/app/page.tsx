import type { LucideIcon } from "lucide-react";
import {
  Bell,
  ChevronRight,
  CircleAlert,
  Contact,
  KeyRound,
  Link2,
  Lock,
  MapPin,
  SlidersHorizontal,
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
      supabase.from("saved_passwords").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("contacts").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("tv_friends").select("*", { count: "exact", head: true }).or("user_id.eq." + user.id + ",friend_id.eq." + user.id),
      supabase.from("family_members").select("families(name)").eq("user_id", user.id).eq("status", "active").maybeSingle(),
      supabase.from("subscriptions").select("status, gift_access_until, cancel_at_period_end").eq("user_id", user.id).maybeSingle(),
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
    ? new Date(user.lastSignInAt).toLocaleDateString("en-US", { dateStyle: "medium" })
    : null;

  return (
    <AccountShell active="overview" user={user}>
      <div className="account-overview">
        <header className="overview-intro">
          <h1>Account overview</h1>
          <p>Your personal details, security, and Yavqo services in one place.</p>
        </header>

        <section className="overview-profile" aria-label="Your profile">
          <div className="account-overview-avatar">
            <Avatar avatarUrl={user.avatarUrl} initial={user.initial} className="overview-avatar-image" />
            <AvatarUploadButton userId={user.id} />
          </div>
          <div className="overview-profile-copy">
            <h2>{user.displayName}</h2>
            <p>{user.email}</p>
            <span className="overview-profile-status">
              {user.emailConfirmed ? "Email confirmed" : "Email confirmation needed"}
            </span>
          </div>
          <Link className="overview-profile-action" href="/personal">
            Edit profile <ChevronRight size={17} aria-hidden="true" />
          </Link>
        </section>

        {!user.emailConfirmed && (
          <div className="overview-notice" role="status">
            <CircleAlert size={20} aria-hidden="true" />
            <div>
              <strong>Confirm your email address</strong>
              <p>We sent a confirmation link to {user.email}. Some account features stay limited until you confirm it.</p>
              <ResendVerificationButton email={user.email} />
            </div>
          </div>
        )}

        {sub?.status === "incomplete" && (
          <div className="overview-notice" role="status">
            <CircleAlert size={20} aria-hidden="true" />
            <div>
              <strong>Your Yavqo TV payment is incomplete</strong>
              <p>Finish setting up a payment method to keep watching without interruption.</p>
              <Link href="/wallet">Review payment <ChevronRight size={15} aria-hidden="true" /></Link>
            </div>
          </div>
        )}

        <div className="overview-columns">
          <section className="overview-section" aria-labelledby="overview-account-title">
            <div className="overview-section-heading">
              <h2 id="overview-account-title">Your account</h2>
              <p>Keep your essentials up to date.</p>
            </div>
            <div className="overview-list">
              <OverviewRow href="/security" icon={Lock} title="Security & sign-in" detail={lastSignIn ? "Last sign-in " + lastSignIn : "Manage your sign-in options"} />
              <OverviewRow href="/wallet" icon={Wallet} title="Wallet & subscriptions" detail={subscriptionLabel(sub)} />
              <OverviewRow href="/password" icon={KeyRound} title="Saved passwords" detail={pluralCount(passwordCount, "password")} />
              <OverviewRow href="/addresses" icon={MapPin} title="Saved addresses" detail="Manage the places you use" />
            </div>
          </section>

          <section className="overview-section" aria-labelledby="overview-people-title">
            <div className="overview-section-heading">
              <h2 id="overview-people-title">People & services</h2>
              <p>Manage how you connect across Yavqo.</p>
            </div>
            <div className="overview-list">
              <OverviewRow href="/contacts" icon={Contact} title="Contacts & sharing" detail={pluralCount(contactCount, "contact")} />
              <OverviewRow href="/tv/friends" icon={Tv} title="Yavqo TV friends" detail={pluralCount(friendCount, "friend")} />
              <OverviewRow href="/family" icon={Users} title="Family" detail={familyName ? "Member of " + familyName : "No family group"} />
              <OverviewRow href="/yavqoid" icon={Link2} title="YavqoID" detail="Your identity across Yavqo" />
            </div>
          </section>
        </div>

        <section className="overview-more" aria-labelledby="overview-more-title">
          <h2 id="overview-more-title">More settings</h2>
          <div>
            <Link href="/notifications"><Bell size={18} aria-hidden="true" /> Notifications <ChevronRight size={16} aria-hidden="true" /></Link>
            <Link href="/preferences"><SlidersHorizontal size={18} aria-hidden="true" /> Preferences <ChevronRight size={16} aria-hidden="true" /></Link>
            <Link href="/developers/oauth"><Link2 size={18} aria-hidden="true" /> Developer credentials <ChevronRight size={16} aria-hidden="true" /></Link>
          </div>
        </section>
      </div>
    </AccountShell>
  );
}

function pluralCount(count: number, noun: string): string {
  return count + " " + noun + (count === 1 ? "" : "s");
}

function subscriptionLabel(sub: Subscription | null): string {
  if (!sub?.status) return "No active Yavqo TV subscription";
  if (sub.status === "active") {
    return sub.cancel_at_period_end
      ? "Yavqo TV · Active, cancels at period end"
      : "Yavqo TV · Active";
  }
  if (sub.gift_access_until && new Date(sub.gift_access_until).getTime() > Date.now()) {
    return "Yavqo TV · Gift access";
  }
  if (sub.status === "incomplete") return "Yavqo TV · Payment incomplete";
  if (sub.status === "canceled") return "Yavqo TV · Canceled";
  return "Yavqo TV · " + sub.status;
}

function OverviewRow({
  href,
  icon: Icon,
  title,
  detail,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  detail: string;
}) {
  return (
    <Link href={href} className="overview-row">
      <span className="overview-row-icon"><Icon size={21} strokeWidth={1.8} aria-hidden="true" /></span>
      <span className="overview-row-copy">
        <strong>{title}</strong>
        <span>{detail}</span>
      </span>
      <ChevronRight size={18} className="overview-row-chevron" aria-hidden="true" />
    </Link>
  );
}
