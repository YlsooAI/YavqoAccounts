import { isStripeConfigured, getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Removes a saved card: detaches it from the Stripe customer and
// deletes the local row. RLS restricts the lookup to the caller's rows.
export async function POST(request: Request) {
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

  let body: { id?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Malformed request body." }, { status: 400 });
  }
  const id = body.id;
  if (typeof id !== "string" || !id) {
    return Response.json({ error: "id is required." }, { status: 400 });
  }

  const { data: row } = await supabase
    .from("payment_methods")
    .select("id, stripe_payment_method_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) {
    return Response.json({ error: "Payment method not found." }, { status: 404 });
  }

  try {
    const stripe = getStripe();
    try {
      await stripe.paymentMethods.detach(row.stripe_payment_method_id);
    } catch {
      // The card may already be gone in Stripe; still remove our row.
    }
    const { error } = await supabase
      .from("payment_methods")
      .delete()
      .eq("id", row.id)
      .eq("user_id", user.id);
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ removed: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not remove the card.";
    return Response.json({ error: message }, { status: 500 });
  }
}
