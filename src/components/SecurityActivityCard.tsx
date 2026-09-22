"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Session = {
  id: string;
  created_at: string;
  updated_at: string;
  user_agent: string | null;
  ip_address: string | null;
  is_current: boolean;
};

type Event = {
  created_at: string;
  action: string | null;
  ip_address: string | null;
};

type Activity = { sessions: Session[]; events: Event[] };
const LAST_REVIEW_KEY = "yavqo-security-activity-reviewed-v1";

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

function deviceLabel(userAgent: string | null) {
  if (!userAgent) return "Unknown browser or device";
  const browser = /Edg\//.test(userAgent) ? "Edge"
    : /Firefox\//.test(userAgent) ? "Firefox"
    : /Chrome\//.test(userAgent) ? "Chrome"
    : /Safari\//.test(userAgent) ? "Safari" : "Browser";
  const platform = /iPhone|iPad/.test(userAgent) ? "iPhone or iPad"
    : /Android/.test(userAgent) ? "Android"
    : /Macintosh|Mac OS X/.test(userAgent) ? "Mac"
    : /Windows/.test(userAgent) ? "Windows"
    : /Linux/.test(userAgent) ? "Linux" : "device";
  return `${browser} on ${platform}`;
}

function eventLabel(action: string | null) {
  if (!action) return "Account event";
  return action.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

export default function SecurityActivityCard() {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unreviewedEvents, setUnreviewedEvents] = useState(0);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error: loadError } = await supabase.rpc("account_security_activity");
    if (loadError) setError(loadError.message);
    else {
      const result = data as Activity | null;
      const next = { sessions: result?.sessions ?? [], events: result?.events ?? [] };
      setActivity(next);
      const reviewedAt = Number(window.localStorage.getItem(LAST_REVIEW_KEY)) ||
        Date.now() - 7 * 24 * 60 * 60 * 1000;
      setUnreviewedEvents(next.events.filter((event) =>
        /login|password|factor|mfa|recovery/i.test(event.action ?? "") &&
        new Date(event.created_at).getTime() > reviewedAt
      ).length);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function signOutOthers() {
    if (!confirm || busy) { setConfirm(true); return; }
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const { error: signOutError } = await supabase.auth.signOut({ scope: "others" });
    if (signOutError) setError(signOutError.message);
    else {
      setMessage("Other sessions were signed out. Their existing access tokens may remain valid until they expire.");
      await load();
    }
    setBusy(false);
    setConfirm(false);
  }

  const otherSessions = activity?.sessions.filter((session) => !session.is_current) ?? [];

  function markReviewed() {
    window.localStorage.setItem(LAST_REVIEW_KEY, String(Date.now()));
    setUnreviewedEvents(0);
  }

  return (
    <section className="mt-6 rounded-2xl border border-[#3c4043] px-6 pb-5">
      <h3 className="border-b border-[#3c4043] py-4 text-[16px]">Security activity</h3>
      {loading ? <p className="py-5 text-[13px] text-[#9aa0a6]">Loading activity…</p> : null}
      {error ? <p role="alert" className="mt-4 text-[13px] text-[#f28b82]">{error}</p> : null}
      {message ? <p role="status" className="mt-4 text-[13px] text-[#81c995]">{message}</p> : null}
      {activity ? <>
        {unreviewedEvents > 0 ? <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#9a741f] bg-[#3b321d] p-3 text-[12px] text-[#fdd663]">
          <span>{unreviewedEvents} sign-in or security {unreviewedEvents === 1 ? "event needs" : "events need"} your review below.</span>
          <button type="button" onClick={markReviewed} className="underline">Mark reviewed</button>
        </div> : null}
        {otherSessions.length > 0 ? <div role="status" className="mt-4 rounded-xl border border-[#9a741f] bg-[#3b321d] p-3 text-[12px] text-[#fdd663]">
          Other devices are signed in. If you do not recognize one, sign out other devices and change your password.
        </div> : null}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-5">
          <div>
            <h4 className="text-[14px]">Active sessions</h4>
            <p className="mt-1 text-[12px] text-[#9aa0a6]">
              {otherSessions.length > 0
                ? `${otherSessions.length} other ${otherSessions.length === 1 ? "session" : "sessions"} can access your account.`
                : "No other active sessions found."}
            </p>
          </div>
          {otherSessions.length > 0 ? <button type="button" disabled={busy}
            onClick={() => void signOutOthers()} onBlur={() => setConfirm(false)}
            className="rounded-full border border-[#8ab4f8] px-4 py-2 text-[12px] text-[#8ab4f8] disabled:opacity-50">
            {busy ? "Signing out…" : confirm ? "Confirm sign out" : "Sign out other devices"}
          </button> : null}
        </div>
        <ul className="mt-4 divide-y divide-[#3c4043]">
          {activity.sessions.map((session) => <li key={session.id} className="py-3">
            <div className="flex items-center gap-2 text-[13px]">
              <span>{deviceLabel(session.user_agent)}</span>
              {session.is_current ? <span className="rounded-full bg-[#24452e] px-2 py-0.5 text-[11px] text-[#81c995]">This session</span> : null}
            </div>
            <p className="mt-1 text-[12px] text-[#9aa0a6]">
              Signed in {dateTime(session.created_at)} · Last active {dateTime(session.updated_at)}
              {session.ip_address ? ` · IP ${session.ip_address}` : ""}
            </p>
          </li>)}
        </ul>
        <h4 className="mt-5 border-t border-[#3c4043] pt-5 text-[14px]">Recent account events</h4>
        <p className="mt-1 text-[12px] text-[#9aa0a6]">Sign-ins and security changes recorded by your authentication provider.</p>
        {activity.events.length === 0 ? <p className="mt-3 text-[12px] text-[#9aa0a6]">No audit events are available. Active session start times are shown above.</p> :
          <ul className="mt-3 divide-y divide-[#3c4043]">{activity.events.map((event, index) =>
            <li key={`${event.created_at}-${index}`} className="py-2 text-[12px]">
              <span>{eventLabel(event.action)}</span>
              <span className="ml-2 text-[#9aa0a6]">{dateTime(event.created_at)}{event.ip_address ? ` · IP ${event.ip_address}` : ""}</span>
            </li>
          )}</ul>}
      </> : null}
    </section>
  );
}
