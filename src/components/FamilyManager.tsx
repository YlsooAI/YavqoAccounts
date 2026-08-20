"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus, Users, UserMinus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Family = {
  id: string;
  name: string;
  organizer_id: string;
};

type Member = {
  id: string;
  family_id: string;
  user_id: string | null;
  email: string;
  role: string;
  status: string;
};

type Invitation = Member & { familyName: string };

const LETTER_COLORS = [
  "#8ab4f8",
  "#c58af9",
  "#81c995",
  "#fcad70",
  "#ff8bcb",
  "#fdd663",
];

function letterColor(value: string) {
  let sum = 0;
  for (const char of value) sum += char.charCodeAt(0);
  return LETTER_COLORS[sum % LETTER_COLORS.length];
}

const ROLE_LABELS: Record<string, string> = {
  organizer: "Organizer",
  parent: "Parent",
  member: "Member",
  child: "Child",
};

export default function FamilyManager({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [family, setFamily] = useState<Family | null>(null);
  const [myMembership, setMyMembership] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  const [familyName, setFamilyName] = useState("");
  const [creating, setCreating] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    setError(null);

    // Invitations addressed to my email.
    const { data: inviteRows, error: inviteError } = await supabase
      .from("family_members")
      .select("*")
      .eq("email", email)
      .eq("status", "invited");
    if (inviteError) {
      setError(inviteError.message);
      setLoading(false);
      return;
    }

    let resolvedInvitations: Invitation[] = [];
    if (inviteRows && inviteRows.length > 0) {
      const familyIds = [...new Set(inviteRows.map((row) => row.family_id))];
      const { data: familiesForInvites } = await supabase
        .from("families")
        .select("id, name")
        .in("id", familyIds);
      const names = new Map(
        (familiesForInvites ?? []).map((f) => [f.id, f.name as string])
      );
      resolvedInvitations = (inviteRows as Member[]).map((row) => ({
        ...row,
        familyName: names.get(row.family_id) ?? "a family",
      }));
    }
    setInvitations(resolvedInvitations);

    // My active membership.
    const { data: mine, error: mineError } = await supabase
      .from("family_members")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (mineError) {
      setError(mineError.message);
      setLoading(false);
      return;
    }

    if (!mine) {
      setFamily(null);
      setMyMembership(null);
      setMembers([]);
      setLoading(false);
      return;
    }

    const [familyRes, membersRes] = await Promise.all([
      supabase.from("families").select("*").eq("id", mine.family_id).maybeSingle(),
      supabase
        .from("family_members")
        .select("*")
        .eq("family_id", mine.family_id)
        .order("created_at"),
    ]);
    if (familyRes.error || membersRes.error) {
      setError(familyRes.error?.message ?? membersRes.error?.message ?? "");
      setLoading(false);
      return;
    }

    setFamily(familyRes.data as Family | null);
    setMyMembership(mine as Member);
    setMembers((membersRes.data as Member[]) ?? []);
    setLoading(false);
  }, [userId, email]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createFamily(event: FormEvent) {
    event.preventDefault();
    if (creating || family) return;
    setCreating(true);
    setError(null);

    const supabase = createClient();
    const { data: created, error: createError } = await supabase
      .from("families")
      .insert({ name: familyName.trim(), organizer_id: userId })
      .select()
      .single();
    if (createError) {
      setError(createError.message);
      setCreating(false);
      return;
    }
    const { error: memberError } = await supabase.from("family_members").insert({
      family_id: (created as Family).id,
      user_id: userId,
      email,
      role: "organizer",
      status: "active",
      invited_by: userId,
      joined_at: new Date().toISOString(),
    });
    if (memberError) {
      setError(memberError.message);
    } else {
      setFamilyName("");
      setNotice("Family created. Invite the people you want to share with.");
      await load();
    }
    setCreating(false);
  }

  async function sendInvite(event: FormEvent) {
    event.preventDefault();
    if (inviting || !family) return;
    setInviting(true);
    setError(null);
    setNotice(null);

    const target = inviteEmail.trim().toLowerCase();
    if (target === email) {
      setError("You're already in this family.");
      setInviting(false);
      return;
    }

    const supabase = createClient();
    const { error: insertError } = await supabase.from("family_members").insert({
      family_id: family.id,
      email: target,
      role: inviteRole,
      status: "invited",
      invited_by: userId,
    });
    if (insertError) {
      setError(
        insertError.code === "23505"
          ? "That email is already in or invited to this family."
          : insertError.message
      );
    } else {
      setInviteEmail("");
      setNotice(`Invitation sent to ${target}.`);
      await load();
    }
    setInviting(false);
  }

  async function acceptInvite(invite: Invitation) {
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("family_members")
      .update({
        user_id: userId,
        status: "active",
        joined_at: new Date().toISOString(),
      })
      .eq("id", invite.id);
    if (updateError) {
      setError(
        /duplicate key/i.test(updateError.message)
          ? "You're already an active member of another family."
          : updateError.message
      );
    } else {
      setNotice(`You joined ${invite.familyName}.`);
    }
    await load();
  }

  async function declineInvite(invite: Invitation) {
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("family_members")
      .delete()
      .eq("id", invite.id);
    if (deleteError) setError(deleteError.message);
    await load();
  }

  async function changeRole(member: Member, role: string) {
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("family_members")
      .update({ role })
      .eq("id", member.id)
      .eq("family_id", member.family_id);
    if (updateError) setError(updateError.message);
    await load();
  }

  async function removeMember(member: Member) {
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("family_members")
      .delete()
      .eq("id", member.id)
      .eq("family_id", member.family_id);
    if (deleteError) setError(deleteError.message);
    await load();
  }

  async function leaveFamily() {
    if (!family || !myMembership) return;
    setError(null);
    const supabase = createClient();

    const isOrganizer = family.organizer_id === userId;
    const others = members.filter((m) => m.user_id !== userId);
    if (isOrganizer && others.length > 0) {
      setError(
        "As the organizer you can't leave while others are in the family. Remove the other members first, or delete the family."
      );
      return;
    }

    if (isOrganizer) {
      const { error: deleteError } = await supabase
        .from("families")
        .delete()
        .eq("id", family.id);
      if (deleteError) setError(deleteError.message);
      else setNotice("Family deleted.");
    } else {
      const { error: deleteError } = await supabase
        .from("family_members")
        .delete()
        .eq("id", myMembership.id);
      if (deleteError) setError(deleteError.message);
      else setNotice(`You left ${family.name}.`);
    }
    await load();
  }

  const isOrganizer = family?.organizer_id === userId;
  const activeMembers = members.filter((m) => m.status === "active");
  const pendingInvites = members.filter((m) => m.status === "invited");

  if (loading) {
    return (
      <div className="mx-auto max-w-[660px] pt-6 md:pt-10">
        <p className="text-[13px] text-[#9aa0a6]">Loading family…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[660px] pb-16 pt-6 md:pt-10">
      <h2 className="text-[24px] font-normal">Family</h2>
      <p className="mt-2 text-[13px] text-[#9aa0a6]">
        Share Yavqo services like Wallet subscriptions and storage with up to
        5 family members.
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-[#452b0c] px-4 py-3 text-[13px] text-[#fdd663]">
          {error}
        </p>
      )}
      {notice && !error && (
        <p className="mt-4 rounded-lg bg-[#81c995]/10 px-4 py-3 text-[13px] text-[#81c995]">
          {notice}
        </p>
      )}

      {invitations.length > 0 && (
        <section className="mt-6 rounded-2xl border border-[#3c4043] px-6">
          <h3 className="border-b border-[#3c4043] py-4 text-[16px]">
            Invitations for you
          </h3>
          <ul>
            {invitations.map((invite) => (
              <li
                key={invite.id}
                className="flex items-center justify-between gap-4 border-b border-[#3c4043] py-4 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14px]">
                    {invite.familyName}
                  </p>
                  <p className="truncate text-[13px] text-[#9aa0a6]">
                    You&apos;re invited as{" "}
                    {ROLE_LABELS[invite.role] ?? invite.role}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => acceptInvite(invite)}
                    className="rounded-full bg-[#8ab4f8] px-4 py-2 text-[13px] font-medium text-[#202124] transition-opacity hover:opacity-90"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    aria-label="Decline invitation"
                    onClick={() => declineInvite(invite)}
                    className="rounded-full p-2 text-[#9aa0a6] transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!family ? (
        invitations.length === 0 && (
          <section className="mt-6 rounded-2xl border border-[#3c4043] p-6 text-center">
            <Users size={28} className="mx-auto text-[#8ab4f8]" />
            <p className="mt-4 text-[15px]">You&apos;re not in a family yet.</p>
            <p className="mt-1 text-[13px] text-[#9aa0a6]">
              Create one to share Yavqo services with the people you care
              about.
            </p>
            <form
              onSubmit={createFamily}
              className="mx-auto mt-5 flex max-w-sm items-center gap-2"
            >
              <input
                required
                placeholder="Family name (e.g. Doe family)"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                disabled={creating}
                className="h-11 w-full rounded-lg border border-[#3c4043] bg-[#202124] px-4 text-[14px] outline-none placeholder:text-[#9aa0a6] focus:border-[#8ab4f8]"
              />
              <button
                type="submit"
                disabled={creating}
                className="h-11 shrink-0 rounded-full bg-[#8ab4f8] px-5 text-[13px] font-medium text-[#202124] transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {creating ? "Creating…" : "Create"}
              </button>
            </form>
          </section>
        )
      ) : (
        <>
          <section className="mt-6 rounded-2xl border border-[#3c4043] px-6">
            <div className="flex items-center justify-between gap-4 py-4">
              <div className="min-w-0">
                <p className="truncate text-[16px]">{family.name}</p>
                <p className="mt-0.5 text-[13px] text-[#9aa0a6]">
                  {activeMembers.length} member
                  {activeMembers.length === 1 ? "" : "s"}
                  {pendingInvites.length > 0 &&
                    ` · ${pendingInvites.length} pending invitation${
                      pendingInvites.length === 1 ? "" : "s"
                    }`}
                </p>
              </div>
              <button
                type="button"
                onClick={leaveFamily}
                className="flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium text-[#f28b82] transition-colors hover:bg-[#f28b82]/10"
              >
                <UserMinus size={16} aria-hidden="true" />
                {isOrganizer ? "Delete family" : "Leave family"}
              </button>
            </div>

            <ul>
              {activeMembers.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center gap-4 border-t border-[#3c4043] py-3"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[16px] font-medium text-[#1f1f1f]"
                    style={{ backgroundColor: letterColor(member.email) }}
                  >
                    {member.email.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px]">
                      {member.email}
                      {member.user_id === userId && (
                        <span className="ml-2 text-[12px] text-[#9aa0a6]">
                          (you)
                        </span>
                      )}
                    </p>
                  </div>
                  {isOrganizer &&
                  member.user_id !== userId &&
                  member.role !== "organizer" ? (
                    <>
                      <select
                        value={member.role}
                        onChange={(e) => changeRole(member, e.target.value)}
                        aria-label={`Role for ${member.email}`}
                        className="h-9 rounded-lg border border-[#3c4043] bg-[#202124] px-2 text-[13px] text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
                      >
                        <option value="parent">Parent</option>
                        <option value="member">Member</option>
                        <option value="child">Child</option>
                      </select>
                      <button
                        type="button"
                        aria-label={`Remove ${member.email}`}
                        onClick={() => removeMember(member)}
                        className="rounded-full p-2 text-[#9aa0a6] transition-colors hover:bg-white/10 hover:text-[#f28b82]"
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    </>
                  ) : (
                    <span className="rounded-full bg-white/5 px-3 py-1 text-[12px] text-[#9aa0a6]">
                      {ROLE_LABELS[member.role] ?? member.role}
                    </span>
                  )}
                </li>
              ))}

              {pendingInvites.map((invite) => (
                <li
                  key={invite.id}
                  className="flex items-center gap-4 border-t border-[#3c4043] py-3 opacity-70"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-[#5f6368] text-[16px] text-[#9aa0a6]"
                  >
                    {invite.email.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px]">{invite.email}</p>
                    <p className="text-[12px] text-[#9aa0a6]">
                      Invited as {ROLE_LABELS[invite.role] ?? invite.role} —
                      waiting to join
                    </p>
                  </div>
                  {isOrganizer && (
                    <button
                      type="button"
                      aria-label={`Cancel invitation for ${invite.email}`}
                      onClick={() => removeMember(invite)}
                      className="rounded-full p-2 text-[#9aa0a6] transition-colors hover:bg-white/10 hover:text-[#f28b82]"
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {activeMembers.length < 6 && (
            <section className="mt-6 rounded-2xl border border-[#3c4043] px-6 py-4">
              <form onSubmit={sendInvite} className="flex flex-wrap items-center gap-2">
                <input
                  required
                  type="email"
                  placeholder="Invite by email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={inviting}
                  className="h-11 min-w-0 flex-1 rounded-lg border border-[#3c4043] bg-[#202124] px-4 text-[14px] outline-none placeholder:text-[#9aa0a6] focus:border-[#8ab4f8]"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  disabled={inviting}
                  aria-label="Role for the invited person"
                  className="h-11 rounded-lg border border-[#3c4043] bg-[#202124] px-3 text-[13px] text-[#e8eaed] outline-none focus:border-[#8ab4f8]"
                >
                  <option value="parent">Parent</option>
                  <option value="member">Member</option>
                  <option value="child">Child</option>
                </select>
                <button
                  type="submit"
                  disabled={inviting}
                  className="flex h-11 items-center gap-2 rounded-full bg-[#8ab4f8] px-5 text-[13px] font-medium text-[#202124] transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  <Plus size={16} aria-hidden="true" />
                  {inviting ? "Sending…" : "Invite"}
                </button>
              </form>
              <p className="mt-3 text-[12px] text-[#9aa0a6]">
                The person you invite will see the invitation on their Family
                page when they sign in with that email.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
