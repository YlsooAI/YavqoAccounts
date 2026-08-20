"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, UserMinus } from "lucide-react";
import Avatar from "@/components/Avatar";
import { createClient } from "@/lib/supabase/client";

type Friend = {
  friendship_id: number;
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { dateStyle: "medium" });
}

function displayName(friend: Friend): string {
  if (friend.full_name) return friend.full_name;
  const localPart = friend.email.split("@")[0] ?? "";
  return localPart
    ? localPart.charAt(0).toUpperCase() + localPart.slice(1)
    : friend.email;
}

export default function FriendsManager() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    setMeId(userData.user?.id ?? null);
    const { data, error: loadError } = await supabase
      .from("friend_profiles")
      .select("*")
      .order("created_at");
    if (loadError) {
      setError(loadError.message);
    } else {
      setFriends((data as Friend[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function removeFriend(friend: Friend) {
    if (!meId) return;
    setRemovingId(friend.friendship_id);
    setError(null);
    const supabase = createClient();
    // Friendships may be stored in both directions; remove every row of the pair.
    const { error: deleteError } = await supabase
      .from("tv_friends")
      .delete()
      .or(
        `and(user_id.eq.${meId},friend_id.eq.${friend.user_id}),` +
          `and(user_id.eq.${friend.user_id},friend_id.eq.${meId})`
      );
    if (deleteError) {
      setError(deleteError.message);
    } else {
      setNotice(`${displayName(friend)} was removed from your friends.`);
      await load();
    }
    setRemovingId(null);
  }

  return (
    <div className="mx-auto max-w-[660px] pb-16 pt-6 md:pt-10">
      <h2 className="text-[24px] font-normal">YavqoTV Friends</h2>
      <p className="mt-2 text-[13px] text-[#9aa0a6]">
        People you watch with. Friends can see what you&apos;re watching and
        share recommendations.
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

      <div className="mt-6">
        {loading ? (
          <p className="text-[13px] text-[#9aa0a6]">Loading friends…</p>
        ) : friends.length === 0 ? (
          <div className="rounded-2xl border border-[#3c4043] p-10 text-center">
            <Users size={28} className="mx-auto text-[#8ab4f8]" />
            <p className="mt-4 text-[15px]">No friends yet.</p>
            <p className="mt-1 text-[13px] text-[#9aa0a6]">
              Add friends from the YavqoTV app to see them here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#3c4043] overflow-hidden rounded-2xl border border-[#3c4043] bg-[#292a2d]">
            {friends.map((friend) => (
              <li
                key={friend.friendship_id}
                className="flex items-center gap-4 px-5 py-4"
              >
                <Avatar
                  avatarUrl={friend.avatar_url}
                  initial={(friend.email.charAt(0) || "Y").toUpperCase()}
                  className="h-10 w-10 text-[16px] font-medium"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px]">{displayName(friend)}</p>
                  <p className="truncate text-[12px] text-[#9aa0a6]">
                    {friend.email} · Friends since {formatDate(friend.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFriend(friend)}
                  disabled={removingId === friend.friendship_id}
                  className="flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium text-[#f28b82] transition-colors hover:bg-[#f28b82]/10 disabled:opacity-60"
                >
                  <UserMinus size={16} aria-hidden="true" />
                  {removingId === friend.friendship_id
                    ? "Removing…"
                    : "Remove"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
