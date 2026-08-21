import { ChevronRight, Gift, Tv } from "lucide-react";
import Link from "next/link";
import AccountShell from "@/components/AccountShell";
import CardManager, { type SavedCard } from "@/components/CardManager";
import { finalizeCardPayment } from "@/lib/cards";
import { isStripeConfigured } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { getAccountUser } from "@/lib/account";

export const dynamic = "force-dynamic";

type Subscription = {
  stripe_subscription_id: string | null;
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  gift_access_until: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { dateStyle: "medium" });
}

function isFuture(iso: string | null): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  return !Number.isNaN(time) && time > Date.now();
}

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getAccountUser();
  const supabase = await createClient();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select(
      "stripe_subscription_id, stripe_customer_id, status, current_period_end, cancel_at_period_end, gift_access_until"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  // Returning from a 3-D Secure redirect? Finish the verification here.
  const params = await searchParams;
  const returnedIntentId =
    typeof params.payment_intent === "string" ? params.payment_intent : null;
  let cardNotice: string | null = null;
  if (returnedIntentId && isStripeConfigured()) {
    try {
      const result = await finalizeCardPayment(returnedIntentId, user.id);
      cardNotice = result.ok
        ? "Card verified — the €1.00 charge was sent right back."
        : result.error;
    } catch (error) {
      cardNotice =
        error instanceof Error ? error.message : "Card verification failed.";
    }
  }

  const { data: cardsData } = await supabase
    .from("payment_methods")
    .select("id, brand, last4, exp_month, exp_year")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const cards = (cardsData as SavedCard[] | null) ?? [];

  const sub = (subscription as Subscription | null) ?? null;
  const giftActive = isFuture(sub?.gift_access_until ?? null);
  const active = sub?.status === "active";
  const hasAccess = active || giftActive;

  let chip: { label: string; className: string };
  if (active) {
    chip = {
      label: "Active",
      className: "bg-[#81c995]/15 text-[#81c995]",
    };
  } else if (giftActive) {
    chip = {
      label: "Gift access",
      className: "bg-[#c58af9]/15 text-[#c58af9]",
    };
  } else if (sub?.status === "incomplete") {
    chip = {
      label: "Payment incomplete",
      className: "bg-[#fdd663]/15 text-[#fdd663]",
    };
  } else if (sub?.status === "canceled") {
    chip = {
      label: "Canceled",
      className: "bg-white/10 text-[#9aa0a6]",
    };
  } else {
    chip = {
      label: "Not subscribed",
      className: "bg-white/10 text-[#9aa0a6]",
    };
  }

  return (
    <AccountShell active="wallet" user={user}>
      <div className="mx-auto max-w-[660px] pb-16 pt-6 md:pt-10">
        <h2 className="text-[24px] font-normal">
          Yavqo Wallet &amp; Subscriptions
        </h2>
        <p className="mt-2 text-[13px] text-[#9aa0a6]">
          Your subscriptions and how you pay for Yavqo services.
        </p>

        <section className="mt-8 rounded-2xl border border-[#3c4043] px-6">
          <h3 className="border-b border-[#3c4043] py-4 text-[16px]">
            Subscriptions
          </h3>

          <div className="flex flex-wrap items-center gap-4 py-5">
            {sub ? (
              <Link
                href={`/subscription/${sub.stripe_subscription_id ?? user.id}`}
                className="flex min-w-0 flex-1 flex-wrap items-center gap-4 rounded-xl transition-opacity hover:opacity-80"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-[#4f46e5] via-[#8b5cf6] to-[#06b6d4]">
                  <Tv size={22} className="text-white" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px]">Yavqo TV</span>
                  <span className="mt-0.5 block text-[13px] text-[#9aa0a6]">
                    {hasAccess
                      ? sub.cancel_at_period_end && active
                        ? `Cancels on ${formatDate(sub.current_period_end)}`
                        : active
                          ? `Renews on ${formatDate(sub.current_period_end)}`
                          : `Gift access until ${formatDate(sub.gift_access_until)}`
                      : "Movies, series, and originals for the whole family."}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-medium ${chip.className}`}
                >
                  {chip.label}
                </span>
                <ChevronRight
                  size={18}
                  className="shrink-0 text-[#9aa0a6]"
                  aria-hidden="true"
                />
              </Link>
            ) : (
              <>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-[#4f46e5] via-[#8b5cf6] to-[#06b6d4]">
                  <Tv size={22} className="text-white" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px]">Yavqo TV</p>
                  <p className="mt-0.5 text-[13px] text-[#9aa0a6]">
                    Movies, series, and originals for the whole family.
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-medium ${chip.className}`}
                >
                  {chip.label}
                </span>
              </>
            )}
          </div>

          {giftActive && active && (
            <p className="flex items-center gap-2 border-t border-[#3c4043] py-3 text-[13px] text-[#c58af9]">
              <Gift size={16} aria-hidden="true" />
              Gift access until {formatDate(sub?.gift_access_until ?? null)}
            </p>
          )}

          {!hasAccess && (
            <div className="border-t border-[#3c4043] py-4">
              <p className="text-[13px] text-[#9aa0a6]">
                {sub?.status === "incomplete"
                  ? "Finish setting up your payment to start watching."
                  : "Get Yavqo TV to start watching on all your devices."}
              </p>
              <button
                type="button"
                disabled
                title="Checkout is handled by Yavqo Payments and will be enabled soon."
                className="mt-3 rounded-full bg-[#8ab4f8] px-5 py-2 text-[13px] font-medium text-[#202124] opacity-60"
              >
                Subscribe with Yavqo
              </button>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-[#3c4043] px-6">
          <h3 className="border-b border-[#3c4043] py-4 text-[16px]">
            Payment methods
          </h3>
          <CardManager
            cards={cards}
            publishableKey={
              process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null
            }
            notice={cardNotice}
          />
        </section>

        <Link
          href="/invoices"
          className="mt-6 block rounded-2xl border border-[#3c4043] px-6 py-4 text-[14px] transition-colors hover:bg-white/5"
        >
          View payment history and invoices
          <span className="text-[#9aa0a6]"> →</span>
        </Link>
      </div>
    </AccountShell>
  );
}
