"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Search, UserPlus, Users } from "lucide-react";
import Avatar from "@/components/Avatar";
import { createClient } from "@/lib/supabase/client";

type SearchResult = {
  user_id: string;
  handle: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

export default function FindPeople() {
  const [meId, setMeId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    async function loadMe() {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      const id = data.user?.id ?? null;
      setMeId(id);
      if (!id) return;
      const { data: rows } = await supabase
        .from("tv_friends")
        .select("user_id, friend_id")
        .or(`user_id.eq.${id},friend_id.eq.${id}`);
      setFriendIds(
        new Set(
          (rows ?? []).map((r) =>
            r.user_id === id ? r.friend_id : r.user_id
          )
        )
      );
    }
    void loadMe();
  }, []);

  const search = useCallback(async (raw: string) => {
    const q = raw.trim().replace(/^@/, "");
    if (q.length < 2 || !meId) return;
    setSearching(true);
    setError(null);
    const supabase = createClient();
    const { data, error: searchError } = await supabase
      .from("id_accounts")
      .select("user_id, handle, display_name, bio, avatar_url")
      .neq("user_id", meId)
      .or(`handle.ilike.%${q}%,display_name.ilike.%${q}%`)
      .order("handle")
      .limit(20);
    setSearching(false);
    setSearched(true);
    if (searchError) {
      setError(searchError.message);
      return;
    }
    setResults((data as SearchResult[]) ?? []);
  }, [meId]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void search(query);
  }

  async function addFriend(target: SearchResult) {
    if (!meId) return;
    setAddingId(target.user_id);
    setError(null);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("tv_friends").insert({
      user_id: meId,
      friend_id: target.user_id,
    });
    setAddingId(null);
    if (insertError) {
      if (insertError.code === "23505") {
        setFriendIds((prev) => new Set(prev).add(target.user_id));
        setNotice(`You and @${target.handle} are already friends.`);
      } else {
        setError(insertError.message);
      }
      return;
    }
    setFriendIds((prev) => new Set(prev).add(target.user_id));
    setNotice(`@${target.handle} is now your friend.`);
  }

  return (
    <div className="mx-auto max-w-[660px] pb-16 pt-6 md:pt-10">
      <h2 className="text-[24px] font-normal">Find people</h2>
      <p className="mt-2 text-[13px] text-[#9aa0a6]">
        Search YavqoID handles and names, then add friends across Yavqo
        products.
      </p>

      <form onSubmit={onSubmit} className="mt-6">
        <div className="flex h-12 items-center gap-3 rounded-full bg-[#292a2d] px-5">
          <Search size={18} className="shrink-0 text-[#9aa0a6]" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="@handle or name"
            className="w-full bg-transparent text-[14px] outline-none placeholder:text-[#9aa0a6]"
          />
          <button
            type="submit"
            disabled={searching || query.trim().length < 2}
            className="shrink-0 rounded-full bg-[#8b5cf6] px-4 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {searching ? "Searching…" : "Search"}
          </button>
        </div>
      </form>

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
        {!searched ? (
          <p className="text-[13px] text-[#9aa0a6]">
            Type at least 2 characters to search.
          </p>
        ) : results.length === 0 ? (
          <div className="rounded-2xl border border-[#3c4043] p-10 text-center">
            <Users size={28} className="mx-auto text-[#8b5cf6]" aria-hidden="true" />
            <p className="mt-4 text-[15px]">No YavqoIDs match.</p>
            <p className="mt-1 text-[13px] text-[#9aa0a6]">
              Try a different handle or name.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#3c4043] overflow-hidden rounded-2xl border border-[#3c4043] bg-[#292a2d]">
            {results.map((result) => {
              const isFriend = friendIds.has(result.user_id);
              return (
                <li key={result.user_id} className="flex items-center gap-4 px-5 py-4">
                  <Avatar
                    avatarUrl={result.avatar_url}
                    initial={(result.display_name ?? result.handle).charAt(0).toUpperCase() || "Y"}
                    className="h-10 w-10 text-[16px] font-medium"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px]">
                      {result.display_name ?? result.handle}
                    </p>
                    <p className="truncate text-[12px] text-[#9aa0a6]">
                      @{result.handle}
                      {result.bio ? ` · ${result.bio}` : ""}
                    </p>
                  </div>
                  {isFriend ? (
                    <span className="shrink-0 rounded-full bg-[#81c995]/10 px-3 py-1.5 text-[12px] font-medium text-[#81c995]">
                      Friends
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addFriend(result)}
                      disabled={addingId === result.user_id}
                      className="flex shrink-0 items-center gap-2 rounded-full bg-[#8b5cf6] px-4 py-2 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      <UserPlus size={14} aria-hidden="true" />
                      {addingId === result.user_id ? "Adding…" : "Add friend"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
