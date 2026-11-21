import type { Metadata } from "next";
import AccountShell from "@/components/AccountShell";
import GiftcardRedeemManager, {
  type RedeemedGiftcard,
} from "@/components/GiftcardRedeemManager";
import { getAccountUser } from "@/lib/account";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Redeem Giftcard · Yavqo Account" };

export default async function GiftcardPage() {
  const user = await getAccountUser();
  const supabase = await createClient();

  const [balanceRes, historyRes] = await Promise.all([
    supabase
      .from("giftcard_balances")
      .select("balance_cents, currency, updated_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("giftcard_codes")
      .select("id, code, amount_cents, currency, redeemed_at")
      .eq("redeemed_by", user.id)
      .order("redeemed_at", { ascending: false })
      .limit(50),
  ]);

  const initialError =
    balanceRes.error?.message ?? historyRes.error?.message ?? null;

  return (
    <AccountShell active="giftcard" user={user}>
      <GiftcardRedeemManager
        userId={user.id}
        initialBalanceCents={balanceRes.data?.balance_cents ?? 0}
        initialCurrency={balanceRes.data?.currency ?? "EUR"}
        initialUpdatedAt={balanceRes.data?.updated_at ?? null}
        initialHistory={(historyRes.data ?? []) as RedeemedGiftcard[]}
        initialError={initialError}
      />
    </AccountShell>
  );
}
