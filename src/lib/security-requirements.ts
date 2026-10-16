// Shared definitions for the security checkup and the features it protects.
// Safe to import from client and server components.

export type SecurityRequirement = "email" | "two-step" | "recent-verification";

export type ProtectedFeature =
  | "payment-methods"
  | "saved-passwords"
  | "developer-credentials";

// How long an authenticator-code or passkey verification unlocks features
// that require a recent verification.
export const RECENT_VERIFICATION_MINUTES = 15;

export type SecurityStatus = {
  emailConfirmed: boolean;
  twoStepEnabled: boolean;
  totpFactorId: string | null;
  passkeysAvailable: boolean;
  passkeyCount: number;
  recoveryPhone: boolean;
  // Epoch milliseconds of the latest authenticator-code or passkey check in
  // this session, from the verified access token.
  verifiedAt: number | null;
};

export const REQUIREMENTS: Record<
  SecurityRequirement,
  { label: string; description: string }
> = {
  email: {
    label: "Confirm your email address",
    description: "Use the link we sent so we know the address belongs to you.",
  },
  "two-step": {
    label: "Turn on 2-Step Verification",
    description: "Sign in with your password plus a code from an authenticator app.",
  },
  "recent-verification": {
    label: "Verify it's you",
    description: `Enter a code from your authenticator app. It unlocks this page for ${RECENT_VERIFICATION_MINUTES} minutes.`,
  },
};

export const PROTECTED_FEATURES: Record<
  ProtectedFeature,
  { title: string; href: string; requires: SecurityRequirement[] }
> = {
  "payment-methods": {
    title: "Payment methods",
    href: "/wallet",
    requires: ["email", "two-step", "recent-verification"],
  },
  "saved-passwords": {
    title: "Saved passwords",
    href: "/password",
    requires: ["two-step", "recent-verification"],
  },
  "developer-credentials": {
    title: "Developer credentials",
    href: "/developers/oauth",
    requires: ["email", "two-step"],
  },
};

export function isRecentlyVerified(status: SecurityStatus, now = Date.now()): boolean {
  return (
    status.verifiedAt !== null &&
    now - status.verifiedAt < RECENT_VERIFICATION_MINUTES * 60 * 1000
  );
}

export function isRequirementMet(
  status: SecurityStatus,
  requirement: SecurityRequirement,
  now = Date.now()
): boolean {
  if (requirement === "email") return status.emailConfirmed;
  if (requirement === "two-step") return status.twoStepEnabled;
  return status.twoStepEnabled && isRecentlyVerified(status, now);
}

export function missingRequirements(
  status: SecurityStatus,
  feature: ProtectedFeature,
  now = Date.now()
): SecurityRequirement[] {
  return PROTECTED_FEATURES[feature].requires.filter(
    (requirement) => !isRequirementMet(status, requirement, now)
  );
}

export type CheckupItem = {
  key: "email" | "two-step" | "passkey" | "recovery-phone";
  label: string;
  done: boolean;
  required: boolean;
  href: string;
};

export function checkupItems(status: SecurityStatus): CheckupItem[] {
  const items: CheckupItem[] = [
    { key: "email", label: "Email address confirmed", done: status.emailConfirmed, required: true, href: "/security#account-status" },
    { key: "two-step", label: "2-Step Verification on", done: status.twoStepEnabled, required: true, href: "/security#two-step" },
    { key: "recovery-phone", label: "Recovery phone added", done: status.recoveryPhone, required: false, href: "/personal/contact" },
  ];
  if (status.passkeysAvailable) {
    items.splice(2, 0, { key: "passkey", label: "Passkey created", done: status.passkeyCount > 0, required: false, href: "/security#passkeys" });
  }
  return items;
}
