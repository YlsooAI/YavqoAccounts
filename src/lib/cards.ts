import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export type FinalizeResult =
  | { ok: true; alreadySaved: boolean }
  | { ok: false; error: string };

// Called after the €1 verification charge succeeds (either directly or
// after a 3-D Secure redirect). Verifies the PaymentIntent server-side,
// refunds the €1 immediately, and stores the card's display details.
export async function finalizeCardPayment(
  paymentIntentId: string,
  userId: string
): Promise<FinalizeResult> {
  const stripe = getStripe();

  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (intent.metadata?.user_id !== userId) {
    return { ok: false, error: "This verification belongs to another account." };
  }
  if (intent.status !== "succeeded") {
    return {
      ok: false,
      error: `Card verification did not complete (status: ${intent.status}).`,
    };
  }

  const pmId =
    typeof intent.payment_method === "string"
      ? intent.payment_method
      : (intent.payment_method?.id ?? null);
  if (!pmId) {
    return { ok: false, error: "No payment method found on this charge." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("payment_methods")
    .select("id")
    .eq("user_id", userId)
    .eq("stripe_payment_method_id", pmId)
    .maybeSingle();
  if (existing) return { ok: true, alreadySaved: true };

  const pm = await stripe.paymentMethods.retrieve(pmId);
  if (pm.type !== "card" || !pm.card) {
    return { ok: false, error: "Only cards can be saved as payment methods." };
  }

  // Send the €1 verification charge straight back.
  await stripe.refunds.create({ payment_intent: intent.id });

  const customerId =
    typeof intent.customer === "string"
      ? intent.customer
      : (intent.customer?.id ?? "");

  const { error } = await supabase.from("payment_methods").insert({
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_payment_method_id: pmId,
    brand: pm.card.brand,
    last4: pm.card.last4,
    exp_month: pm.card.exp_month,
    exp_year: pm.card.exp_year,
  });
  if (error) {
    if (error.code === "23505") return { ok: true, alreadySaved: true };
    return { ok: false, error: error.message };
  }
  return { ok: true, alreadySaved: false };
}
