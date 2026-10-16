import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SignInVerifyForm from "@/components/SignInVerifyForm";
import { safeInternalPath } from "@/lib/account-slots";
import { needsSecondStep } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "2-Step Verification — Yavqo" };

export default async function SignInVerifyPage({ searchParams }: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeInternalPath((await searchParams).next);
  const supabase = await createClient();
  const [{ data }, { data: claimsData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getClaims(),
  ]);
  if (!data.user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!needsSecondStep(data.user, claimsData?.claims)) redirect(next);

  const factorId = data.user.factors?.find(
    (factor) => factor.factor_type === "totp" && factor.status === "verified"
  )?.id ?? null;

  return (
    <SignInVerifyForm
      factorId={factorId}
      email={data.user.email ?? ""}
      nextTarget={next}
    />
  );
}
