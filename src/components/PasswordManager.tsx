"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type SavedPassword = {
  id: string;
  site_name: string;
  site_url: string | null;
  username: string;
  password: string;
};

const LETTER_COLORS = [
  "#8ab4f8",
  "#c58af9",
  "#81c995",
  "#fcad70",
  "#ff8bcb",
  "#fdd663",
];

function letterColor(site: string) {
  let sum = 0;
  for (const char of site) sum += char.charCodeAt(0);
  return LETTER_COLORS[sum % LETTER_COLORS.length];
}

function generatePassword() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const values = new Uint32Array(16);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => chars[v % chars.length]).join("");
}

const emptyForm = {
  site_name: "",
  site_url: "",
  username: "",
  password: "",
};

export default function PasswordManager({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<SavedPassword[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error: loadError } = await supabase
      .from("saved_passwords")
      .select("id, site_name, site_url, username, password")
      .eq("user_id", userId)
      .order("site_name");
    if (loadError) {
      setError(loadError.message);
    } else {
      setEntries((data as SavedPassword[]) ?? []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!copiedId) return;
    const timer = setTimeout(() => setCopiedId(null), 2000);
    return () => clearTimeout(timer);
  }, [copiedId]);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(entry: SavedPassword) {
    setEditingId(entry.id);
    setForm({
      site_name: entry.site_name,
      site_url: entry.site_url ?? "",
      username: entry.username,
      password: entry.password,
    });
    setFormOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const payload = {
      site_name: form.site_name.trim(),
      site_url: form.site_url.trim() || null,
      username: form.username.trim(),
      password: form.password,
    };

    const { error: writeError } = editingId
      ? await supabase
          .from("saved_passwords")
          .update(payload)
          .eq("id", editingId)
          .eq("user_id", userId)
      : await supabase
          .from("saved_passwords")
          .insert({ ...payload, user_id: userId });

    if (writeError) {
      setError(writeError.message);
    } else {
      setFormOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      await load();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("saved_passwords")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (deleteError) {
      setError(deleteError.message);
    } else {
      await load();
    }
  }

  async function handleCopy(id: string, password: string) {
    try {
      await navigator.clipboard.writeText(password);
      setCopiedId(id);
    } catch {
      setError("Could not access the clipboard.");
    }
  }

  const filtered = entries.filter((entry) =>
    `${entry.site_name} ${entry.username}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-[760px] pb-16 pt-6 md:pt-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-[24px] font-normal">Yavqo Password</h2>
          <p className="mt-1 text-[13px] text-[#9aa0a6]">
            {entries.length} saved password{entries.length === 1 ? "" : "s"} —
            only you can see them.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="flex h-9 items-center gap-2 rounded-full bg-[#8ab4f8] px-4 text-[13px] font-medium text-[#202124] transition-opacity hover:opacity-90"
        >
          <Plus size={16} aria-hidden="true" />
          Add password
        </button>
      </div>

      <div className="mt-6 flex h-12 items-center gap-3 rounded-full bg-[#292a2d] px-5">
        <Search size={18} className="shrink-0 text-[#9aa0a6]" />
        <input
          type="search"
          placeholder="Search passwords"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full bg-transparent text-[14px] outline-none placeholder:text-[#9aa0a6]"
        />
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-[#452b0c] px-4 py-3 text-[13px] text-[#fdd663]">
          {error}
        </p>
      )}

      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-2xl bg-[#292a2d] p-6"
        >
          <h3 className="text-[16px] font-medium">
            {editingId ? "Edit password" : "Add password"}
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <input
              required
              placeholder="Site name (e.g. Netflix)"
              value={form.site_name}
              onChange={(e) => setForm({ ...form, site_name: e.target.value })}
              className="h-11 rounded-lg border border-[#3c4043] bg-[#202124] px-4 text-[14px] outline-none placeholder:text-[#9aa0a6] focus:border-[#8ab4f8]"
            />
            <input
              type="url"
              placeholder="Website (optional)"
              value={form.site_url}
              onChange={(e) => setForm({ ...form, site_url: e.target.value })}
              className="h-11 rounded-lg border border-[#3c4043] bg-[#202124] px-4 text-[14px] outline-none placeholder:text-[#9aa0a6] focus:border-[#8ab4f8]"
            />
            <input
              required
              placeholder="Username or email"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="h-11 rounded-lg border border-[#3c4043] bg-[#202124] px-4 text-[14px] outline-none placeholder:text-[#9aa0a6] focus:border-[#8ab4f8]"
            />
            <div className="flex gap-2">
              <input
                required
                placeholder="Password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="h-11 w-full rounded-lg border border-[#3c4043] bg-[#202124] px-4 text-[14px] outline-none placeholder:text-[#9aa0a6] focus:border-[#8ab4f8]"
              />
              <button
                type="button"
                title="Generate a strong password"
                onClick={() =>
                  setForm({ ...form, password: generatePassword() })
                }
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#3c4043] text-[#8ab4f8] transition-colors hover:bg-white/5"
              >
                <KeyRound size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setFormOpen(false);
                setEditingId(null);
              }}
              className="h-9 rounded-full px-4 text-[13px] font-medium text-[#8ab4f8] transition-colors hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 rounded-full bg-[#8ab4f8] px-5 text-[13px] font-medium text-[#202124] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6">
        {loading ? (
          <p className="text-[13px] text-[#9aa0a6]">Loading passwords…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl bg-[#292a2d] p-10 text-center">
            <KeyRound size={28} className="mx-auto text-[#8ab4f8]" />
            <p className="mt-4 text-[15px]">
              {entries.length === 0
                ? "No saved passwords yet."
                : "No passwords match your search."}
            </p>
            <p className="mt-1 text-[13px] text-[#9aa0a6]">
              {entries.length === 0
                ? "Add your first password to keep it safe."
                : "Try a different search term."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#3c4043] overflow-hidden rounded-2xl bg-[#292a2d]">
            {filtered.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-4 px-5 py-4"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[16px] font-medium text-[#1f1f1f]"
                  style={{ backgroundColor: letterColor(entry.site_name) }}
                >
                  {entry.site_name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[14px]">
                    {entry.site_url ? (
                      <a
                        href={entry.site_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {entry.site_name}
                      </a>
                    ) : (
                      entry.site_name
                    )}
                  </p>
                  <p className="truncate text-[12px] text-[#9aa0a6]">
                    {entry.username}
                  </p>
                </div>
                <span className="hidden font-mono text-[13px] text-[#e8eaed] sm:block">
                  {revealedId === entry.id
                    ? entry.password
                    : "•".repeat(Math.min(entry.password.length, 12))}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={
                      revealedId === entry.id ? "Hide password" : "Show password"
                    }
                    onClick={() =>
                      setRevealedId(revealedId === entry.id ? null : entry.id)
                    }
                    className="rounded-full p-2 text-[#9aa0a6] transition-colors hover:bg-white/10 hover:text-white"
                  >
                    {revealedId === entry.id ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label="Copy password"
                    onClick={() => handleCopy(entry.id, entry.password)}
                    className="rounded-full p-2 text-[#9aa0a6] transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label="Edit password"
                    onClick={() => openEdit(entry)}
                    className="rounded-full p-2 text-[#9aa0a6] transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete password"
                    onClick={() => handleDelete(entry.id)}
                    className="rounded-full p-2 text-[#9aa0a6] transition-colors hover:bg-white/10 hover:text-[#f28b82]"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {copiedId && (
          <p className="mt-3 text-[12px] text-[#81c995]">
            Password copied to clipboard.
          </p>
        )}
      </div>
    </div>
  );
}
