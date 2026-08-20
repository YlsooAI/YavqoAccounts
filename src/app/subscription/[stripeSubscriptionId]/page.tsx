import Link from "next/link";
import { ChevronLeft, Gift, Tv } from "lucide-react";
import AccountShell from "@/components/AccountShell";
import CopyId from "@/components/CopyId";
import { createClient } from "@/lib/supabase/server";
import { getAccountUser } from "@/lib/account";

export const dynamic = "force-dynamic";

type Subscription = {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  gift_access_until: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function isFuture(iso: string | null): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  return !Number.isNaN(time) && time > Date.now();
}

function statusChip(sub: Subscription | null) {
  if (sub?.status === "active")
    return { label: "Active", className: "bg-[#81c995]/15 text-[#81c995]" };
  if (isFuture(sub?.gift_access_until ?? null))
    return { label: "Gift access", className: "bg-[#c58af9]/15 text-[#c58af9]" };
  if (sub?.status === "incomplete")
    return {
      label: "Payment incomplete",
      className: "bg-[#fdd663]/15 text-[#fdd663]",
    };
  if (sub?.status === "canceled")
    return { label: "Canceled", className: "bg-white/10 text-[#9aa0a6]" };
  return { label: "Not subscribed", className: "bg-white/10 text-[#9aa0a6]" };
}

function IdRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#3c4043] py-3 last:border-b-0">
      <span className="shrink-0 text-[13px] text-[#9aa0a6]">{label}</span>
      {value ? (
        <span className="flex min-w-0 items-center gap-1">
          <code className="truncate font-mono text-[12px] text-[#e8eaed]">
            {value}
          </code>
          <CopyId value={value} />
        </span>
      ) : (
        <span className="text-[13px] text-[#9aa0a6]">—</span>
      )}
    </div>
  );
}

function ValueRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "amber" | "violet";
}) {
  const toneClass =
    tone === "amber"
      ? "text-[#fdd663]"
      : tone === "violet"
        ? "text-[#c58af9]"
        : "text-[#e8eaed]";
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#3c4043] py-3 last:border-b-0">
      <span className="text-[13px] text-[#9aa0a6]">{label}</span>
      <span className={`text-[13px] ${toneClass}`}>{value}</span>
    </div>
  );
}

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ stripeSubscriptionId: string }>;
}) {
  const { stripeSubscriptionId } = await params;
  const user = await getAccountUser();
  const supabase = await createClient();

  // The URL carries the Yavqo (Stripe) subscription ID; rows without one
  // (e.g. incomplete checkouts) fall back to the user's own row. RLS ensures
  // only the owner's row can ever match.
  let queryError: string | null = null;
  let sub: Subscription | null = null;

  const bySubId = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();
  if (bySubId.error) queryError = bySubId.error.message;
  sub = (bySubId.data as Subscription | null) ?? null;

  if (!sub) {
    const byUser = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (byUser.error) queryError = byUser.error.message;
    sub = (byUser.data as Subscription | null) ?? null;
  }

  const chip = statusChip(sub);

  return (
    <AccountShell active="wallet" user={user}>
      <div className="mx-auto max-w-[660px] pb-16 pt-6 md:pt-10">
        <Link
          href="/wallet"
          className="inline-flex items-center gap-1 text-[13px] text-[#8ab4f8] hover:underline"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Back to Wallet
        </Link>

        {!sub ? (
          <div className="mt-6 rounded-2xl border border-[#3c4043] p-10 text-center">
            <Tv size={28} className="mx-auto text-[#8ab4f8]" />
            <p className="mt-4 text-[15px]">Subscription not found.</p>
            <p className="mt-1 text-[13px] text-[#9aa0a6]">
              {queryError
                ? "The database returned an error:"
                : "This subscription doesn't belong to your Yavqo Account."}
            </p>
            {queryError && (
              <>
                <p className="mt-3 rounded-lg bg-[#452b0c] px-4 py-3 text-left font-mono text-[12px] text-[#fdd663]">
                  {queryError}
                </p>
                <p className="mt-3 text-[12px] text-[#9aa0a6]">
                  If this mentions permissions or RLS, run section 8 of
                  supabase/setup.sql in the Supabase SQL Editor, then reload.
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-[#4f46e5] via-[#8b5cf6] to-[#06b6d4]">
                <Tv size={22} className="text-white" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[24px] font-normal">Yavqo TV</h2>
                <p className="mt-0.5 text-[13px] text-[#9aa0a6]">
                  Managed by your Yavqo Account
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-medium ${chip.className}`}
              >
                {chip.label}
              </span>
            </div>

            <section className="mt-6 rounded-2xl border border-[#3c4043] px-6">
              <h3 className="border-b border-[#3c4043] py-4 text-[16px]">
                Plan details
              </h3>
              <ValueRow
                label="Status"
                value={sub.status ?? "—"}
                tone={
                  sub.status === "incomplete"
                    ? "amber"
                    : isFuture(sub.gift_access_until) && sub.status !== "active"
                      ? "violet"
                      : undefined
                }
              />
              <ValueRow
                label="Current period ends"
                value={formatDateTime(sub.current_period_end)}
              />
              <ValueRow
                label="Cancels at period end"
                value={sub.cancel_at_period_end ? "Yes" : "No"}
                tone={sub.cancel_at_period_end ? "amber" : undefined}
              />
              {isFuture(sub.gift_access_until) && (
                <ValueRow
                  label="Gift access until"
                  value={formatDateTime(sub.gift_access_until)}
                  tone="violet"
                />
              )}
            </section>

            <section className="mt-6 rounded-2xl border border-[#3c4043] px-6">
              <h3 className="border-b border-[#3c4043] py-4 text-[16px]">
                Yavqo identifiers
              </h3>
              <IdRow label="Yavqo customer ID" value={sub.stripe_customer_id} />
              <IdRow
                label="Yavqo subscription ID"
                value={sub.stripe_subscription_id}
              />
              <IdRow label="Yavqo price ID" value={sub.stripe_price_id} />
            </section>

            <section className="mt-6 rounded-2xl border border-[#3c4043] px-6">
              <h3 className="border-b border-[#3c4043] py-4 text-[16px]">
                History
              </h3>
              <ValueRow label="Member since" value={formatDateTime(sub.created_at)} />
              <ValueRow label="Last updated" value={formatDateTime(sub.updated_at)} />
            </section>

            {isFuture(sub.gift_access_until) && (
              <p className="mt-4 flex items-center gap-2 text-[12px] text-[#c58af9]">
                <Gift size={16} aria-hidden="true" />
                This subscription includes gifted Yavqo TV access.
              </p>
            )}
          </>
        )}
      </div>
    </AccountShell>
  );
}
