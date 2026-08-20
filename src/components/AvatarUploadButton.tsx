"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

export default function AvatarUploadButton({ userId }: { userId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(timer);
  }, [error]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file
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
    const path = `${userId}/avatar-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(path);
    const avatarUrl = publicUrlData.publicUrl;

    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", userId)
      .select();

    if (updateError) {
      setError(updateError.message);
      setUploading(false);
      return;
    }

    // No profile row yet — create one for this user.
    if (updated.length === 0) {
      const { error: insertError } = await supabase
        .from("profiles")
        .insert({ id: userId, avatar_url: avatarUrl });
      if (insertError) {
        setError(insertError.message);
        setUploading(false);
        return;
      }
    }

    setUploading(false);
    router.refresh();
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
      <button
        type="button"
        aria-label="Upload profile photo"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="absolute -right-1 -bottom-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#292a2d] ring-4 ring-[#202124] transition-colors hover:bg-[#3c4043] disabled:opacity-60"
      >
        <Pencil size={14} aria-hidden="true" />
      </button>
      {(error || uploading) && (
        <span className="absolute top-full right-0 z-10 mt-2 w-52 rounded-lg bg-[#452b0c] p-2 text-left text-[11px] leading-snug text-[#fdd663]">
          {uploading ? "Uploading…" : error}
        </span>
      )}
    </>
  );
}
