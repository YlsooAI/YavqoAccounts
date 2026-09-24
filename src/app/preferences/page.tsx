import type { Metadata } from "next";
import AccountShell from "@/components/AccountShell";
import PreferencesManager, { type AccountPreferences } from "@/components/PreferencesManager";
import { getAccountUser } from "@/lib/account";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Preferences · Yavqo Account" };

export default async function PreferencesPage() {
  const user = await getAccountUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("account_preferences")
    .select("personalization_enabled, activity_history_enabled, marketing_enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <AccountShell active="preferences" user={user}>
      {error ? (
        <div className="settings-page" role="alert">
          <h1>Preferences</h1>
          <p className="settings-intro">We couldn’t load your preferences. Refresh this page to try again.</p>
        </div>
      ) : (
        <PreferencesManager userId={user.id} initialPreferences={data as AccountPreferences | null} />
      )}
    </AccountShell>
  );
}
