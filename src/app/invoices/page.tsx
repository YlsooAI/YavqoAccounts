import Link from "next/link";
import { ChevronLeft, FileText } from "lucide-react";
import type Stripe from "stripe";
import AccountShell from "@/components/AccountShell";
import { getAccountUser } from "@/lib/account";
import { getStripe, isStripeConfigured, resolveCustomerId } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function formatDate(seconds: number | null): string {
  if (!seconds) return "—";
  return new Date(seconds * 1000).toLocaleDateString("en-US", {
    dateStyle: "medium",
  });
}

function formatAmount(
  amount: number | null,
  currency: string | null
): string {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency ?? "eur").toUpperCase(),
  }).format(amount / 100);
}

function statusChip(status: string | null) {
  switch (status) {
    case "paid":
      return { label: "Paid", className: "bg-[#81c995]/15 text-[#81c995]" };
    case "open":
      return { label: "Open", className: "bg-[#fdd663]/15 text-[#fdd663]" };
    case "void":
      return { label: "Void", className: "bg-white/10 text-[#9aa0a6]" };
    case "uncollectible":
      return { label: "Uncollectible", className: "bg-[#f28b82]/15 text-[#f28b82]" };
    default:
      return { label: "Draft", className: "bg-white/10 text-[#9aa0a6]" };
  }
}

export default async function InvoicesPage() {
  const user = await getAccountUser();
  const supabase = await createClient();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  let customerId = subscription?.stripe_customer_id ?? null;

  let invoices: Stripe.Invoice[] = [];
  let loadError: string | null = null;
  if (isStripeConfigured()) {
    try {
      // Stored customer IDs can go stale (e.g. from another Stripe
      // account); resolveCustomerId verifies and repairs before use.
      const resolved = await resolveCustomerId(customerId, user.id, user.email);
      if (resolved !== customerId) {
        customerId = resolved;
        await supabase
          .from("subscriptions")
          .update({ stripe_customer_id: resolved })
          .eq("user_id", user.id);
      }
      const list = await getStripe().invoices.list({
        customer: customerId,
        limit: 24,
      });
      invoices = list.data;
    } catch (error) {
      loadError = error instanceof Error ? error.message : null;
    }
  }

  return (
    <AccountShell active="invoices" user={user}>
      <div className="mx-auto max-w-[660px] pb-16 pt-6 md:pt-10">
        <Link
          href="/wallet"
          className="inline-flex items-center gap-1 text-[13px] text-[#8ab4f8] hover:underline"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Back to Wallet
        </Link>

        <h2 className="mt-6 text-[24px] font-normal">Invoices</h2>
        <p className="mt-2 text-[13px] text-[#9aa0a6]">
          Payment history for your Yavqo subscriptions.
        </p>

        {loadError && (
          <p className="mt-6 rounded-xl bg-[#452b0c] px-4 py-3 text-[13px] text-[#fdd663]">
            {loadError}
          </p>
        )}

        <section className="mt-8 rounded-2xl border border-[#3c4043] px-6">
          <h3 className="border-b border-[#3c4043] py-4 text-[16px]">
            Payment history
          </h3>

          {invoices.length === 0 ? (
            <div className="py-10 text-center">
              <FileText
                size={28}
                className="mx-auto text-[#8ab4f8]"
                aria-hidden="true"
              />
              <p className="mt-4 text-[15px]">No invoices yet.</p>
              <p className="mt-1 text-[13px] text-[#9aa0a6]">
                {customerId
                  ? "Invoices appear here after your first Yavqo payment."
                  : "Subscribe to a Yavqo service to see invoices here."}
              </p>
            </div>
          ) : (
            invoices.map((invoice) => {
              const chip = statusChip(invoice.status);
              return (
                <div
                  key={invoice.id}
                  className="flex items-center gap-4 border-b border-[#3c4043] py-4 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px]">
                      {invoice.number ?? invoice.id}
                    </p>
                    <p className="mt-0.5 text-[13px] text-[#9aa0a6]">
                      {formatDate(invoice.created)} ·{" "}
                      {formatAmount(invoice.amount_paid || invoice.amount_due, invoice.currency)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-medium ${chip.className}`}
                  >
                    {chip.label}
                  </span>
                  {invoice.hosted_invoice_url && (
                    <a
                      href={invoice.hosted_invoice_url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-[13px] text-[#8ab4f8] hover:underline"
                    >
                      View
                    </a>
                  )}
                </div>
              );
            })
          )}
        </section>
      </div>
    </AccountShell>
  );
}
