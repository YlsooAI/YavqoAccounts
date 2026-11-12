export type BusinessRecord = {
  id: string;
  owner_id: string;
  name: string;
  category: string;
  website: string;
  status: string;
  logo_path: string | null;
  created_at: string;
};

export type BusinessMemberRecord = {
  business_id: string;
  user_id: string;
  role: string;
  member_name: string;
  member_email: string;
  added_at: string;
};

export type BusinessInvitationRecord = {
  id: string;
  business_id: string;
  email: string;
  token: string;
  created_at: string;
  expires_at: string;
  accepted_by: string | null;
  accepted_at: string | null;
};

export type BusinessMapsListingRecord = {
  business_id: string;
  maps_business_id: string;
  maps_category: string;
};

export type BusinessCenterBusiness = BusinessRecord & {
  logoUrl: string | null;
  mapsListing: BusinessMapsListingRecord | null;
  myMembership: BusinessMemberRecord | null;
  members: BusinessMemberRecord[];
  invitations: BusinessInvitationRecord[];
};

export const DEFAULT_BUSINESS_CENTER_URL = "https://yavqobusinesses.vercel.app";
export const BUSINESS_CENTER_TEAM_LIMIT = 10;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Resolve a safe http(s) URL for external Business Center or website links.
 * Returns null for missing or non-http(s) values to prevent unsafe schemes.
 */
export function normalizeExternalHttpUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;

  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function getBusinessCenterAppUrl(): string {
  return (
    normalizeExternalHttpUrl(process.env.NEXT_PUBLIC_BUSINESS_CENTER_URL) ??
    DEFAULT_BUSINESS_CENTER_URL
  );
}

/**
 * Accept either a raw invitation token or a pasted URL containing `?token=` or `?invite=`.
 */
export function extractInvitationToken(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  if (trimmed.includes("://") || trimmed.startsWith("/")) {
    try {
      const parsed = new URL(trimmed, "https://accounts.yavqo.com");
      const queryToken =
        parsed.searchParams.get("invite") ?? parsed.searchParams.get("token");
      if (queryToken?.trim()) return queryToken.trim();
    } catch {
      // Fall through to raw token handling below.
    }
  }

  return trimmed;
}

export function isValidInviteEmail(email: string): boolean {
  const trimmed = email.trim();
  return trimmed.length > 0 && trimmed.length <= 254 && EMAIL_PATTERN.test(trimmed);
}

export function isPendingInvitation(
  invitation: Pick<BusinessInvitationRecord, "accepted_at" | "expires_at">,
  nowMs: number = Date.now()
): boolean {
  if (invitation.accepted_at) return false;
  const expiresMs = Date.parse(invitation.expires_at);
  return Number.isFinite(expiresMs) && expiresMs > nowMs;
}

export function groupBusinessCenterData({
  userId,
  businesses,
  members,
  invitations,
  mapsListings,
  logoUrlForPath,
}: {
  userId: string;
  businesses: BusinessRecord[];
  members: BusinessMemberRecord[];
  invitations: BusinessInvitationRecord[];
  mapsListings: BusinessMapsListingRecord[];
  logoUrlForPath: (logoPath: string) => string | null;
}): {
  owned: BusinessCenterBusiness[];
  managed: BusinessCenterBusiness[];
  loadedAtMs: number;
} {
  const myMembershipsByBusiness = new Map<string, BusinessMemberRecord>();
  const membersByBusiness = new Map<string, BusinessMemberRecord[]>();

  for (const member of members) {
    if (member.user_id === userId) {
      myMembershipsByBusiness.set(member.business_id, member);
    }
    const bucket = membersByBusiness.get(member.business_id) ?? [];
    bucket.push(member);
    membersByBusiness.set(member.business_id, bucket);
  }

  const invitationsByBusiness = new Map<string, BusinessInvitationRecord[]>();
  for (const invitation of invitations) {
    const bucket = invitationsByBusiness.get(invitation.business_id) ?? [];
    bucket.push(invitation);
    invitationsByBusiness.set(invitation.business_id, bucket);
  }

  const mapsByBusiness = new Map<string, BusinessMapsListingRecord>();
  for (const listing of mapsListings) {
    mapsByBusiness.set(listing.business_id, listing);
  }

  const owned: BusinessCenterBusiness[] = [];
  const managed: BusinessCenterBusiness[] = [];

  for (const business of businesses) {
    const isOwner = business.owner_id === userId;
    const myMembership = myMembershipsByBusiness.get(business.id) ?? null;

    // Admins have a broad SELECT RLS policy on businesscenter_businesses; keep
    // this account view strictly scoped to businesses this user owns or manages.
    if (!isOwner && !myMembership) {
      continue;
    }

    const enriched: BusinessCenterBusiness = {
      ...business,
      logoUrl: business.logo_path ? logoUrlForPath(business.logo_path) : null,
      mapsListing: mapsByBusiness.get(business.id) ?? null,
      myMembership,
      members: membersByBusiness.get(business.id) ?? [],
      invitations: invitationsByBusiness.get(business.id) ?? [],
    };

    if (isOwner) {
      owned.push(enriched);
    } else {
      managed.push(enriched);
    }
  }

  return { owned, managed, loadedAtMs: Date.now() };
}
