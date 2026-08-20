import { isStripeConfigured } from "@/lib/stripe";
import { finalizeCardPayment } from "@/lib/cards";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Confirms a successful €1 verification charge: re-checks the
// PaymentIntent server-side, refunds the €1, and stores the card.
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

  let body: { payment_intent_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Malformed request body." }, { status: 400 });
  }
  const paymentIntentId = body.payment_intent_id;
  if (typeof paymentIntentId !== "string" || !paymentIntentId) {
    return Response.json(
      { error: "payment_intent_id is required." },
      { status: 400 }
    );
  }

  try {
    const result = await finalizeCardPayment(paymentIntentId, user.id);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }
    return Response.json({
      saved: true,
      refunded: true,
      alreadySaved: result.alreadySaved,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not verify the card.";
    return Response.json({ error: message }, { status: 500 });
  }
}
