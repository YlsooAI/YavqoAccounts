import { checkRateLimit, clientIpFromRequest } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RedeemRpcResult = {
  ok: boolean;
  error?: string;
  id?: string;
  code?: string;
  amount_cents?: number;
  currency?: string;
  balance_cents?: number;
  redeemed_at?: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const ip = clientIpFromRequest(request);
  const limit = checkRateLimit(`giftcard-redeem:${user.id}:${ip}`, 10, 60_000);
  if (!limit.allowed) {
    return Response.json(
      { error: "Too many redemption attempts. Please wait a minute and try again." },
      { status: 429 }
    );
  }

  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Malformed request body." }, { status: 400 });
  }

  const rawCode = typeof body.code === "string" ? body.code.trim() : "";
  if (!rawCode) {
    return Response.json({ error: "Enter a gift card code." }, { status: 400 });
  }
  if (rawCode.length > 64) {
    return Response.json({ error: "Gift card code is too long." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("redeem_giftcard_code", {
    p_code: rawCode,
  });

  if (error) {
    return Response.json(
      { error: error.message || "Could not redeem gift card code." },
      { status: 500 }
    );
  }

  const result = (data ?? null) as RedeemRpcResult | null;
  if (!result || !result.ok) {
    return Response.json(
      { error: result?.error ?? "Gift card code could not be redeemed." },
      { status: 400 }
    );
  }

  return Response.json({
    id: result.id,
    code: result.code,
    amount_cents: result.amount_cents,
    currency: result.currency ?? "EUR",
    balance_cents: result.balance_cents,
    redeemed_at: result.redeemed_at,
  });
}
