import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { needsSecondStep } from "@/lib/security";

export type AccountUser = {
  id: string;
  email: string;
  displayName: string;
  initial: string;
  avatarUrl: string | null;
  emailConfirmed: boolean;
  lastSignInAt: string | null;
};

// `returnTo` is where the 2-Step Verification sign-in step sends the user
// back to when this session has not entered its code yet.
export async function getAccountUser(returnTo = "/"): Promise<AccountUser> {
  const supabase = await createClient();
  const [{ data }, { data: claimsData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getClaims(),
  ]);
  if (!data.user) redirect("/login");
  if (needsSecondStep(data.user, claimsData?.claims)) {
    redirect(`/login/verify?next=${encodeURIComponent(returnTo)}`);
  }

  const email = data.user.email ?? "";
  const localPart = email.split("@")[0] ?? "";

  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_url, full_name")
    .eq("id", data.user.id)
    .maybeSingle();

  const fullName =
    typeof profile?.full_name === "string" && profile.full_name.trim()
      ? profile.full_name.trim()
      : null;
  const displayName =
    fullName ??
    (localPart
      ? localPart.charAt(0).toUpperCase() + localPart.slice(1)
      : "Yavqo User");
  const initial = (displayName.charAt(0) || "Y").toUpperCase();

  return {
    id: data.user.id,
    email,
    displayName,
    initial,
    avatarUrl: (profile?.avatar_url as string | null) ?? null,
    emailConfirmed: Boolean(data.user.email_confirmed_at),
    lastSignInAt: data.user.last_sign_in_at ?? null,
  };
}
