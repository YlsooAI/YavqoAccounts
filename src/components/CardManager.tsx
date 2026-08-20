"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Plus, Trash2 } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

export type SavedCard = {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
};

// Dark theme matching the account dashboard.
const ELEMENTS_APPEARANCE = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#8ab4f8",
    colorBackground: "#202124",
    colorText: "#e8eaed",
    colorDanger: "#f28b82",
    borderRadius: "8px",
  },
};

function brandLabel(brand: string): string {
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

export default function CardManager({
  cards,
  publishableKey,
  notice,
}: {
  cards: SavedCard[];
  publishableKey: string | null;
  notice: string | null;
}) {
  const router = useRouter();
  const [cardList, setCardList] = useState(cards);
  useEffect(() => {
    setCardList(cards);
  }, [cards]);

  const [adding, setAdding] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stripePromise = useState(() =>
    publishableKey ? loadStripe(publishableKey) : null
  )[0];

  async function openAddForm() {
    setError(null);
    setSetupError(null);
    setAdding(true);
    const res = await fetch("/api/wallet/create-payment-intent", {
      method: "POST",
    });
    const json = (await res.json()) as { clientSecret?: string; error?: string };
    if (!res.ok || !json.clientSecret) {
      setSetupError(json.error ?? "Could not start card verification.");
      return;
    }
    setClientSecret(json.clientSecret);
  }

  async function removeCard(card: SavedCard) {
    if (removingId !== card.id) {
      setRemovingId(card.id);
      return;
    }
    setError(null);
    const res = await fetch("/api/wallet/remove-card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: card.id }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Could not remove the card.");
      setRemovingId(null);
      return;
    }
    setCardList((prev) => prev.filter((c) => c.id !== card.id));
    setRemovingId(null);
    router.refresh();
  }

  return (
    <>
      {notice && (
        <p className="border-b border-[#3c4043] py-3 text-[13px] text-[#81c995]">
          {notice}
        </p>
      )}
      {error && (
        <p className="border-b border-[#3c4043] py-3 text-[13px] text-[#f28b82]">
          {error}
        </p>
      )}

      {cardList.length === 0 && !adding && (
        <div className="flex items-center gap-4 py-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5">
            <CreditCard size={20} className="text-[#9aa0a6]" aria-hidden="true" />
          </span>
          <p className="text-[13px] text-[#9aa0a6]">
            No saved payment methods yet.
          </p>
        </div>
      )}

      {cardList.length > 0 && (
        <ul className="divide-y divide-[#3c4043]">
          {cardList.map((card) => (
            <li key={card.id} className="flex items-center gap-4 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5">
                <CreditCard size={18} className="text-[#8ab4f8]" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px]">
                  {brandLabel(card.brand)} •••• {card.last4}
                </span>
                <span className="mt-0.5 block text-[12px] text-[#9aa0a6]">
                  Expires {String(card.exp_month).padStart(2, "0")}/
                  {card.exp_year}
                </span>
              </span>
              <button
                type="button"
                onClick={() => removeCard(card)}
                onBlur={() => setRemovingId(null)}
                className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] transition-colors ${
                  removingId === card.id
                    ? "bg-[#f28b82] text-[#202124]"
                    : "border border-[#5f6368] text-[#9aa0a6] hover:bg-white/5"
                }`}
              >
                <Trash2 size={12} aria-hidden="true" />
                {removingId === card.id ? "Confirm" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-[#3c4043] py-4">
        {!adding ? (
          <button
            type="button"
            onClick={openAddForm}
            className="flex h-10 items-center gap-2 rounded-full bg-[#8ab4f8] px-5 text-[13px] font-medium text-[#202124] transition-opacity hover:opacity-90"
          >
            <Plus size={15} aria-hidden="true" />
            Add payment method
          </button>
        ) : setupError ? (
          <div className="rounded-lg bg-[#452b0c] p-4">
            <p className="text-[13px] text-[#fdd663]">{setupError}</p>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="mt-3 text-[12px] text-[#9aa0a6] hover:underline"
            >
              Close
            </button>
          </div>
        ) : !clientSecret || !stripePromise ? (
          <p className="text-[13px] text-[#9aa0a6]">Preparing secure form…</p>
        ) : (
          <Elements
            stripe={stripePromise}
            options={{ clientSecret, appearance: ELEMENTS_APPEARANCE }}
          >
            <VerifyCardForm
              onCancel={() => {
                setAdding(false);
                setClientSecret(null);
              }}
            />
          </Elements>
        )}

        <p className="mt-3 text-[12px] leading-relaxed text-[#9aa0a6]">
          To confirm the card is real, Yavqo charges €1.00 and sends it back
          right away. Card details are handled by Stripe and never touch
          Yavqo servers.
        </p>
      </div>
    </>
  );
}

// Must live inside <Elements> so it can access the payment state.
function VerifyCardForm({ onCancel }: { onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/wallet`,
      },
      // Only redirect for 3-D Secure; otherwise finalize in place.
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Card verification failed.");
      setBusy(false);
      return;
    }
    if (!paymentIntent) {
      // A redirect (3-D Secure) is in progress; the wallet page picks
      // the result up when we come back.
      return;
    }

    const res = await fetch("/api/wallet/finalize-card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payment_intent_id: paymentIntent.id }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Could not finish card verification.");
      setBusy(false);
      return;
    }
    router.refresh();
    onCancel();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-[13px] text-[#f28b82]">{error}</p>}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-[#9aa0a6]">
          €1.00 verification charge — refunded instantly.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-9 rounded-full border border-[#5f6368] px-4 text-[13px] transition-colors hover:bg-white/5 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!stripe || !elements || busy}
            className="h-9 rounded-full bg-[#8ab4f8] px-4 text-[13px] font-medium text-[#202124] transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Verifying…" : "Verify card"}
          </button>
        </div>
      </div>
      <p className="text-right text-[11px] text-[#9aa0a6]">Powered by Stripe</p>
    </form>
  );
}
