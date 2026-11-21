"use client";

import { useState, type FormEvent } from "react";
import { Gift, RotateCw, TicketCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type RedeemedGiftcard = {
  id: string;
  code: string;
  amount_cents: number;
  currency: string;
  redeemed_at: string | null;
};

function formatMoney(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "EUR",
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency || "EUR"}`;
  }
}

function formatDate(value: string | null) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export default function GiftcardRedeemManager({
  userId,
  initialBalanceCents,
  initialCurrency,
  initialUpdatedAt,
  initialHistory,
  initialError,
}: {
  userId: string;
  initialBalanceCents: number;
  initialCurrency: string;
  initialUpdatedAt: string | null;
  initialHistory: RedeemedGiftcard[];
  initialError: string | null;
}) {
  const [balanceCents, setBalanceCents] = useState(initialBalanceCents);
  const [currency, setCurrency] = useState(initialCurrency);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [history, setHistory] = useState(initialHistory);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"redeem" | "refresh" | null>(null);
  const [error, setError] = useState<string | null>(initialError);
  const [message, setMessage] = useState<string | null>(null);

  async function refreshBalance() {
    if (busy) return;
    setBusy("refresh");
    setError(null);
    const supabase = createClient();
    const [balanceRes, historyRes] = await Promise.all([
      supabase
        .from("giftcard_balances")
        .select("balance_cents, currency, updated_at")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("giftcard_codes")
        .select("id, code, amount_cents, currency, redeemed_at")
        .eq("redeemed_by", userId)
        .order("redeemed_at", { ascending: false })
        .limit(50),
    ]);

    if (balanceRes.error || historyRes.error) {
      setError(balanceRes.error?.message ?? historyRes.error?.message ?? "Could not refresh balance.");
    } else {
      setBalanceCents(balanceRes.data?.balance_cents ?? 0);
      setCurrency(balanceRes.data?.currency ?? "EUR");
      setUpdatedAt(balanceRes.data?.updated_at ?? null);
      setHistory((historyRes.data ?? []) as RedeemedGiftcard[]);
      setMessage(null);
    }
    setBusy(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const trimmed = code.trim();
    if (!trimmed) {
      setError("Enter a gift card code.");
      setMessage(null);
      return;
    }

    setBusy("redeem");
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/giftcard/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const payload = (await response.json()) as {
        error?: string;
        id?: string;
        code?: string;
        amount_cents?: number;
        currency?: string;
        balance_cents?: number;
        redeemed_at?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? "Gift card code could not be redeemed.");
        setBusy(null);
        return;
      }

      const redeemedCurrency = payload.currency ?? currency;
      const addedAmount = payload.amount_cents ?? 0;
      if (typeof payload.balance_cents === "number") {
        setBalanceCents(payload.balance_cents);
      }
      setCurrency(redeemedCurrency);
      setUpdatedAt(payload.redeemed_at ?? new Date().toISOString());

      if (payload.id && payload.code) {
        setHistory((current) => [
          {
            id: payload.id as string,
            code: payload.code as string,
            amount_cents: addedAmount,
            currency: redeemedCurrency,
            redeemed_at: payload.redeemed_at ?? new Date().toISOString(),
          },
          ...current.filter((item) => item.id !== payload.id),
        ]);
      }

      setCode("");
      setMessage(`Gift card redeemed — added ${formatMoney(addedAmount, redeemedCurrency)} to your balance.`);
    } catch {
      setError("Network error while redeeming gift card. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="settings-page">
      <div className="settings-heading">
        <div>
          <p className="settings-eyebrow">Billing</p>
          <h1>Redeem Giftcard</h1>
          <p className="settings-intro">
            Redeem a Yavqo gift card code to add credit to your account balance.
          </p>
        </div>
        <Gift size={29} aria-hidden="true" className="settings-heading-icon" />
      </div>

      <section className="giftcard-balance-card" aria-label="Gift card balance">
        <div>
          <p className="giftcard-balance-label">Available balance</p>
          <p className="giftcard-balance-amount">{formatMoney(balanceCents, currency)}</p>
          <p className="giftcard-balance-meta">
            {updatedAt
              ? `Last updated ${formatDate(updatedAt)}`
              : "Redeem a gift card code below to add credit."}
          </p>
        </div>
        <button
          type="button"
          className="settings-text-button"
          onClick={refreshBalance}
          disabled={busy !== null}
        >
          <RotateCw size={16} aria-hidden="true" />
          {busy === "refresh" ? "Refreshing…" : "Refresh"}
        </button>
      </section>

      <form className="settings-form giftcard-form" onSubmit={handleSubmit} noValidate>
        <h2>Redeem a code</h2>
        <div className="settings-field">
          <label htmlFor="giftcard-code">Gift card code</label>
          <input
            id="giftcard-code"
            name="code"
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="e.g. YAVQO-XXXX-XXXX"
            autoComplete="off"
            spellCheck={false}
            disabled={busy === "redeem"}
            aria-invalid={error ? "true" : undefined}
            className="giftcard-code-input"
          />
        </div>

        {error && <p className="settings-error" role="alert">{error}</p>}
        {message && !error && <p className="settings-success" role="status">{message}</p>}

        <div className="settings-actions">
          <button
            type="submit"
            className="settings-primary"
            disabled={busy !== null}
          >
            {busy === "redeem" ? "Redeeming…" : "Redeem code"}
          </button>
        </div>
      </form>

      <section className="giftcard-history" aria-labelledby="giftcard-history-title">
        <h2 id="giftcard-history-title" className="giftcard-section-title">
          Redeemed gift cards
        </h2>

        {history.length > 0 ? (
          <div className="settings-list">
            {history.map((item) => (
              <div key={item.id} className="giftcard-history-row">
                <div className="giftcard-history-info">
                  <span className="giftcard-history-code">{item.code}</span>
                  <span className="giftcard-history-date">
                    Redeemed {formatDate(item.redeemed_at)}
                  </span>
                </div>
                <span className="giftcard-history-amount">
                  +{formatMoney(item.amount_cents, item.currency)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="settings-empty">
            <TicketCheck size={28} aria-hidden="true" />
            <h2>No redeemed gift cards yet</h2>
            <p>Gift cards you redeem will appear here along with the credited amount.</p>
          </div>
        )}
      </section>
    </div>
  );
}
