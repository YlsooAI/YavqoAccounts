import { ArrowUpRight, ChevronRight, Fingerprint, Pencil, ShieldCheck, UserRound, Users } from "lucide-react";
import Link from "next/link";
import AccountShell from "@/components/AccountShell";
import Avatar from "@/components/Avatar";
import CopyId from "@/components/CopyId";
import YavqoIdDelete from "@/components/YavqoIdDelete";
import YavqoIdSetup from "@/components/YavqoIdSetup";
import { createClient } from "@/lib/supabase/server";
import { getAccountUser } from "@/lib/account";
import type { IdAccount } from "@/lib/yavqoid";

export const dynamic = "force-dynamic";

export default async function YavqoIdPage() {
  const user = await getAccountUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("id_accounts").select("*").eq("user_id", user.id).maybeSingle();
  const record = (data as IdAccount | null) ?? null;

  return (
    <AccountShell active="yavqoid" user={user}>
      {error ? (
        <div className="yid-page" role="alert"><h1>YavqoID is unavailable</h1><p>We couldn’t load your profile. Refresh the page to try again.</p></div>
      ) : record ? <YavqoIdHub record={record} userId={user.id} /> : <YavqoIdSetup user={user} />}
    </AccountShell>
  );
}

function YavqoIdHub({ record, userId }: { record: IdAccount; userId: string }) {
  const name = record.display_name?.trim() || record.handle;
  const joined = record.created_at
    ? new Date(record.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

  return (
    <div className="yid-page">
      <div className="yid-heading">
        <div>
          <p className="yid-eyebrow">Your identity</p>
          <h1>YavqoID</h1>
          <p>Manage how people recognize and find you across Yavqo.</p>
        </div>
      </div>

      <section className="yid-profile" aria-labelledby="yid-profile-title">
        <div className="yid-profile-main">
          <Avatar avatarUrl={record.avatar_url} initial={name.charAt(0).toUpperCase()} className="h-20 w-20 shrink-0 text-[32px]" />
          <div className="yid-profile-text">
            <p className="yid-profile-label">Your YavqoID</p>
            <h2 id="yid-profile-title">{name}</h2>
            <div className="yid-handle"><span>@{record.handle}</span><CopyId value={`@${record.handle}`} label="Copy YavqoID handle" /></div>
          </div>
        </div>
        {record.bio && <p className="yid-bio">{record.bio}</p>}
        {joined && <p className="yid-member">YavqoID member since {joined}</p>}
        <div className="yid-profile-actions">
          <Link href="/yavqoid/edit" className="yid-button yid-button-primary"><Pencil size={16} aria-hidden="true" /> Edit profile</Link>
          <Link href="/yavqoid/find" className="yid-button yid-button-secondary"><Users size={17} aria-hidden="true" /> Find people</Link>
        </div>
      </section>

      <section className="yid-section" aria-labelledby="yid-details-title">
        <div className="yid-section-heading"><div><h2 id="yid-details-title">Profile details</h2><p>These details are shown to people who find your YavqoID.</p></div></div>
        <div className="yid-list">
          <Link href="/yavqoid/edit" className="yid-row"><span className="yid-row-icon"><UserRound size={20} aria-hidden="true" /></span><span className="yid-row-copy"><strong>Name and photo</strong><span>Choose how your profile appears</span></span><ChevronRight size={19} aria-hidden="true" /></Link>
          <Link href="/yavqoid/edit" className="yid-row"><span className="yid-row-icon"><Fingerprint size={20} aria-hidden="true" /></span><span className="yid-row-copy"><strong>Handle</strong><span>@{record.handle}</span></span><ChevronRight size={19} aria-hidden="true" /></Link>
        </div>
      </section>

      <section className="yid-section" aria-labelledby="yid-connections-title">
        <div className="yid-section-heading"><div><h2 id="yid-connections-title">Connections and access</h2><p>See where your identity connects with other Yavqo features.</p></div></div>
        <div className="yid-list">
          <Link href="/yavqoid/find" className="yid-row"><span className="yid-row-icon"><Users size={20} aria-hidden="true" /></span><span className="yid-row-copy"><strong>Find people</strong><span>Search by YavqoID and connect</span></span><ChevronRight size={19} aria-hidden="true" /></Link>
          <Link href="/tv/friends" className="yid-row"><span className="yid-row-icon"><UserRound size={20} aria-hidden="true" /></span><span className="yid-row-copy"><strong>Yavqo TV friends</strong><span>Manage people you’ve added</span></span><ChevronRight size={19} aria-hidden="true" /></Link>
          <Link href="/apps" className="yid-row"><span className="yid-row-icon"><ArrowUpRight size={20} aria-hidden="true" /></span><span className="yid-row-copy"><strong>Connected apps</strong><span>Review apps with access to your account</span></span><ChevronRight size={19} aria-hidden="true" /></Link>
        </div>
      </section>

      <section className="yid-section" aria-labelledby="yid-security-title">
        <div className="yid-section-heading"><div><h2 id="yid-security-title">Account and security</h2><p>Your YavqoID is part of your Yavqo Account.</p></div></div>
        <div className="yid-list">
          <Link href="/security" className="yid-row"><span className="yid-row-icon"><ShieldCheck size={20} aria-hidden="true" /></span><span className="yid-row-copy"><strong>Security and sign-in</strong><span>Manage how you access your account</span></span><ChevronRight size={19} aria-hidden="true" /></Link>
          <Link href="/personal" className="yid-row"><span className="yid-row-icon"><UserRound size={20} aria-hidden="true" /></span><span className="yid-row-copy"><strong>Personal details</strong><span>Review your account information</span></span><ChevronRight size={19} aria-hidden="true" /></Link>
        </div>
      </section>

      <YavqoIdDelete userId={userId} handle={record.handle} />
    </div>
  );
}
