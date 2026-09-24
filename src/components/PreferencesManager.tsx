"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type AccountPreferences = {
  personalization_enabled: boolean;
  activity_history_enabled: boolean;
  marketing_enabled: boolean;
};

const defaults: AccountPreferences = {
  personalization_enabled: true,
  activity_history_enabled: true,
  marketing_enabled: false,
};

const choices: { key: keyof AccountPreferences; title: string; description: string }[] = [
  { key: "personalization_enabled", title: "Personalization", description: "Let supported Yavqo services tailor your experience." },
  { key: "activity_history_enabled", title: "Activity history", description: "Let supported Yavqo services save activity to your account." },
  { key: "marketing_enabled", title: "Product news and offers", description: "Allow Yavqo to send you optional product updates and offers." },
];

export default function PreferencesManager({ userId, initialPreferences }: { userId: string; initialPreferences: AccountPreferences | null }) {
  const [saved, setSaved] = useState<AccountPreferences>(initialPreferences ?? defaults);
  const [draft, setDraft] = useState<AccountPreferences>(initialPreferences ?? defaults);
  const [hasStored, setHasStored] = useState(initialPreferences !== null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const changed = choices.some(({ key }) => draft[key] !== saved[key]) || !hasStored;

  async function save() {
    if (saving || !changed) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    const { error: saveError } = await createClient().from("account_preferences").upsert(
      { user_id: userId, ...draft, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    if (saveError) setError(saveError.message);
    else {
      setSaved(draft);
      setHasStored(true);
      setMessage("Preferences saved.");
    }
    setSaving(false);
  }

  return (
    <div className="settings-page">
      <div className="settings-heading">
        <div>
          <p className="settings-eyebrow">Your choices</p>
          <h1>Preferences</h1>
          <p className="settings-intro">Save how you want Yavqo services to use your account.</p>
        </div>
        <SlidersHorizontal size={29} aria-hidden="true" className="settings-heading-icon" />
      </div>

      <div className="settings-list">
        {choices.map(({ key, title, description }) => (
          <label key={key} className="settings-choice">
            <span><strong>{title}</strong><span>{description}</span></span>
            <input
              type="checkbox"
              checked={draft[key]}
              disabled={saving}
              onChange={(event) => {
                setDraft((current) => ({ ...current, [key]: event.target.checked }));
                setMessage(null);
              }}
            />
          </label>
        ))}
      </div>
      <p className="settings-helper">These choices are stored on your Yavqo Account. Each Yavqo service must support a preference before it can affect that service. Changing activity history does not erase existing records.</p>
      {error && <p className="settings-error" role="alert">{error}</p>}
      {message && <p className="settings-success" role="status">{message}</p>}
      <div className="settings-actions"><button type="button" className="settings-primary" disabled={!changed || saving} onClick={save}>{saving ? "Saving…" : "Save preferences"}</button></div>
    </div>
  );
}
