import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ACTIVE_SLOT_COOKIE, cookieNameForSlot, validSlot } from "@/lib/account-slots";
import { getSupabaseEnv } from "@/lib/supabase/env";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  let body: { action?: string; slot?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (body.action !== "add" && body.action !== "switch") {
    return NextResponse.json({ error: "Invalid account action." }, { status: 400 });
  }

  const slot = body.action === "add" ? crypto.randomUUID() : validSlot(body.slot);
  if (body.action === "switch" && slot !== body.slot) {
    return NextResponse.json({ error: "Unknown account." }, { status: 400 });
  }

  const response = NextResponse.json({ slot });
  if (body.action === "switch") {
    const { url, key } = getSupabaseEnv();
    const supabase = createServerClient(url, key, {
      cookieOptions: { name: cookieNameForSlot(url, slot) },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return NextResponse.json(
        { error: "This account's session expired. Sign in again to add it." },
        { status: 401 }
      );
    }
  }

  response.cookies.set(ACTIVE_SLOT_COOKIE, slot, {
    path: "/",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
