import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";
import { ACTIVE_SLOT_COOKIE, cookieNameForSlot, validSlot } from "@/lib/account-slots";

const clients = new Map<string, ReturnType<typeof createBrowserClient>>();

export function createClient() {
  const { url, key } = getSupabaseEnv();
  const slot = typeof document === "undefined"
    ? "default"
    : validSlot(document.cookie.split("; ").find((item) => item.startsWith(`${ACTIVE_SLOT_COOKIE}=`))?.split("=")[1]);
  const cached = clients.get(slot);
  if (cached) return cached;
  const client = createBrowserClient(url, key, {
    isSingleton: false,
    cookieOptions: { name: cookieNameForSlot(url, slot) },
  });
  clients.set(slot, client);
  return client;
}
