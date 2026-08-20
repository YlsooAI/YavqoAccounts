import { isStripeConfigured, getStripe, resolveCustomerId } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Starts the €1 card verification charge. The client confirms it with
// Stripe Elements; finalize-card then refunds it and stores the card.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!isStripeConfigured()) {
    return Response.json(
      { error: "Payments are not configured on this server yet." },
      { status: 503 }
    );
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const existingCustomerId =
    (subscription?.stripe_customer_id as string | null | undefined) ?? null;

  try {
    const customerId = await resolveCustomerId(
      existingCustomerId,
      user.id,
      user.email ?? ""
    );

    // The stored customer id was stale (e.g. from another Stripe account);
    // heal the subscription row so future lookups reuse the right one.
    if (existingCustomerId && customerId !== existingCustomerId) {
      await supabase
        .from("subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", user.id);
    }

    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create({
      amount: 100, // €1.00 verification charge, refunded immediately
      currency: "eur",
      customer: customerId,
      setup_future_usage: "off_session", // attaches the card on success
      description: "Card verification — refunded immediately",
      metadata: { user_id: user.id },
    });

    return Response.json({ clientSecret: intent.client_secret });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not start verification.";
    return Response.json({ error: message }, { status: 500 });
  }
}
