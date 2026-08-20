"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Fingerprint,
  ImagePlus,
  UserRound,
  Volume2,
  VolumeX,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import { createClient } from "@/lib/supabase/client";
import { sounds, setSoundsMuted } from "@/lib/sounds";
import type { AccountUser } from "@/lib/account";

const HANDLE_RE = /^[a-z0-9._-]{3,30}$/;
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

const steps = ["Handle", "Picture", "Your info"] as const;

export default function YavqoIdSetup({ user }: { user: AccountUser }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [handle, setHandle] = useState("");
  const [handleError, setHandleError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pictureChoice, setPictureChoice] = useState<
    "none" | "account" | "upload"
  >("none");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("yavqoid-sounds");
    const isMuted = stored === "off";
    setMuted(isMuted);
    setSoundsMuted(isMuted);
  }, []);

  function toggleMuted() {
    setMuted((prev) => {
      const next = !prev;
      setSoundsMuted(next);
      localStorage.setItem("yavqoid-sounds", next ? "off" : "on");
      if (!next) sounds.tap();
      return next;
    });
  }

  function onHandleChange(value: string) {
    setHandle(value.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 30));
    setHandleError(null);
  }

  async function continueFromHandle() {
    if (!HANDLE_RE.test(handle)) {
      setHandleError(
        "Handles are 3–30 characters: letters, numbers, dots, dashes, underscores."
      );
      sounds.error();
      return;
    }
    setChecking(true);
    setHandleError(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("id_accounts")
      .select("id")
      .ilike("handle", handle)
      .maybeSingle();
    setChecking(false);
    if (error) {
      setHandleError(error.message);
      sounds.error();
      return;
    }
    if (data) {
      setHandleError(`@${handle} is already taken.`);
      sounds.error();
      return;
    }
    sounds.next();
    setStep(1);
  }

  async function onUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setUploadError("Image must be smaller than 2 MB.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${user.id}/yavqoid-${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (uploadErr) {
      setUploadError(uploadErr.message);
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(urlData.publicUrl);
    setPictureChoice("upload");
    setUploading(false);
  }

  async function createYavqoId() {
    if (!displayName.trim()) {
      setCreateError("Please enter a display name.");
      sounds.error();
      return;
    }
    setCreating(true);
    setCreateError(null);
    const supabase = createClient();
    const { error } = await supabase.from("id_accounts").insert({
      user_id: user.id,
      handle,
      display_name: displayName.trim(),
      bio: bio.trim() ? bio.trim() : null,
      avatar_url: avatarUrl,
    });
    if (error) {
      sounds.error();
      setCreating(false);
      if (error.code === "23505") {
        setHandleError(`@${handle} was just taken — pick another.`);
        setStep(0);
      } else {
        setCreateError(error.message);
      }
      return;
    }
    sounds.success();
    // Let the chime land before the card replaces the wizard;
    // the button stays locked until the refresh.
    setTimeout(() => router.refresh(), 900);
  }

  return (
    <div className="mx-auto max-w-[560px] pb-16 pt-6 md:pt-10">
      <div className="flex items-center gap-3">
        {step > 0 ? (
          <button
            type="button"
            aria-label="Back"
            onClick={() => {
              sounds.back();
              setStep(step - 1);
            }}
            className="rounded-full p-2 text-[#9aa0a6] transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#8b5cf6]">
            <Fingerprint size={18} className="text-[#1f1f1f]" aria-hidden="true" />
          </span>
        )}
        <div className="flex-1">
          <h2 className="text-[20px] font-normal">Set up your YavqoID</h2>
          <p className="text-[12px] text-[#9aa0a6]">
            Step {step + 1} of {steps.length} · {steps[step]}
          </p>
        </div>
        <div className="flex items-center gap-3" aria-hidden="true">
          {steps.map((label, i) => (
            <span
              key={label}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i <= step ? "w-8 bg-[#8b5cf6]" : "w-4 bg-[#3c4043]"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label={muted ? "Turn sounds on" : "Turn sounds off"}
          onClick={toggleMuted}
          className="rounded-full p-2 text-[#9aa0a6] transition-colors hover:bg-white/10 hover:text-white"
        >
          {muted ? (
            <VolumeX size={17} aria-hidden="true" />
          ) : (
            <Volume2 size={17} aria-hidden="true" />
          )}
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-[#3c4043] bg-[#292a2d] p-6">
        {step === 0 && (
          <div className="animate-[step-in_0.35s_ease_both]">
            <h3 className="text-[16px]">Choose your handle</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[#9aa0a6]">
              Your handle is your YavqoID — a unique identifier across all
              Yavqo products. It can only exist once, so make it yours.
            </p>
            <div className="mt-5 flex h-12 items-center rounded-full border border-[#5f6368] bg-[#202124] px-5 focus-within:border-[#8b5cf6]">
              <span className="mr-1 text-[15px] text-[#8b5cf6]">@</span>
              <input
                value={handle}
                onChange={(e) => onHandleChange(e.target.value)}
                placeholder="yourname"
                autoFocus
                className="w-full bg-transparent text-[14px] outline-none placeholder:text-[#9aa0a6]"
              />
              {handle && (
                <span className="shrink-0 text-[11px] text-[#9aa0a6]">
                  {handle.length}/30
                </span>
              )}
            </div>
            {handleError && (
              <p className="mt-2 text-left text-[12px] text-[#f28b82]">
                {handleError}
              </p>
            )}
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={continueFromHandle}
                disabled={checking || handle.length === 0}
                className="flex h-10 items-center gap-2 rounded-full bg-[#8b5cf6] px-6 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {checking ? "Checking…" : "Continue"}
                {!checking && <ArrowRight size={15} aria-hidden="true" />}
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="animate-[step-in_0.35s_ease_both]">
            <h3 className="text-[16px]">Pick a picture</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[#9aa0a6]">
              This is how people see your YavqoID. You can use your Yavqo
              Account photo, upload a different one, or skip it.
            </p>
            <div className="mt-6 flex justify-center">
              <span
                key={avatarUrl ?? "none"}
                className="animate-[pop-in_0.3s_ease_both] rounded-full"
              >
                <span className="block animate-[glow-pulse_2.6s_ease-in-out_infinite] rounded-full">
                  <Avatar
                    avatarUrl={avatarUrl}
                    initial={user.initial}
                    className="h-24 w-24 text-[36px] font-normal"
                  />
                </span>
              </span>
            </div>
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                disabled={!user.avatarUrl}
                onClick={() => {
                  sounds.tap();
                  setAvatarUrl(user.avatarUrl);
                  setPictureChoice("account");
                }}
                className={`flex h-11 items-center gap-3 rounded-full border px-5 text-[13px] transition-colors disabled:opacity-50 ${
                  pictureChoice === "account"
                    ? "border-[#8b5cf6] bg-[#8b5cf6]/10"
                    : "border-[#5f6368] hover:bg-white/5"
                }`}
              >
                <UserRound size={16} className="text-[#8b5cf6]" aria-hidden="true" />
                Use my Yavqo Account photo
                {pictureChoice === "account" && (
                  <Check size={15} className="ml-auto text-[#8b5cf6]" aria-hidden="true" />
                )}
              </button>
              {!user.avatarUrl && (
                <p className="px-5 text-[11px] text-[#9aa0a6]">
                  You haven&apos;t set an account photo yet.
                </p>
              )}
              <button
                type="button"
                disabled={uploading}
                onClick={() => {
                  sounds.tap();
                  fileRef.current?.click();
                }}
                className={`flex h-11 items-center gap-3 rounded-full border px-5 text-[13px] transition-colors disabled:opacity-50 ${
                  pictureChoice === "upload"
                    ? "border-[#8b5cf6] bg-[#8b5cf6]/10"
                    : "border-[#5f6368] hover:bg-white/5"
                }`}
              >
                <ImagePlus size={16} className="text-[#8b5cf6]" aria-hidden="true" />
                {uploading ? "Uploading…" : "Upload a different photo"}
                {pictureChoice === "upload" && (
                  <Check size={15} className="ml-auto text-[#8b5cf6]" aria-hidden="true" />
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
                  sounds.tap();
                  setAvatarUrl(null);
                  setPictureChoice("none");
                }}
                className={`flex h-11 items-center gap-3 rounded-full border px-5 text-[13px] transition-colors ${
                  pictureChoice === "none"
                    ? "border-[#8b5cf6] bg-[#8b5cf6]/10"
                    : "border-[#5f6368] hover:bg-white/5"
                }`}
              >
                No photo for now
                {pictureChoice === "none" && (
                  <Check size={15} className="ml-auto text-[#8b5cf6]" aria-hidden="true" />
                )}
              </button>
              {uploadError && (
                <p className="px-5 text-[12px] text-[#f28b82]">{uploadError}</p>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  sounds.next();
                  setStep(2);
                }}
                className="flex h-10 items-center gap-2 rounded-full bg-[#8b5cf6] px-6 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
              >
                Continue
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-[step-in_0.35s_ease_both]">
            <h3 className="text-[16px]">Your info</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[#9aa0a6]">
              Shown next to your @handle. You can change these anytime.
            </p>
            <label className="mt-5 block text-left text-[12px] text-[#9aa0a6]">
              Display name
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 h-11 w-full rounded-full border border-[#5f6368] bg-[#202124] px-5 text-[14px] text-[#e8eaed] outline-none focus:border-[#8b5cf6]"
              />
            </label>
            <label className="mt-4 block text-left text-[12px] text-[#9aa0a6]">
              About you <span className="text-[#5f6368]">(optional)</span>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 160))}
                rows={3}
                placeholder="A line about you, visible to other Yavqo users."
                className="mt-1 w-full resize-none rounded-2xl border border-[#5f6368] bg-[#202124] p-4 text-[14px] text-[#e8eaed] outline-none placeholder:text-[#9aa0a6] focus:border-[#8b5cf6]"
              />
              <span className="mt-1 block text-right text-[11px] text-[#5f6368]">
                {bio.length}/160
              </span>
            </label>
            {createError && (
              <p className="mt-2 rounded-lg bg-[#452b0c] px-4 py-3 text-left text-[13px] text-[#fdd663]">
                {createError}
              </p>
            )}
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-left text-[12px] text-[#9aa0a6]">
                Your YavqoID: <span className="text-[#8b5cf6]">@{handle}</span>
              </p>
              <button
                type="button"
                onClick={createYavqoId}
                disabled={creating}
                className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-[#8b5cf6] px-6 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create YavqoID"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
