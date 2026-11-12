import { NextRequest, NextResponse } from "next/server";
import {
  ACCOUNT_SELECTED_COOKIE,
  REAUTH_COOKIE,
  signCookieToken,
} from "@/lib/oauth";
import { ACTIVE_SLOT_COOKIE, validSlot } from "@/lib/account-slots";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: claimsData } = await supabase.auth.getClaims();
  const sessionId = claimsData?.claims?.session_id;

  if (!user || typeof sessionId !== "string" || !sessionId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const slot = validSlot(request.cookies.get(ACTIVE_SLOT_COOKIE)?.value);
  const authTime = Math.floor(Date.now() / 1000);
  const reauthToken = signCookieToken(
    { userId: user.id, sessionId, authTime },
    180
  );
  const selectedToken = signCookieToken({ slot }, 180);

  const response = NextResponse.json({ ok: true });
  const secure = request.nextUrl.protocol === "https:";
  response.cookies.set(REAUTH_COOKIE, reauthToken, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: 180,
  });
  response.cookies.set(ACCOUNT_SELECTED_COOKIE, selectedToken, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: 180,
  });
  return response;
}
