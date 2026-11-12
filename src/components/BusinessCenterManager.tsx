"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import {
  Building2,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  MapPin,
  Plus,
  RotateCw,
  UserPlus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  BUSINESS_CENTER_TEAM_LIMIT,
  extractInvitationToken,
  groupBusinessCenterData,
  isPendingInvitation,
  isValidInviteEmail,
  normalizeExternalHttpUrl,
  type BusinessCenterBusiness,
  type BusinessInvitationRecord,
  type BusinessMapsListingRecord,
  type BusinessMemberRecord,
  type BusinessRecord,
} from "@/lib/business-center";

export type InvitationPreview = {
  token: string;
  businessName: string;
  alreadyMember: boolean;
};

type ConfirmAction =
  | {
      kind: "remove-member";
      businessId: string;
      businessName: string;
      memberUserId: string;
      memberLabel: string;
    }
  | {
      kind: "revoke-invitation";
      businessId: string;
      businessName: string;
      invitationId: string;
      email: string;
    }
  | {
      kind: "leave-business";
      businessId: string;
      businessName: string;
    };

function formatShortDate(value: string | null | undefined): string {
  if (!value) return "Date unavailable";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Date unavailable"
    : parsed.toLocaleDateString("en-US", { dateStyle: "medium" });
}

function websiteLabel(urlString: string): string {
  try {
    return new URL(urlString).hostname.replace(/^www\./, "");
  } catch {
    return urlString;
  }
}

export default function BusinessCenterManager({
  userId,
  userEmail,
  businessCenterUrl,
  initialOwned,
  initialManaged,
  initialError,
  initialInviteToken,
  initialInvitePreview,
  initialInviteLookupError,
  initialTimestampMs,
}: {
  userId: string;
  userEmail: string;
  businessCenterUrl: string;
  initialOwned: BusinessCenterBusiness[];
  initialManaged: BusinessCenterBusiness[];
  initialError: string | null;
  initialInviteToken: string;
  initialInvitePreview: InvitationPreview | null;
  initialInviteLookupError: string | null;
  initialTimestampMs: number;
}) {
  const joinHeadingId = useId();
  const joinInputId = useId();
  const joinErrorId = useId();
  const inviteHeadingId = useId();
  const inviteEmailInputId = useId();
  const inviteEmailErrorId = useId();
  const confirmTitleId = useId();

  const confirmDialogRef = useRef<HTMLDialogElement>(null);
  const joinInputRef = useRef<HTMLInputElement>(null);
  const inviteEmailInputRef = useRef<HTMLInputElement>(null);

  const [owned, setOwned] = useState<BusinessCenterBusiness[]>(initialOwned);
  const [managed, setManaged] = useState<BusinessCenterBusiness[]>(initialManaged);
  const [nowMs, setNowMs] = useState<number>(initialTimestampMs);
  const [loadError, setLoadError] = useState<string | null>(initialError);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [brokenLogos, setBrokenLogos] = useState<Record<string, true>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Join by invitation token state
  const [joinOpen, setJoinOpen] = useState<boolean>(Boolean(initialInviteToken));
  const [inviteInput, setInviteInput] = useState<string>(initialInviteToken);
  const [inviteInputTouched, setInviteInputTouched] = useState<boolean>(false);
  const [inviteFormError, setInviteFormError] = useState<string | null>(
    initialInviteLookupError
  );
  const [invitePreview, setInvitePreview] = useState<InvitationPreview | null>(
    initialInvitePreview
  );

  // Owner team invite state
  const [invitingBusinessId, setInvitingBusinessId] = useState<string | null>(null);
  const [managerEmail, setManagerEmail] = useState<string>("");
  const [managerEmailTouched, setManagerEmailTouched] = useState<boolean>(false);
  const [managerEmailError, setManagerEmailError] = useState<string | null>(null);

  // Confirmation modal state
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  async function reload(keepNotice = false) {
    setBusy("reload");
    setError(null);
    if (!keepNotice) setMessage(null);

    const supabase = createClient();
    const [businessesRes, membersRes, invitationsRes, mapsRes] = await Promise.all([
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
    ]);

    const firstError =
      businessesRes.error ?? membersRes.error ?? invitationsRes.error ?? mapsRes.error;
    if (firstError) {
      setLoadError(firstError.message);
      setBusy(null);
      return;
    }

    const grouped = groupBusinessCenterData({
      userId,
      businesses: (businessesRes.data ?? []) as BusinessRecord[],
      members: (membersRes.data ?? []) as BusinessMemberRecord[],
      invitations: (invitationsRes.data ?? []) as BusinessInvitationRecord[],
      mapsListings: (mapsRes.data ?? []) as BusinessMapsListingRecord[],
      logoUrlForPath: (logoPath) =>
        supabase.storage.from("businesscenter-logos").getPublicUrl(logoPath).data
          .publicUrl,
    });

    setOwned(grouped.owned);
    setManaged(grouped.managed);
    setNowMs(grouped.loadedAtMs);
    setLoadError(null);
    setBusy(null);
  }

  function validateInviteTokenField(rawValue: string): string | null {
    const token = extractInvitationToken(rawValue);
    if (!token) return "Enter an invitation token or link.";
    return null;
  }

  async function handleLookupInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setInviteInputTouched(true);
    const validationError = validateInviteTokenField(inviteInput);
    if (validationError) {
      setInviteFormError(validationError);
      setInvitePreview(null);
      joinInputRef.current?.focus();
      return;
    }

    const token = extractInvitationToken(inviteInput);
    setBusy("lookup");
    setInviteFormError(null);
    setError(null);

    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc(
      "businesscenter_invitation_info",
      { p_token: token }
    );

    setBusy(null);
    if (rpcError) {
      setInvitePreview(null);
      setInviteFormError(rpcError.message);
      joinInputRef.current?.focus();
      return;
    }

    const parsed = data as { business_name?: string; already_member?: boolean } | null;
    if (!parsed || !parsed.business_name) {
      setInvitePreview(null);
      setInviteFormError("This invitation is invalid, already used, or expired.");
      joinInputRef.current?.focus();
      return;
    }

    setInvitePreview({
      token,
      businessName: parsed.business_name,
      alreadyMember: Boolean(parsed.already_member),
    });
  }

  async function handleAcceptInvitation() {
    if (!invitePreview || invitePreview.alreadyMember || busy) return;

    setBusy("accept");
    setInviteFormError(null);
    setError(null);

    const supabase = createClient();
    const { error: acceptError } = await supabase.rpc(
      "businesscenter_accept_invitation",
      { p_token: invitePreview.token }
    );

    if (acceptError) {
      setInviteFormError(acceptError.message);
      setBusy(null);
      return;
    }

    const joinedName = invitePreview.businessName;
    setInvitePreview(null);
    setInviteInput("");
    setInviteInputTouched(false);
    setJoinOpen(false);
    setMessage(`Joined ${joinedName} as a manager.`);

    if (typeof window !== "undefined") {
      const current = new URL(window.location.href);
      if (current.searchParams.has("invite") || current.searchParams.has("token")) {
        current.searchParams.delete("invite");
        current.searchParams.delete("token");
        window.history.replaceState({}, "", current.pathname + current.search);
      }
    }

    await reload(true);
  }

  function validateManagerEmail(emailValue: string, biz: BusinessCenterBusiness): string | null {
    const trimmed = emailValue.trim();
    if (!trimmed) return "Enter the email address of the person you want to invite.";
    if (!isValidInviteEmail(trimmed)) return "Enter a valid email address.";
    const normalized = trimmed.toLowerCase();
    if (normalized === userEmail.trim().toLowerCase()) {
      return "You already own this business.";
    }
    if (biz.members.some((m) => m.member_email.trim().toLowerCase() === normalized)) {
      return "That person is already a manager for this business.";
    }
    if (
      biz.invitations.some(
        (inv) =>
          isPendingInvitation(inv, nowMs) &&
          inv.email.trim().toLowerCase() === normalized
      )
    ) {
      return "An active invitation has already been sent to that email address.";
    }
    const pendingCount = biz.invitations.filter((inv) =>
      isPendingInvitation(inv, nowMs)
    ).length;
    if (biz.members.length + pendingCount >= BUSINESS_CENTER_TEAM_LIMIT) {
      return `This business has reached the ${BUSINESS_CENTER_TEAM_LIMIT}-person team limit.`;
    }
    return null;
  }

  function openInviteForm(businessId: string) {
    setInvitingBusinessId(businessId);
    setManagerEmail("");
    setManagerEmailTouched(false);
    setManagerEmailError(null);
    setError(null);
    setMessage(null);
  }

  function closeInviteForm() {
    setInvitingBusinessId(null);
    setManagerEmail("");
    setManagerEmailTouched(false);
    setManagerEmailError(null);
  }

  async function handleCreateInvitation(
    event: FormEvent<HTMLFormElement>,
    biz: BusinessCenterBusiness
  ) {
    event.preventDefault();
    if (busy) return;

    setManagerEmailTouched(true);
    const validationError = validateManagerEmail(managerEmail, biz);
    if (validationError) {
      setManagerEmailError(validationError);
      inviteEmailInputRef.current?.focus();
      return;
    }

    const normalizedEmail = managerEmail.trim().toLowerCase();
    setBusy(`invite:${biz.id}`);
    setManagerEmailError(null);
    setError(null);

    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("businesscenter_invitations")
      .insert({
        business_id: biz.id,
        email: normalizedEmail,
      })
      .select("id, business_id, email, token, created_at, expires_at, accepted_by, accepted_at")
      .single();

    setBusy(null);
    if (insertError || !data) {
      setManagerEmailError(
        insertError?.message ?? "Could not create the invitation. Try again."
      );
      inviteEmailInputRef.current?.focus();
      return;
    }

    const createdInvite = data as BusinessInvitationRecord;
    setOwned((current) =>
      current.map((item) =>
        item.id === biz.id
          ? { ...item, invitations: [createdInvite, ...item.invitations] }
          : item
      )
    );
    const createdMs = Date.parse(createdInvite.created_at);
    if (Number.isFinite(createdMs)) setNowMs(createdMs);
    closeInviteForm();
    setMessage(
      `Invitation created for ${createdInvite.email}. Copy the invite link or token below to share it.`
    );
  }

  async function copyInvite(inv: BusinessInvitationRecord, mode: "link" | "token") {
    const value =
      mode === "link" && typeof window !== "undefined"
        ? `${window.location.origin}/business?invite=${encodeURIComponent(inv.token)}`
        : inv.token;

    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(`${mode}:${inv.id}`);
      setMessage(
        mode === "link"
          ? `Copied invite link for ${inv.email}.`
          : `Copied invite token for ${inv.email}.`
      );
    } catch {
      setError("Could not copy to clipboard. You can try again or select it manually.");
    }
  }

  function openConfirm(action: ConfirmAction) {
    setConfirmAction(action);
    setConfirmError(null);
    confirmDialogRef.current?.showModal();
  }

  async function handleConfirmAction() {
    if (!confirmAction || busy) return;
    setBusy("confirm");
    setConfirmError(null);
    setError(null);

    const supabase = createClient();
    if (confirmAction.kind === "remove-member") {
      const { error: deleteError } = await supabase
        .from("businesscenter_members")
        .delete()
        .eq("business_id", confirmAction.businessId)
        .eq("user_id", confirmAction.memberUserId);

      if (deleteError) {
        setConfirmError(deleteError.message);
        setBusy(null);
        return;
      }

      setOwned((current) =>
        current.map((item) =>
          item.id === confirmAction.businessId
            ? {
                ...item,
                members: item.members.filter(
                  (m) => m.user_id !== confirmAction.memberUserId
                ),
              }
            : item
        )
      );
      setMessage(
        `Removed ${confirmAction.memberLabel} from ${confirmAction.businessName}.`
      );
    } else if (confirmAction.kind === "revoke-invitation") {
      const { error: deleteError } = await supabase
        .from("businesscenter_invitations")
        .delete()
        .eq("id", confirmAction.invitationId)
        .eq("business_id", confirmAction.businessId);

      if (deleteError) {
        setConfirmError(deleteError.message);
        setBusy(null);
        return;
      }

      setOwned((current) =>
        current.map((item) =>
          item.id === confirmAction.businessId
            ? {
                ...item,
                invitations: item.invitations.filter(
                  (inv) => inv.id !== confirmAction.invitationId
                ),
              }
            : item
        )
      );
      setMessage(`Revoked invitation for ${confirmAction.email}.`);
    } else if (confirmAction.kind === "leave-business") {
      const { error: leaveError } = await supabase
        .from("businesscenter_members")
        .delete()
        .eq("business_id", confirmAction.businessId)
        .eq("user_id", userId);

      if (leaveError) {
        setConfirmError(leaveError.message);
        setBusy(null);
        return;
      }

      setManaged((current) =>
        current.filter((item) => item.id !== confirmAction.businessId)
      );
      setMessage(`Left ${confirmAction.businessName}.`);
    }

    setBusy(null);
    confirmDialogRef.current?.close();
  }

  function renderBusinessAvatar(biz: BusinessCenterBusiness) {
    if (biz.logoUrl && !brokenLogos[biz.id]) {
      return (
        <img
          src={biz.logoUrl}
          alt=""
          className="business-logo"
          onError={() =>
            setBrokenLogos((current) => ({ ...current, [biz.id]: true }))
          }
        />
      );
    }
    return (
      <span className="business-logo-fallback" aria-hidden="true">
        {biz.name.trim().charAt(0).toUpperCase() || <Building2 size={20} />}
      </span>
    );
  }

  const hasBusinesses = owned.length > 0 || managed.length > 0;

  return (
    <div className="settings-page business-page">
      <div className="settings-heading">
        <div>
          <p className="settings-eyebrow">Business Center</p>
          <h1>Businesses &amp; memberships</h1>
          <p className="settings-intro">
            View the businesses you own or manage, join teams with an invitation, and control account access.
          </p>
        </div>
        <Building2 size={29} aria-hidden="true" className="settings-heading-icon" />
      </div>

      <div className="settings-toolbar">
        <div className="settings-toolbar-actions">
          <a
            href={businessCenterUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="business-outline-link"
          >
            Open Business Center <ExternalLink size={15} aria-hidden="true" />
          </a>
          <button
            type="button"
            className="settings-primary"
            aria-expanded={joinOpen}
            onClick={() => {
              setJoinOpen((open) => !open);
              setInviteFormError(null);
            }}
          >
            <UserPlus size={16} aria-hidden="true" />
            {joinOpen ? "Hide invite form" : "Join with invite"}
          </button>
        </div>
        <button
          type="button"
          className="settings-text-button"
          onClick={() => void reload(false)}
          disabled={busy !== null}
        >
          <RotateCw size={16} aria-hidden="true" /> Refresh
        </button>
      </div>

      {loadError && (
        <div className="settings-error" role="alert">
          Couldn’t load your businesses: {loadError}{" "}
          <button
            type="button"
            onClick={() => void reload(false)}
            disabled={busy !== null}
          >
            Try again
          </button>
        </div>
      )}

      {message && !error && (
        <p className="settings-success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="settings-error" role="alert">
          {error}
        </p>
      )}
      {busy === "reload" && (
        <p className="settings-helper" role="status">
          Refreshing business memberships…
        </p>
      )}

      {joinOpen && (
        <section className="business-section" aria-labelledby={joinHeadingId}>
          <form
            noValidate
            aria-labelledby={joinHeadingId}
            onSubmit={handleLookupInvitation}
            className="business-form-card settings-form"
          >
            <h2 id={joinHeadingId}>Join a business with an invitation</h2>
            <p className="settings-helper" style={{ marginTop: 0 }}>
              Paste the invitation token or link sent by a business owner to join as a manager.
            </p>
            <div className="settings-field">
              <label htmlFor={joinInputId}>Invitation token or link</label>
              <input
                ref={joinInputRef}
                id={joinInputId}
                name="invite_token"
                type="text"
                required
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="go"
                value={inviteInput}
                onChange={(event) => {
                  const next = event.target.value;
                  setInviteInput(next);
                  setInvitePreview(null);
                  if (inviteFormError && !validateInviteTokenField(next)) {
                    setInviteFormError(null);
                  }
                }}
                onBlur={() => {
                  if (inviteInput.trim() || inviteInputTouched) {
                    setInviteInputTouched(true);
                    setInviteFormError(validateInviteTokenField(inviteInput));
                  }
                }}
                aria-invalid={Boolean(inviteFormError)}
                aria-describedby={inviteFormError ? joinErrorId : undefined}
              />
            </div>

            {inviteFormError && (
              <p id={joinErrorId} className="settings-error" role="alert" style={{ margin: 0 }}>
                {inviteFormError}
              </p>
            )}

            {invitePreview && (
              <div className="business-preview-card" role="status">
                <div className="business-preview-copy">
                  <strong>{invitePreview.businessName}</strong>
                  <span>
                    {invitePreview.alreadyMember
                      ? "Your Yavqo Account already has access to this business."
                      : "You will be added as a Manager in Business Center."}
                  </span>
                </div>
                {!invitePreview.alreadyMember && (
                  <button
                    type="button"
                    className="settings-primary"
                    disabled={busy !== null}
                    onClick={() => void handleAcceptInvitation()}
                  >
                    {busy === "accept" ? "Joining…" : "Join as manager"}
                  </button>
                )}
              </div>
            )}

            <div className="settings-actions" style={{ marginTop: 4 }}>
              <button
                type="button"
                className="settings-secondary"
                disabled={busy !== null}
                onClick={() => {
                  setJoinOpen(false);
                  setInviteFormError(null);
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="settings-primary"
                disabled={busy !== null}
              >
                {busy === "lookup" ? "Checking…" : "Check invitation"}
              </button>
            </div>
          </form>
        </section>
      )}

      {!loadError && !hasBusinesses && (
        <div className="business-section">
          <div className="settings-empty">
            <Building2 size={27} aria-hidden="true" />
            <h2>No businesses linked yet</h2>
            <p>
              Businesses you own or manage in Yavqo Business Center will appear here. Create a business in Business Center or accept an invitation above.
            </p>
          </div>
        </div>
      )}

      {!loadError && owned.length > 0 && (
        <section className="business-section" aria-labelledby="owned-businesses-title">
          <div className="business-section-header">
            <h2 id="owned-businesses-title">Businesses you own</h2>
            <span>
              {owned.length} {owned.length === 1 ? "business" : "businesses"}
            </span>
          </div>
          <div className="business-card-list">
            {owned.map((biz) => {
              const safeWebsite = normalizeExternalHttpUrl(biz.website);
              const pendingInvites = biz.invitations.filter((inv) =>
                isPendingInvitation(inv, nowMs)
              );
              const teamUsed = biz.members.length + pendingInvites.length;
              const isInvitingThis = invitingBusinessId === biz.id;

              return (
                <article key={biz.id} className="business-card">
                  <div className="business-card-header">
                    {renderBusinessAvatar(biz)}
                    <div className="business-card-copy">
                      <div className="business-title-row">
                        <h3>{biz.name}</h3>
                        <span className="business-badge business-badge-owner">Owner</span>
                        <span
                          className={`business-badge ${
                            biz.status === "verified"
                              ? "business-badge-verified"
                              : "business-badge-pending"
                          }`}
                        >
                          {biz.status === "verified" ? "Verified" : "Pending verification"}
                        </span>
                        {biz.mapsListing && (
                          <span className="business-badge business-badge-maps">
                            <MapPin size={12} aria-hidden="true" />
                            Listed on Yavqo Maps
                          </span>
                        )}
                      </div>
                      <p className="business-meta">
                        {[
                          biz.category?.trim() || null,
                          safeWebsite ? (
                            <a
                              key="site"
                              href={safeWebsite}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {websiteLabel(safeWebsite)}
                            </a>
                          ) : null,
                          `Created ${formatShortDate(biz.created_at)}`,
                        ]
                          .filter(Boolean)
                          .map((part, index) => (
                            <span key={index}>
                              {index > 0 ? " · " : ""}
                              {part}
                            </span>
                          ))}
                      </p>
                    </div>
                  </div>

                  <div className="business-subpanel">
                    <div className="business-subpanel-header">
                      <h4>Team access &amp; invitations</h4>
                      <span className="business-subpanel-meta">
                        {teamUsed} of {BUSINESS_CENTER_TEAM_LIMIT} manager slots used
                      </span>
                    </div>

                    {biz.members.length > 0 ? (
                      <ul className="business-member-list">
                        {biz.members.map((member) => {
                          const label =
                            member.member_name?.trim() ||
                            member.member_email?.trim() ||
                            "Manager";
                          return (
                            <li key={member.user_id} className="business-member-row">
                              <div className="business-member-info">
                                <strong>{label}</strong>
                                <span>
                                  {member.member_email ? `${member.member_email} · ` : ""}
                                  Manager · Added {formatShortDate(member.added_at)}
                                </span>
                              </div>
                              <div className="business-row-actions">
                                <button
                                  type="button"
                                  className="settings-danger-link"
                                  disabled={busy !== null}
                                  onClick={() =>
                                    openConfirm({
                                      kind: "remove-member",
                                      businessId: biz.id,
                                      businessName: biz.name,
                                      memberUserId: member.user_id,
                                      memberLabel: label,
                                    })
                                  }
                                >
                                  Remove
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="settings-helper" style={{ marginTop: 0 }}>
                        No managers added yet.
                      </p>
                    )}

                    {pendingInvites.length > 0 && (
                      <div style={{ marginTop: 14 }}>
                        <p
                          className="business-subpanel-meta"
                          style={{ marginBottom: 8, fontWeight: 600 }}
                        >
                          Pending invitations
                        </p>
                        <ul className="business-member-list">
                          {pendingInvites.map((inv) => (
                            <li key={inv.id} className="business-member-row">
                              <div className="business-member-info">
                                <strong>{inv.email}</strong>
                                <span>
                                  Invited {formatShortDate(inv.created_at)} · Expires{" "}
                                  {formatShortDate(inv.expires_at)}
                                </span>
                              </div>
                              <div className="business-row-actions">
                                <button
                                  type="button"
                                  disabled={busy !== null}
                                  onClick={() => void copyInvite(inv, "link")}
                                >
                                  {copiedId === `link:${inv.id}` ? (
                                    <>
                                      <Check size={14} aria-hidden="true" style={{ display: "inline", marginRight: 4 }} />
                                      Copied link
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={13} aria-hidden="true" style={{ display: "inline", marginRight: 4 }} />
                                      Copy link
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  disabled={busy !== null}
                                  onClick={() => void copyInvite(inv, "token")}
                                >
                                  {copiedId === `token:${inv.id}` ? "Copied token" : "Copy token"}
                                </button>
                                <button
                                  type="button"
                                  className="settings-danger-link"
                                  disabled={busy !== null}
                                  onClick={() =>
                                    openConfirm({
                                      kind: "revoke-invitation",
                                      businessId: biz.id,
                                      businessName: biz.name,
                                      invitationId: inv.id,
                                      email: inv.email,
                                    })
                                  }
                                >
                                  Revoke
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {isInvitingThis ? (
                      <form
                        noValidate
                        aria-labelledby={inviteHeadingId}
                        onSubmit={(event) => void handleCreateInvitation(event, biz)}
                        className="business-invite-box settings-form"
                      >
                        <h4 id={inviteHeadingId} style={{ fontSize: 15, fontWeight: 600 }}>
                          Invite a manager to {biz.name}
                        </h4>
                        <div className="settings-field">
                          <label htmlFor={inviteEmailInputId}>Email address</label>
                          <input
                            ref={inviteEmailInputRef}
                            id={inviteEmailInputId}
                            name="email"
                            type="email"
                            required
                            autoComplete="email"
                            autoCorrect="off"
                            autoCapitalize="none"
                            spellCheck={false}
                            enterKeyHint="send"
                            value={managerEmail}
                            onChange={(event) => {
                              const next = event.target.value;
                              setManagerEmail(next);
                              if (
                                managerEmailError &&
                                !validateManagerEmail(next, biz)
                              ) {
                                setManagerEmailError(null);
                              }
                            }}
                            onBlur={() => {
                              if (managerEmail.trim() || managerEmailTouched) {
                                setManagerEmailTouched(true);
                                setManagerEmailError(
                                  validateManagerEmail(managerEmail, biz)
                                );
                              }
                            }}
                            aria-invalid={Boolean(managerEmailError)}
                            aria-describedby={
                              managerEmailError ? inviteEmailErrorId : undefined
                            }
                          />
                        </div>
                        {managerEmailError && (
                          <p
                            id={inviteEmailErrorId}
                            className="settings-error"
                            role="alert"
                            style={{ margin: 0 }}
                          >
                            {managerEmailError}
                          </p>
                        )}
                        <div className="settings-actions" style={{ marginTop: 0 }}>
                          <button
                            type="button"
                            className="settings-secondary"
                            disabled={busy !== null}
                            onClick={closeInviteForm}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="settings-primary"
                            disabled={busy !== null}
                          >
                            {busy === `invite:${biz.id}`
                              ? "Creating invite…"
                              : "Create invitation"}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="business-inline-actions">
                        {teamUsed < BUSINESS_CENTER_TEAM_LIMIT && (
                          <button
                            type="button"
                            className="settings-secondary"
                            disabled={busy !== null}
                            onClick={() => openInviteForm(biz.id)}
                          >
                            <Plus size={15} aria-hidden="true" /> Invite manager
                          </button>
                        )}
                        <a
                          href={businessCenterUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="settings-text-button"
                        >
                          Manage business profile &amp; hours{" "}
                          <ExternalLink size={14} aria-hidden="true" />
                        </a>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {!loadError && managed.length > 0 && (
        <section className="business-section" aria-labelledby="managed-businesses-title">
          <div className="business-section-header">
            <h2 id="managed-businesses-title">Businesses you manage</h2>
            <span>
              {managed.length} {managed.length === 1 ? "business" : "businesses"}
            </span>
          </div>
          <div className="business-card-list">
            {managed.map((biz) => {
              const safeWebsite = normalizeExternalHttpUrl(biz.website);
              return (
                <article key={biz.id} className="business-card">
                  <div className="business-card-header">
                    {renderBusinessAvatar(biz)}
                    <div className="business-card-copy">
                      <div className="business-title-row">
                        <h3>{biz.name}</h3>
                        <span className="business-badge business-badge-manager">
                          Manager
                        </span>
                        <span
                          className={`business-badge ${
                            biz.status === "verified"
                              ? "business-badge-verified"
                              : "business-badge-pending"
                          }`}
                        >
                          {biz.status === "verified" ? (
                            <>
                              <CheckCircle2 size={12} aria-hidden="true" />
                              Verified
                            </>
                          ) : (
                            "Pending verification"
                          )}
                        </span>
                        {biz.mapsListing && (
                          <span className="business-badge business-badge-maps">
                            <MapPin size={12} aria-hidden="true" />
                            Listed on Yavqo Maps
                          </span>
                        )}
                      </div>
                      <p className="business-meta">
                        {[
                          biz.category?.trim() || null,
                          safeWebsite ? (
                            <a
                              key="site"
                              href={safeWebsite}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {websiteLabel(safeWebsite)}
                            </a>
                          ) : null,
                          biz.myMembership?.added_at
                            ? `Joined ${formatShortDate(biz.myMembership.added_at)}`
                            : null,
                        ]
                          .filter(Boolean)
                          .map((part, index) => (
                            <span key={index}>
                              {index > 0 ? " · " : ""}
                              {part}
                            </span>
                          ))}
                      </p>
                    </div>
                  </div>
                  <div className="business-card-actions business-row-actions">
                    <a
                      href={businessCenterUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="settings-text-button"
                    >
                      Open in Business Center{" "}
                      <ExternalLink size={14} aria-hidden="true" />
                    </a>
                    <button
                      type="button"
                      className="settings-danger-link"
                      disabled={busy !== null}
                      onClick={() =>
                        openConfirm({
                          kind: "leave-business",
                          businessId: biz.id,
                          businessName: biz.name,
                        })
                      }
                    >
                      Leave business
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <p className="settings-helper">
        Deleting your Yavqo Account permanently removes businesses you own and ends any Business Center manager memberships. Transfer or retire businesses you don’t want removed before deleting your account.
      </p>

      <dialog
        ref={confirmDialogRef}
        className="settings-dialog"
        aria-labelledby={confirmTitleId}
        onClose={() => {
          setConfirmAction(null);
          setConfirmError(null);
        }}
        onCancel={(event) => {
          if (busy === "confirm") event.preventDefault();
        }}
      >
        {confirmAction?.kind === "remove-member" && (
          <>
            <h2 id={confirmTitleId}>
              Remove {confirmAction.memberLabel}?
            </h2>
            <p>
              They will immediately lose manager access to{" "}
              <strong>{confirmAction.businessName}</strong> in Yavqo Business Center. You can invite them again later.
            </p>
          </>
        )}
        {confirmAction?.kind === "revoke-invitation" && (
          <>
            <h2 id={confirmTitleId}>
              Revoke invitation for {confirmAction.email}?
            </h2>
            <p>
              The invitation link and token for{" "}
              <strong>{confirmAction.businessName}</strong> will stop working immediately.
            </p>
          </>
        )}
        {confirmAction?.kind === "leave-business" && (
          <>
            <h2 id={confirmTitleId}>
              Leave {confirmAction.businessName}?
            </h2>
            <p>
              You will lose manager access to{" "}
              <strong>{confirmAction.businessName}</strong> in Yavqo Business Center. An owner will need to invite you again if you want to return.
            </p>
          </>
        )}
        {confirmError && (
          <p className="settings-error" role="alert">
            {confirmError}
          </p>
        )}
        <div className="settings-actions">
          <button
            type="button"
            className="settings-secondary"
            autoFocus
            disabled={busy === "confirm"}
            onClick={() => confirmDialogRef.current?.close()}
          >
            Cancel
          </button>
          <button
            type="button"
            className="settings-danger-button"
            disabled={busy === "confirm"}
            onClick={() => void handleConfirmAction()}
          >
            {busy === "confirm"
              ? "Saving…"
              : confirmAction?.kind === "remove-member"
                ? "Remove manager"
                : confirmAction?.kind === "revoke-invitation"
                  ? "Revoke invitation"
                  : "Leave business"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
