import { ACTIVE_SLOT_COOKIE, DEFAULT_SLOT, REMEMBERED_ACCOUNTS_KEY, validSlot } from "./account-slots";

export type RememberedAccount = {
  slot: string;
  id: string;
  name: string;
  maskedEmail: string;
  avatarUrl: string | null;
};

export function currentSlot(): string {
  if (typeof document === "undefined") return DEFAULT_SLOT;
  const value = document.cookie.split("; ").find((part) => part.startsWith(`${ACTIVE_SLOT_COOKIE}=`))?.split("=")[1];
  return validSlot(value);
}

export function rememberedAccounts(): RememberedAccount[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(REMEMBERED_ACCOUNTS_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is RememberedAccount =>
      typeof entry === "object" && entry !== null &&
      typeof entry.slot === "string" && validSlot(entry.slot) === entry.slot &&
      typeof entry.id === "string" && typeof entry.name === "string" &&
      typeof entry.maskedEmail === "string" &&
      (entry.avatarUrl === null || typeof entry.avatarUrl === "string")
    );
  } catch {
    return [];
  }
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "";
  return `${local.slice(0, 1)}${"*".repeat(Math.min(8, Math.max(3, local.length - 1)))}@${domain}`;
}

export function rememberAccount(account: RememberedAccount) {
  const entries = rememberedAccounts().filter((entry) =>
    entry.slot !== account.slot && entry.id !== account.id
  );
  try {
    localStorage.setItem(REMEMBERED_ACCOUNTS_KEY, JSON.stringify([account, ...entries]));
  } catch {
    // Login still succeeds when the browser disallows local storage.
  }
}

export function forgetCurrentAccount() {
  const slot = currentSlot();
  try {
    localStorage.setItem(REMEMBERED_ACCOUNTS_KEY,
      JSON.stringify(rememberedAccounts().filter((entry) => entry.slot !== slot)));
  } catch {
    // Signing out must not depend on local storage being available.
  }
}
