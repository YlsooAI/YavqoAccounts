import type { Metadata } from "next";
import AccountShell from "@/components/AccountShell";
import BusinessCenterManager, {
  type InvitationPreview,
} from "@/components/BusinessCenterManager";
import { getAccountUser } from "@/lib/account";
import {
  extractInvitationToken,
  getBusinessCenterAppUrl,
  groupBusinessCenterData,
  type BusinessInvitationRecord,
  type BusinessMapsListingRecord,
  type BusinessMemberRecord,
  type BusinessRecord,
} from "@/lib/business-center";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Business Center · Yavqo Account" };

function firstQueryParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function BusinessCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [user, resolvedSearchParams] = await Promise.all([
    getAccountUser(),
    searchParams,
  ]);
  const rawInvite =
    firstQueryParam(resolvedSearchParams.invite) ||
    firstQueryParam(resolvedSearchParams.token);
  const initialInviteToken = extractInvitationToken(rawInvite);

  const supabase = await createClient();

  const [businessesRes, membersRes, invitationsRes, mapsRes, inviteInfoRes] =
    await Promise.all([
      supabase
        .from("businesscenter_businesses")
        .select("id, owner_id, name, category, website, status, logo_path, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("businesscenter_members")
        .select("business_id, user_id, role, member_name, member_email, added_at")
        .order("added_at", { ascending: false }),
      supabase
        .from("businesscenter_invitations")
        .select("id, business_id, email, token, created_at, expires_at, accepted_by, accepted_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("businesscenter_maps_listings")
        .select("business_id, maps_business_id, maps_category"),
      initialInviteToken
        ? supabase.rpc("businesscenter_invitation_info", {
            p_token: initialInviteToken,
          })
        : Promise.resolve({ data: null, error: null }),
    ]);

  const initialError =
    businessesRes.error?.message ??
    membersRes.error?.message ??
    invitationsRes.error?.message ??
    mapsRes.error?.message ??
    null;

  const grouped = initialError
    ? { owned: [], managed: [], loadedAtMs: 0 }
    : groupBusinessCenterData({
        userId: user.id,
        businesses: (businessesRes.data ?? []) as BusinessRecord[],
        members: (membersRes.data ?? []) as BusinessMemberRecord[],
        invitations: (invitationsRes.data ?? []) as BusinessInvitationRecord[],
        mapsListings: (mapsRes.data ?? []) as BusinessMapsListingRecord[],
        logoUrlForPath: (logoPath) =>
          supabase.storage.from("businesscenter-logos").getPublicUrl(logoPath)
            .data.publicUrl,
      });

  let initialInvitePreview: InvitationPreview | null = null;
  let initialInviteLookupError: string | null = null;

  if (initialInviteToken) {
    if (inviteInfoRes.error) {
      initialInviteLookupError = inviteInfoRes.error.message;
    } else {
      const parsed = inviteInfoRes.data as {
        business_name?: string;
        already_member?: boolean;
      } | null;
      if (parsed?.business_name) {
        initialInvitePreview = {
          token: initialInviteToken,
          businessName: parsed.business_name,
          alreadyMember: Boolean(parsed.already_member),
        };
      } else {
        initialInviteLookupError =
          "This invitation is invalid, already used, or expired.";
      }
    }
  }

  return (
    <AccountShell active="business" user={user}>
      <BusinessCenterManager
        userId={user.id}
        userEmail={user.email}
        businessCenterUrl={getBusinessCenterAppUrl()}
        initialOwned={grouped.owned}
        initialManaged={grouped.managed}
        initialError={initialError}
        initialInviteToken={initialInviteToken}
        initialInvitePreview={initialInvitePreview}
        initialInviteLookupError={initialInviteLookupError}
        initialTimestampMs={grouped.loadedAtMs}
      />
    </AccountShell>
  );
}
