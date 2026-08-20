"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Contact,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ContactEntry = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_favorite: boolean;
};

const LETTER_COLORS = [
  "#8ab4f8",
  "#c58af9",
  "#81c995",
  "#fcad70",
  "#ff8bcb",
  "#fdd663",
];

function letterColor(name: string) {
  let sum = 0;
  for (const char of name) sum += char.charCodeAt(0);
  return LETTER_COLORS[sum % LETTER_COLORS.length];
}

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  notes: "",
};

export default function ContactsManager({ userId }: { userId: string }) {
  const [contacts, setContacts] = useState<ContactEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error: loadError } = await supabase
      .from("contacts")
      .select("id, name, email, phone, notes, is_favorite")
      .eq("user_id", userId)
      .order("is_favorite", { ascending: false })
      .order("name");
    if (loadError) {
      setError(loadError.message);
    } else {
      setContacts((data as ContactEntry[]) ?? []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(entry: ContactEntry) {
    setEditingId(entry.id);
    setForm({
      name: entry.name,
      email: entry.email ?? "",
      phone: entry.phone ?? "",
      notes: entry.notes ?? "",
    });
    setFormOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const payload = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      notes: form.notes.trim() || null,
    };

    const { error: writeError } = editingId
      ? await supabase
          .from("contacts")
          .update(payload)
          .eq("id", editingId)
          .eq("user_id", userId)
      : await supabase.from("contacts").insert({ ...payload, user_id: userId });

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
      .from("contacts")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (deleteError) {
      setError(deleteError.message);
    } else {
      await load();
    }
  }

  async function toggleFavorite(entry: ContactEntry) {
    // Optimistic toggle; load() restores truth if the write fails.
    setContacts((prev) =>
      prev.map((c) => (c.id === entry.id ? { ...c, is_favorite: !entry.is_favorite } : c))
    );
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("contacts")
      .update({ is_favorite: !entry.is_favorite })
      .eq("id", entry.id)
      .eq("user_id", userId);
    if (updateError) {
      setError(updateError.message);
      await load();
    }
  }

  const filtered = contacts.filter((entry) =>
    `${entry.name} ${entry.email ?? ""} ${entry.phone ?? ""}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-[760px] pb-16 pt-6 md:pt-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-[24px] font-normal">Contacts &amp; sharing</h2>
          <p className="mt-1 text-[13px] text-[#9aa0a6]">
            {contacts.length} contact{contacts.length === 1 ? "" : "s"} — only
            you can see them.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="flex h-9 items-center gap-2 rounded-full bg-[#8ab4f8] px-4 text-[13px] font-medium text-[#202124] transition-opacity hover:opacity-90"
        >
          <Plus size={16} aria-hidden="true" />
          Add contact
        </button>
      </div>

      <div className="mt-6 flex h-12 items-center gap-3 rounded-full bg-[#292a2d] px-5">
        <Search size={18} className="shrink-0 text-[#9aa0a6]" />
        <input
          type="search"
          placeholder="Search contacts"
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
            {editingId ? "Edit contact" : "Add contact"}
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <input
              required
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="h-11 rounded-lg border border-[#3c4043] bg-[#202124] px-4 text-[14px] outline-none placeholder:text-[#9aa0a6] focus:border-[#8ab4f8]"
            />
            <input
              type="email"
              placeholder="Email (optional)"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="h-11 rounded-lg border border-[#3c4043] bg-[#202124] px-4 text-[14px] outline-none placeholder:text-[#9aa0a6] focus:border-[#8ab4f8]"
            />
            <input
              type="tel"
              placeholder="Phone (optional)"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="h-11 rounded-lg border border-[#3c4043] bg-[#202124] px-4 text-[14px] outline-none placeholder:text-[#9aa0a6] focus:border-[#8ab4f8]"
            />
            <input
              placeholder="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="h-11 rounded-lg border border-[#3c4043] bg-[#202124] px-4 text-[14px] outline-none placeholder:text-[#9aa0a6] focus:border-[#8ab4f8]"
            />
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
          <p className="text-[13px] text-[#9aa0a6]">Loading contacts…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl bg-[#292a2d] p-10 text-center">
            <Contact size={28} className="mx-auto text-[#8ab4f8]" />
            <p className="mt-4 text-[15px]">
              {contacts.length === 0
                ? "No contacts yet."
                : "No contacts match your search."}
            </p>
            <p className="mt-1 text-[13px] text-[#9aa0a6]">
              {contacts.length === 0
                ? "Add people you share things with across Yavqo services."
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
                  style={{ backgroundColor: letterColor(entry.name) }}
                >
                  {entry.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[14px]">{entry.name}</p>
                  <p className="flex flex-wrap items-center gap-x-3 truncate text-[12px] text-[#9aa0a6]">
                    {entry.email && (
                      <span className="flex items-center gap-1">
                        <Mail size={12} aria-hidden="true" />
                        {entry.email}
                      </span>
                    )}
                    {entry.phone && (
                      <span className="flex items-center gap-1">
                        <Phone size={12} aria-hidden="true" />
                        {entry.phone}
                      </span>
                    )}
                    {!entry.email && !entry.phone && entry.notes}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={
                      entry.is_favorite
                        ? "Remove from favorites"
                        : "Add to favorites"
                    }
                    onClick={() => toggleFavorite(entry)}
                    className="rounded-full p-2 transition-colors hover:bg-white/10"
                  >
                    <Star
                      size={16}
                      className={
                        entry.is_favorite
                          ? "fill-[#fdd663] text-[#fdd663]"
                          : "text-[#9aa0a6] hover:text-white"
                      }
                    />
                  </button>
                  <button
                    type="button"
                    aria-label="Edit contact"
                    onClick={() => openEdit(entry)}
                    className="rounded-full p-2 text-[#9aa0a6] transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete contact"
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
      </div>
    </div>
  );
}
