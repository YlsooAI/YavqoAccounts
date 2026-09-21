import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";
import { ACTIVE_SLOT_COOKIE, cookieNameForSlot, validSlot } from "@/lib/account-slots";

export async function createClient() {
  const { url, key } = getSupabaseEnv();
  const cookieStore = await cookies();
  const slot = validSlot(cookieStore.get(ACTIVE_SLOT_COOKIE)?.value);

  return createServerClient(url, key, {
    cookieOptions: { name: cookieNameForSlot(url, slot) },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Components cannot write cookies; the proxy refreshes
          // and persists the session on every request instead.
        }
      },
    },
  });
}
