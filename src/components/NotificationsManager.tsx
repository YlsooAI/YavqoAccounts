"use client";

import { useState } from "react";
import { Bell, Check, RotateCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type AccountNotification = {
  id: string;
  title: string;
  message: string;
  category: string;
  read: boolean | null;
  created_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export default function NotificationsManager({
  userId,
  initialNotifications,
  initialError,
}: {
  userId: string;
  initialNotifications: AccountNotification[];
  initialError: string | null;
}) {
  const [items, setItems] = useState(initialNotifications);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(initialError);
  const [message, setMessage] = useState<string | null>(null);
  const unreadCount = items.filter((item) => !item.read).length;
  const visible = filter === "unread" ? items.filter((item) => !item.read) : items;

  async function reload() {
    if (busy) return;
    setBusy("reload");
    setError(null);
    const { data, error: loadError } = await createClient()
      .from("notifications")
      .select("id, title, message, category, read, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (loadError) setError(loadError.message);
    else {
      setItems((data ?? []) as AccountNotification[]);
      setMessage(null);
    }
    setBusy(null);
  }

  async function markRead(id: string) {
    if (busy) return;
    setBusy(id);
    setError(null);
    const { error: updateError } = await createClient()
      .from("notifications")
      .update({ read: true })
      .eq("id", id)
      .eq("user_id", userId);
    if (updateError) setError(updateError.message);
    else {
      setItems((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
      setMessage("Notification marked as read.");
    }
    setBusy(null);
  }

  async function markAllRead() {
    if (busy || unreadCount === 0) return;
    setBusy("all");
    setError(null);
    const ids = items.filter((item) => !item.read).map((item) => item.id);
    const { error: updateError } = await createClient()
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .in("id", ids);
    if (updateError) setError(updateError.message);
    else {
      setItems((current) => current.map((item) => ids.includes(item.id) ? { ...item, read: true } : item));
      setMessage("All shown notifications marked as read.");
    }
    setBusy(null);
  }

  return (
    <div className="settings-page">
      <div className="settings-heading">
        <div>
          <p className="settings-eyebrow">Account updates</p>
          <h1>Notifications</h1>
          <p className="settings-intro">Updates sent to your Yavqo Account appear here.</p>
        </div>
        <Bell size={29} aria-hidden="true" className="settings-heading-icon" />
      </div>

      <div className="settings-toolbar">
        <div className="settings-segment" role="group" aria-label="Filter notifications">
          <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All</button>
          <button type="button" aria-pressed={filter === "unread"} onClick={() => setFilter("unread")}>Unread{unreadCount ? ` (${unreadCount})` : ""}</button>
        </div>
        <div className="settings-toolbar-actions">
          <button type="button" className="settings-text-button" onClick={reload} disabled={busy !== null}><RotateCw size={16} aria-hidden="true" /> Refresh</button>
          <button type="button" className="settings-text-button" onClick={markAllRead} disabled={busy !== null || unreadCount === 0}><Check size={16} aria-hidden="true" /> Mark shown as read</button>
        </div>
      </div>

      {error && <p className="settings-error" role="alert">{error}</p>}
      {message && !error && <p className="settings-success" role="status">{message}</p>}
      {busy === "reload" && <p className="settings-helper" role="status">Refreshing notifications…</p>}

      {visible.length ? (
        <ul className="settings-list">
          {visible.map((item) => (
            <li key={item.id} className={`settings-notification${item.read ? "" : " is-unread"}`}>
              <span className="settings-notification-dot" aria-hidden="true" />
              <div className="settings-notification-content">
                <div className="settings-notification-meta"><span>{item.category}</span><time dateTime={item.created_at ?? undefined}>{formatDate(item.created_at)}</time></div>
                <h2>{item.title}</h2>
                <p>{item.message}</p>
                {!item.read && <button type="button" className="settings-inline-button" disabled={busy !== null} onClick={() => markRead(item.id)}>{busy === item.id ? "Saving…" : "Mark as read"}</button>}
              </div>
            </li>
          ))}
        </ul>
      ) : !error ? (
        <div className="settings-empty"><Bell size={27} aria-hidden="true" /><h2>{filter === "unread" ? "You’re all caught up" : "No notifications yet"}</h2><p>{filter === "unread" ? "You have no unread notifications." : "When Yavqo sends an account update, you’ll see it here."}</p></div>
      ) : null}
      {items.length === 100 && <p className="settings-helper">Showing your 100 most recent notifications.</p>}
    </div>
  );
}
