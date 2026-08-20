import Stripe from "stripe";

// Server-only helper. STRIPE_SECRET_KEY never appears in client code;
// the browser only ever sees NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.
let stripeClient: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY in .env."
    );
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

// Resolve the user's Stripe customer: reuse the one the subscription
// backend already created if it still exists in this Stripe account,
// look for one we created earlier (metadata user_id), or create a new
// one as the last resort. Stored IDs can go stale (e.g. a customer from
// a test-mode account when the app now runs on live keys), so every
// candidate is verified before use.
export async function resolveCustomerId(
  existingCustomerId: string | null,
  userId: string,
  email: string
): Promise<string> {
  const stripe = getStripe();

  async function customerExists(id: string): Promise<boolean> {
    try {
      const customer = await stripe.customers.retrieve(id);
      return !customer.deleted;
    } catch {
      return false; // unknown to this Stripe account — treat as stale
    }
  }

  if (existingCustomerId && (await customerExists(existingCustomerId))) {
    return existingCustomerId;
  }

  const found = await stripe.customers.search({
    query: `metadata['user_id']:'${userId}'`,
    limit: 1,
  });
  const foundId = found.data[0]?.id;
  if (foundId) return foundId;

  const customer = await stripe.customers.create({
    email: email || undefined,
    metadata: { user_id: userId },
  });
  return customer.id;
}
