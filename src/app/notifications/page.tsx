import type { Metadata } from "next";
import AccountShell from "@/components/AccountShell";
import NotificationsManager, { type AccountNotification } from "@/components/NotificationsManager";
import { getAccountUser } from "@/lib/account";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notifications · Yavqo Account" };

export default async function NotificationsPage() {
  const user = await getAccountUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, message, category, read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <AccountShell active="notifications" user={user}>
      <NotificationsManager
        userId={user.id}
        initialNotifications={(data ?? []) as AccountNotification[]}
        initialError={error?.message ?? null}
      />
    </AccountShell>
  );
}
