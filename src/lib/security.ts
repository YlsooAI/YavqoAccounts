import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  missingRequirements,
  REQUIREMENTS,
  type ProtectedFeature,
  type SecurityStatus,
} from "@/lib/security-requirements";

type Claims = { aal?: string; amr?: unknown };

// Latest time (epoch ms) this session proved a second factor or passkey.
export function secondFactorVerifiedAt(claims: Claims | null | undefined): number | null {
  if (!Array.isArray(claims?.amr)) return null;
  let latest: number | null = null;
  for (const entry of claims.amr) {
    if (!entry || typeof entry !== "object") continue;
    const { method, timestamp } = entry as { method?: unknown; timestamp?: unknown };
    if ((method === "totp" || method === "passkey") && typeof timestamp === "number") {
      latest = Math.max(latest ?? 0, timestamp * 1000);
    }
  }
  return latest;
}

// True when the user has a verified second factor but this session has
// only passed the password step (the sign-in still needs a code).
export function needsSecondStep(user: User, claims: Claims | null | undefined): boolean {
  const hasFactor = (user.factors ?? []).some((factor) => factor.status === "verified");
  if (!hasFactor) return false;
  if (claims?.aal === "aal2") return false;
  const amr = Array.isArray(claims?.amr) ? claims.amr : [];
  // A passkey sign-in is already phishing-resistant proof of possession.
  return !amr.some((entry) =>
    entry === "passkey" ||
    (typeof entry === "object" && entry !== null && (entry as { method?: unknown }).method === "passkey")
  );
}

// Reads the user's security posture with server-verified data only: the
// user record comes from getUser() and the claims from getClaims().
export async function getSecurityStatus(supabase: SupabaseClient): Promise<SecurityStatus | null> {
  const [{ data: userData }, { data: claimsData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getClaims(),
  ]);
  const user = userData.user;
  const claims = claimsData?.claims;
  if (!user || !claims || claims.sub !== user.id) return null;

  const totp = (user.factors ?? []).find(
    (factor) => factor.factor_type === "totp" && factor.status === "verified"
  );

  const [passkeys, profile] = await Promise.all([
    supabase.auth.passkey.list(),
    supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle(),
  ]);
  const passkeysAvailable = !passkeys.error || passkeys.error.code !== "passkey_disabled";

  return {
    emailConfirmed: Boolean(user.email_confirmed_at),
    twoStepEnabled: Boolean(totp),
    totpFactorId: totp?.id ?? null,
    passkeysAvailable,
    passkeyCount: passkeys.data?.length ?? 0,
    recoveryPhone:
      typeof profile.data?.phone === "string" && profile.data.phone.trim() !== "",
    verifiedAt: secondFactorVerifiedAt(claims as Claims),
  };
}

// For API routes: returns a 403 response when the feature is locked.
export async function lockedFeatureResponse(
  supabase: SupabaseClient,
  feature: ProtectedFeature
): Promise<Response | null> {
  const status = await getSecurityStatus(supabase);
  if (!status) return Response.json({ error: "Not signed in." }, { status: 401 });
  const missing = missingRequirements(status, feature);
  if (missing.length === 0) return null;
  return Response.json(
    {
      error: `Locked for your security: ${REQUIREMENTS[missing[0]].label.toLowerCase()} first.`,
      missing,
    },
    { status: 403 }
  );
}
