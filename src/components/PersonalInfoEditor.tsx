"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type PersonalInfo = {
  fullName: string | null;
  birthday: string | null;
  gender: string | null;
};

const GENDER_OPTIONS = ["Female", "Male", "Prefer not to say"];
const CUSTOM = "Custom";

const inputClass =
  "h-11 w-full rounded-lg border border-[#3c4043] bg-[#202124] px-4 text-[14px] text-[#e8eaed] outline-none transition-colors placeholder:text-[#9aa0a6] focus:border-[#8ab4f8] [color-scheme:dark]";

export default function PersonalInfoEditor({
  userId,
  initial,
}: {
  userId: string;
  initial: PersonalInfo;
}) {
  const router = useRouter();

  const [fullName, setFullName] = useState(initial.fullName ?? "");
  const [birthday, setBirthday] = useState(initial.birthday ?? "");
  const [genderChoice, setGenderChoice] = useState(() =>
    initial.gender && GENDER_OPTIONS.includes(initial.gender)
      ? initial.gender
      : initial.gender
        ? CUSTOM
        : ""
  );
  const [customGender, setCustomGender] = useState(
    initial.gender && !GENDER_OPTIONS.includes(initial.gender)
      ? initial.gender
      : ""
  );

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const payload = {
      full_name: fullName.trim() || null,
      birthday: birthday || null,
      gender:
        genderChoice === CUSTOM
          ? customGender.trim() || null
          : genderChoice || null,
    };

    const supabase = createClient();
    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", userId)
      .select();
    if (updateError) {
      setMessage({ kind: "error", text: updateError.message });
      setSaving(false);
      return;
    }
    if (updated.length === 0) {
      const { error: insertError } = await supabase
        .from("profiles")
        .insert({ id: userId, ...payload });
      if (insertError) {
        setMessage({ kind: "error", text: insertError.message });
        setSaving(false);
        return;
      }
    }

    setMessage({ kind: "success", text: "Personal info saved." });
    router.refresh();
    setSaving(false);
  }

  return (
    <form onSubmit={handleSave}>
      <div className="border-t border-[#3c4043] py-4">
        <label className="block text-[13px] text-[#9aa0a6]" htmlFor="full-name">
          Name
        </label>
        <input
          id="full-name"
          placeholder="Your name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className={`${inputClass} mt-2`}
          disabled={saving}
        />
      </div>

      <div className="border-t border-[#3c4043] py-4">
        <label className="block text-[13px] text-[#9aa0a6]" htmlFor="birthday">
          Birthday
        </label>
        <input
          id="birthday"
          type="date"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
          className={`${inputClass} mt-2 max-w-xs`}
          disabled={saving}
        />
      </div>

      <div className="border-t border-[#3c4043] py-4">
        <label className="block text-[13px] text-[#9aa0a6]" htmlFor="gender">
          Gender
        </label>
        <div className="mt-2 flex max-w-xs flex-col gap-3">
          <select
            id="gender"
            value={genderChoice}
            onChange={(e) => setGenderChoice(e.target.value)}
            className={inputClass}
            disabled={saving}
          >
            <option value="">Choose a gender</option>
            {GENDER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            <option value={CUSTOM}>Custom</option>
          </select>
          {genderChoice === CUSTOM && (
            <input
              placeholder="Describe your gender"
              value={customGender}
              onChange={(e) => setCustomGender(e.target.value)}
              className={inputClass}
              disabled={saving}
            />
          )}
        </div>
      </div>

      {message && (
        <p
          className={`mt-3 text-[13px] ${
            message.kind === "error" ? "text-[#f28b82]" : "text-[#81c995]"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="border-t border-[#3c4043] py-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-[#8ab4f8] px-6 py-2 text-[13px] font-medium text-[#202124] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
