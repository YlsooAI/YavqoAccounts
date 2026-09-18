"use client";

import { useCallback, useEffect, useState } from "react";
import { Globe, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { faviconUrl } from "@/lib/connectedApps";

type Authorization = {
  id: string;
  client_id: string;
  site_title: string;
  site_url: string;
  site_host: string;
  scope: string;
  granted_at: string;
  last_used_at: string;
};

export default function ConnectedAppsManager({ userId }: { userId: string }) {
  const [apps, setApps] = useState<Authorization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error: loadError } = await supabase
      .from("id_oauth_authorizations")
      .select(
        "id, client_id, site_title, site_url, site_host, scope, granted_at, last_used_at"
      )
      .eq("user_id", userId)
      .order("last_used_at", { ascending: false });

    if (loadError) {
      setError(loadError.message);
    } else {
      setApps((data as Authorization[]) ?? []);
      setError(null);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function revoke(app: Authorization) {
    if (revokingId !== app.id) {
      setRevokingId(app.id);
      return;
    }
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("id_oauth_authorizations")
      .delete()
      .eq("id", app.id)
      .eq("user_id", userId);
    if (deleteError) {
      setError(deleteError.message);
    } else {
      setApps((prev) => prev.filter((item) => item.id !== app.id));
    }
    setRevokingId(null);
  }

  return (
    <div className="mx-auto max-w-[660px] pb-16 pt-6 md:pt-10">
      <h2 className="text-[24px] font-normal">Connected apps</h2>
      <p className="mt-2 text-[13px] text-[#9aa0a6]">
        Websites and apps that can access your Yavqo Account. You can revoke
        access at any time.
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-[#452b0c] p-3 text-[13px] text-[#fdd663]">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-[13px] text-[#9aa0a6]">Loading…</p>
      ) : apps.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-[#3c4043] bg-[#292a2d] p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#8ab4f8]">
            <Globe size={22} className="text-[#1f1f1f]" aria-hidden="true" />
          </span>
          <p className="mt-4 text-[15px]">No connected apps yet</p>
          <p className="mt-2 text-[13px] leading-relaxed text-[#9aa0a6]">
            When you sign in to a website or app with your Yavqo Account, it
            shows up here with its title, URL, and favicon.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {apps.map((app) => (
            <article
              key={app.id}
              className="rounded-2xl border border-[#3c4043] bg-[#292a2d] p-5"
            >
              <div className="flex items-start gap-3">
                <img
                  src={faviconUrl(app.site_host)}
                  alt=""
                  width={32}
                  height={32}
                  className="mt-0.5 h-8 w-8 shrink-0 rounded-md bg-[#202124] object-contain"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[15px] font-medium">
                    {app.site_title}
                  </h3>
                  <a
                    href={app.site_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-0.5 block truncate text-[13px] text-[#8ab4f8] hover:underline"
                  >
                    {app.site_url}
                  </a>
                  <p className="mt-2 text-[12px] text-[#9aa0a6]">
                    Access granted{" "}
                    {new Date(app.granted_at).toLocaleDateString("en-US", {
                      dateStyle: "medium",
                    })}
                    {app.scope ? ` · ${app.scope}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => revoke(app)}
                  onBlur={() => setRevokingId(null)}
                  className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] transition-colors ${
                    revokingId === app.id
                      ? "bg-[#f28b82] text-[#202124]"
                      : "border border-[#5f6368] text-[#9aa0a6] hover:bg-white/5"
                  }`}
                >
                  <Trash2 size={12} aria-hidden="true" />
                  {revokingId === app.id ? "Confirm" : "Revoke"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
