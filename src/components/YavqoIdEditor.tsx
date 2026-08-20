"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Check, ImagePlus, UserRound } from "lucide-react";
import Avatar from "@/components/Avatar";
import { createClient } from "@/lib/supabase/client";
import type { IdAccount } from "@/lib/yavqoid";
import type { AccountUser } from "@/lib/account";

const HANDLE_RE = /^[a-z0-9._-]{3,30}$/;
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

export default function YavqoIdEditor({
  record,
  user,
}: {
  record: IdAccount;
  user: AccountUser;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [handle, setHandle] = useState(record.handle);
  const [displayName, setDisplayName] = useState(record.display_name ?? "");
  const [bio, setBio] = useState(record.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(record.avatar_url);
  const [pictureChoice, setPictureChoice] = useState<
    "none" | "account" | "upload" | "keep"
  >(record.avatar_url ? "keep" : "none");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function onHandleChange(value: string) {
    setHandle(
      value.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 30)
    );
    setSaved(false);
  }

  async function onUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("Image must be smaller than 2 MB.");
      return;
    }
    setUploading(true);
    setError(null);
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${user.id}/yavqoid-${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (uploadErr) {
      setError(uploadErr.message);
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(path);
    setAvatarUrl(urlData.publicUrl);
    setPictureChoice("upload");
    setUploading(false);
  }

  async function save() {
    setError(null);
    setSaved(false);
    if (!HANDLE_RE.test(handle)) {
      setError(
        "Handles are 3–30 characters: letters, numbers, dots, dashes, underscores."
      );
      return;
    }
    if (!displayName.trim()) {
      setError("Please enter a display name.");
      return;
    }
    setSaving(true);
    const supabase = createClient();

    if (handle !== record.handle) {
      const { data: taken } = await supabase
        .from("id_accounts")
        .select("id")
        .ilike("handle", handle)
        .neq("user_id", user.id)
        .maybeSingle();
      if (taken) {
        setError(`@${handle} is already taken.`);
        setSaving(false);
        return;
      }
    }

    const { error: updateError } = await supabase
      .from("id_accounts")
      .update({
        handle,
        display_name: displayName.trim(),
        bio: bio.trim() ? bio.trim() : null,
        avatar_url: avatarUrl,
      })
      .eq("user_id", user.id);
    setSaving(false);
    if (updateError) {
      setError(
        updateError.code === "23505"
          ? `@${handle} is already taken.`
          : updateError.message
      );
      return;
    }
    setSaved(true);
  }

  return (
    <div className="mx-auto max-w-[560px] pb-16 pt-6 md:pt-10">
      <h2 className="text-[24px] font-normal">Edit your YavqoID</h2>
      <p className="mt-2 text-[13px] text-[#9aa0a6]">
        Changes are visible to other Yavqo users right away.
      </p>

      <div className="mt-6 rounded-2xl border border-[#3c4043] bg-[#292a2d] p-6">
        <div className="flex justify-center">
          <span
            key={avatarUrl ?? "none"}
            className="animate-[pop-in_0.3s_ease_both] rounded-full"
          >
            <Avatar
              avatarUrl={avatarUrl}
              initial={(displayName || handle).charAt(0).toUpperCase() || "Y"}
              className="h-24 w-24 text-[36px] font-normal"
            />
          </span>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            disabled={!user.avatarUrl}
            onClick={() => {
              setAvatarUrl(user.avatarUrl);
              setPictureChoice("account");
            }}
            className={`flex h-10 items-center gap-3 rounded-full border px-5 text-[13px] transition-colors disabled:opacity-50 ${
              pictureChoice === "account"
                ? "border-[#8b5cf6] bg-[#8b5cf6]/10"
                : "border-[#5f6368] hover:bg-white/5"
            }`}
          >
            <UserRound size={15} className="text-[#8b5cf6]" aria-hidden="true" />
            Use my Yavqo Account photo
            {pictureChoice === "account" && (
              <Check size={14} className="ml-auto text-[#8b5cf6]" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className={`flex h-10 items-center gap-3 rounded-full border px-5 text-[13px] transition-colors disabled:opacity-50 ${
              pictureChoice === "upload"
                ? "border-[#8b5cf6] bg-[#8b5cf6]/10"
                : "border-[#5f6368] hover:bg-white/5"
            }`}
          >
            <ImagePlus size={15} className="text-[#8b5cf6]" aria-hidden="true" />
            {uploading ? "Uploading…" : "Upload a different photo"}
            {pictureChoice === "upload" && (
              <Check size={14} className="ml-auto text-[#8b5cf6]" aria-hidden="true" />
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onUpload}
          />
          <button
            type="button"
            onClick={() => {
              setAvatarUrl(null);
              setPictureChoice("none");
            }}
            className={`flex h-10 items-center gap-3 rounded-full border px-5 text-[13px] transition-colors ${
              pictureChoice === "none"
                ? "border-[#8b5cf6] bg-[#8b5cf6]/10"
                : "border-[#5f6368] hover:bg-white/5"
            }`}
          >
            No photo
            {pictureChoice === "none" && (
              <Check size={14} className="ml-auto text-[#8b5cf6]" aria-hidden="true" />
            )}
          </button>
        </div>

        <label className="mt-6 block text-left text-[12px] text-[#9aa0a6]">
          Handle
          <div className="mt-1 flex h-11 items-center rounded-full border border-[#5f6368] bg-[#202124] px-5 focus-within:border-[#8b5cf6]">
            <span className="mr-1 text-[14px] text-[#8b5cf6]">@</span>
            <input
              value={handle}
              onChange={(e) => onHandleChange(e.target.value)}
              className="w-full bg-transparent text-[14px] text-[#e8eaed] outline-none"
            />
          </div>
          {handle !== record.handle && (
            <span className="mt-1 block text-[11px] text-[#fdd663]">
              Changing your handle releases @{record.handle} — old links to it
              will stop working.
            </span>
          )}
        </label>

        <label className="mt-4 block text-left text-[12px] text-[#9aa0a6]">
          Display name
          <input
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              setSaved(false);
            }}
            className="mt-1 h-11 w-full rounded-full border border-[#5f6368] bg-[#202124] px-5 text-[14px] text-[#e8eaed] outline-none focus:border-[#8b5cf6]"
          />
        </label>

        <label className="mt-4 block text-left text-[12px] text-[#9aa0a6]">
          About you <span className="text-[#5f6368]">(optional)</span>
          <textarea
            value={bio}
            onChange={(e) => {
              setBio(e.target.value.slice(0, 160));
              setSaved(false);
            }}
            rows={3}
            className="mt-1 w-full resize-none rounded-2xl border border-[#5f6368] bg-[#202124] p-4 text-[14px] text-[#e8eaed] outline-none focus:border-[#8b5cf6]"
          />
          <span className="mt-1 block text-right text-[11px] text-[#5f6368]">
            {bio.length}/160
          </span>
        </label>

        {error && (
          <p className="mt-3 rounded-lg bg-[#452b0c] px-4 py-3 text-left text-[13px] text-[#fdd663]">
            {error}
          </p>
        )}
        {saved && !error && (
          <p className="mt-3 rounded-lg bg-[#81c995]/10 px-4 py-3 text-left text-[13px] text-[#81c995]">
            Saved. Your YavqoID is up to date.
          </p>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="h-10 rounded-full bg-[#8b5cf6] px-6 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
