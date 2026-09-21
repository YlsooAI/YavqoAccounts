export const ACTIVE_SLOT_COOKIE = "yavqo-active-account";
export const DEFAULT_SLOT = "default";
export const REMEMBERED_ACCOUNTS_KEY = "yavqo-remembered-accounts-v1";

export function validSlot(value: string | null | undefined): string {
  return value === DEFAULT_SLOT || (value && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value))
    ? value
    : DEFAULT_SLOT;
}

export function safeInternalPath(value: string | null | undefined): string {
  return value?.startsWith("/") && !value.startsWith("//") && !/[\\\u0000-\u001f]/.test(value)
    ? value
    : "/";
}

export function cookieNameForSlot(url: string, slot: string): string | undefined {
  if (slot === DEFAULT_SLOT) return undefined;
  const projectRef = new URL(url).hostname.split(".")[0];
  return `sb-${projectRef}-auth-token-${slot}`;
}
