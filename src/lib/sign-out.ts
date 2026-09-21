import { createBrowserClient } from "@supabase/ssr";
import { DEFAULT_SLOT, cookieNameForSlot, validSlot } from "@/lib/account-slots";
import { currentSlot, rememberedAccounts } from "@/lib/remembered-accounts";
import { getSupabaseEnv } from "@/lib/supabase/env";

function slotsFromAuthCookies(url: string): string[] {
  if (typeof document === "undefined") return [];
  const projectRef = new URL(url).hostname.split(".")[0];
  const prefix = `sb-${projectRef}-auth-token`;
  const slots = new Set<string>();
  for (const part of document.cookie.split("; ")) {
    const name = decodeURIComponent(part.split("=")[0] ?? "");
    if (!name.startsWith(prefix)) continue;
    const rest = name.slice(prefix.length).replace(/\.\d+$/, "");
    if (rest === "") {
      slots.add(DEFAULT_SLOT);
    } else if (rest.startsWith("-")) {
      const slot = rest.slice(1);
      if (validSlot(slot) === slot && slot !== DEFAULT_SLOT) slots.add(slot);
    }
  }
  return [...slots];
}

export function savedSessionSlots(): string[] {
  const { url } = getSupabaseEnv();
  return [...new Set([
    currentSlot(),
    ...rememberedAccounts().map((account) => account.slot),
    ...slotsFromAuthCookies(url),
  ])];
}

export async function signOutSlot(slot: string) {
  const { url, key } = getSupabaseEnv();
  const client = createBrowserClient(url, key, {
    isSingleton: false,
    cookieOptions: { name: cookieNameForSlot(url, validSlot(slot)) },
  });
  // A failed server revoke still clears this browser's session. Keep going
  // so the chooser does not list an account that can no longer stay signed in.
  await client.auth.signOut();
}
