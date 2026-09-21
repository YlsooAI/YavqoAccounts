import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ACTIVE_SLOT_COOKIE, cookieNameForSlot, safeInternalPath, validSlot } from "@/lib/account-slots";

const PUBLIC_PATHS = [
  "/login",
  "/accounts",
  "/api/accounts",
  "/auth/callback",
  "/oauth/token",
  "/oauth/userinfo",
  "/api/wallet",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without configured env vars, let requests through so the app can
  // surface a helpful configuration error instead of a redirect loop.
  if (!url || !key) return NextResponse.next();

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookieOptions: {
      name: cookieNameForSlot(url, validSlot(request.cookies.get(ACTIVE_SLOT_COOKIE)?.value)),
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        Object.entries(headers).forEach(([name, value]) =>
          supabaseResponse.headers.set(name, value)
        );
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Validates the JWT (refreshing the token when expired) — never use
  // getSession() here, it does not revalidate the token.
  const { data } = await supabase.auth.getClaims();
  const hasSession = Boolean(data?.claims);

  const isPublicPath = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (!hasSession && !isPublicPath) {
    // Keep OAuth authorize requests (with their query string) so the
    // consent screen can resume after sign-in.
    if (pathname === "/oauth/authorize") {
      const target = new URL("/login", request.url);
      target.searchParams.set(
        "next",
        request.nextUrl.pathname + request.nextUrl.search
      );
      return NextResponse.redirect(target);
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasSession && pathname === "/login") {
    const next = request.nextUrl.searchParams.get("next");
    if (next && safeInternalPath(next) === next) {
      return NextResponse.redirect(new URL(next, request.url));
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
