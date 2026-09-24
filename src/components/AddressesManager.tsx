"use client";

import { useRef, useState, type FormEvent } from "react";
import { ChevronDown, MapPin, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type SavedAddress = {
  id: string;
  label: string | null;
  street_address: string;
  extended_address: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean | null;
};

type AddressDraft = {
  label: "Home" | "Work" | "Billing" | "Shipping" | "Other";
  street_address: string;
  extended_address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
};

const emptyDraft: AddressDraft = {
  label: "Home", street_address: "", extended_address: "", city: "", state: "", postal_code: "", country: "",
};

const fields: { name: keyof Pick<AddressDraft, "street_address" | "city" | "country">; label: string }[] = [
  { name: "street_address", label: "Street address" },
  { name: "city", label: "City" },
  { name: "country", label: "Country" },
];

function toDraft(address: SavedAddress): AddressDraft {
  const label = address.label;
  return {
    label: label === "Home" || label === "Work" || label === "Billing" || label === "Shipping" || label === "Other" ? label : "Other",
    street_address: address.street_address,
    extended_address: address.extended_address ?? "",
    city: address.city,
    state: address.state,
    postal_code: address.postal_code,
    country: address.country,
  };
}

export default function AddressesManager({ userId, initialAddresses, initialError }: { userId: string; initialAddresses: SavedAddress[]; initialError: string | null }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [addresses, setAddresses] = useState(initialAddresses);
  const [loadError, setLoadError] = useState(initialError);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AddressDraft>(emptyDraft);
  const [invalidField, setInvalidField] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavedAddress | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function startAdd() {
    setEditingId(null);
    setDraft(emptyDraft);
    setInvalidField(null);
    setError(null);
    setMessage(null);
    setFormOpen(true);
  }

  function startEdit(address: SavedAddress) {
    setEditingId(address.id);
    setDraft(toDraft(address));
    setInvalidField(null);
    setError(null);
    setMessage(null);
    setFormOpen(true);
  }

  function cancelEdit() {
    setFormOpen(false);
    setEditingId(null);
    setInvalidField(null);
    setError(null);
  }

  async function reload() {
    if (busy) return;
    setBusy("reload");
    setError(null);
    const { data, error: requestError } = await createClient()
      .from("addresses")
      .select("id, label, street_address, extended_address, city, state, postal_code, country, is_default")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (requestError) setLoadError(requestError.message);
    else {
      setAddresses((data ?? []) as SavedAddress[]);
      setLoadError(null);
    }
    setBusy(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    for (const { name, label } of fields) {
      if (!draft[name].trim()) {
        setInvalidField(name);
        setError(`Enter a ${label.toLowerCase()}.`);
        (event.currentTarget.elements.namedItem(name) as HTMLInputElement | null)?.focus();
        return;
      }
    }
    setBusy("save");
    setError(null);
    setInvalidField(null);
    setMessage(null);
    const payload = {
      label: draft.label,
      street_address: draft.street_address.trim(),
      extended_address: draft.extended_address.trim() || null,
      city: draft.city.trim(),
      state: draft.state.trim(),
      postal_code: draft.postal_code.trim(),
      country: draft.country.trim(),
    };
    const supabase = createClient();
    const select = "id, label, street_address, extended_address, city, state, postal_code, country, is_default";
    const result = editingId
      ? await supabase.from("addresses").update(payload).eq("id", editingId).eq("user_id", userId).select(select).single()
      : await supabase.from("addresses").insert({ ...payload, user_id: userId, is_default: addresses.length === 0 }).select(select).single();
    if (result.error) setError(result.error.message);
    else {
      const next = result.data as SavedAddress;
      setAddresses((current) => editingId ? current.map((item) => item.id === next.id ? next : item) : [next, ...current]);
      setFormOpen(false);
      setEditingId(null);
      setMessage(editingId ? "Address updated." : "Address added.");
    }
    setBusy(null);
  }

  async function setDefault(target: SavedAddress) {
    if (busy || target.is_default) return;
    setBusy(target.id);
    setError(null);
    setMessage(null);
    const previousIds = addresses.filter((item) => item.is_default).map((item) => item.id);
    const supabase = createClient();
    if (previousIds.length) {
      const { error: clearError } = await supabase.from("addresses").update({ is_default: false }).eq("user_id", userId).in("id", previousIds);
      if (clearError) {
        setError(clearError.message);
        setBusy(null);
        return;
      }
    }
    const { data, error: updateError } = await supabase.from("addresses").update({ is_default: true }).eq("user_id", userId).eq("id", target.id).select("id").single();
    if (updateError || !data) {
      if (previousIds.length) await supabase.from("addresses").update({ is_default: true }).eq("user_id", userId).in("id", previousIds);
      setError(updateError?.message ?? "Could not set the default address. Refresh and try again.");
      await reloadAfterFailure();
    } else {
      setAddresses((current) => current.map((item) => ({ ...item, is_default: item.id === target.id })));
      setMessage(`${target.label ?? "Address"} is now your default address.`);
    }
    setBusy(null);
  }

  async function reloadAfterFailure() {
    const { data } = await createClient().from("addresses")
      .select("id, label, street_address, extended_address, city, state, postal_code, country, is_default")
      .eq("user_id", userId).order("created_at", { ascending: false });
    if (data) setAddresses(data as SavedAddress[]);
  }

  function confirmDelete(address: SavedAddress) {
    setDeleteTarget(address);
    setError(null);
    dialogRef.current?.showModal();
  }

  async function remove() {
    if (!deleteTarget || busy) return;
    setBusy("delete");
    setError(null);
    const { error: deleteError } = await createClient().from("addresses").delete().eq("id", deleteTarget.id).eq("user_id", userId);
    if (deleteError) setError(deleteError.message);
    else {
      setAddresses((current) => current.filter((item) => item.id !== deleteTarget.id));
      setMessage("Address deleted.");
      dialogRef.current?.close();
    }
    setBusy(null);
  }

  return (
    <div className="settings-page">
      <div className="settings-heading">
        <div><p className="settings-eyebrow">Personal information</p><h1>Saved addresses</h1><p className="settings-intro">Keep addresses available for Yavqo services that support them.</p></div>
        <MapPin size={29} aria-hidden="true" className="settings-heading-icon" />
      </div>

      {loadError ? <div className="settings-error" role="alert">Couldn’t load addresses: {loadError} <button type="button" onClick={reload} disabled={busy !== null}>Try again</button></div> : null}
      {!loadError && !formOpen && <div className="settings-actions settings-actions-top"><button type="button" className="settings-primary" onClick={startAdd}><Plus size={17} aria-hidden="true" /> Add address</button></div>}
      {message && <p className="settings-success" role="status">{message}</p>}
      {error && !formOpen && !deleteTarget && <p className="settings-error" role="alert">{error}</p>}

      {formOpen && <form noValidate onSubmit={save} className="settings-form" aria-label={editingId ? "Edit address" : "Add address"}>
        <h2>{editingId ? "Edit address" : "Add an address"}</h2>
        <div className="settings-field"><label htmlFor="address-label">Address type</label><div className="settings-select"><select id="address-label" value={draft.label} onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value as AddressDraft["label"] }))}><option>Home</option><option>Work</option><option>Billing</option><option>Shipping</option><option>Other</option></select><ChevronDown size={18} aria-hidden="true" /></div></div>
        <div className="settings-field"><label htmlFor="street_address">Street address</label><input id="street_address" name="street_address" autoComplete="address-line1" value={draft.street_address} onChange={(event) => setDraft((current) => ({ ...current, street_address: event.target.value }))} aria-invalid={invalidField === "street_address"} aria-describedby={invalidField === "street_address" ? "address-form-error" : undefined} /></div>
        <div className="settings-field"><label htmlFor="extended_address">Apartment, suite, or unit <span>(optional)</span></label><input id="extended_address" name="extended_address" autoComplete="address-line2" value={draft.extended_address} onChange={(event) => setDraft((current) => ({ ...current, extended_address: event.target.value }))} /></div>
        <div className="settings-field-grid">
          <div className="settings-field"><label htmlFor="city">City</label><input id="city" name="city" autoComplete="address-level2" value={draft.city} onChange={(event) => setDraft((current) => ({ ...current, city: event.target.value }))} aria-invalid={invalidField === "city"} aria-describedby={invalidField === "city" ? "address-form-error" : undefined} /></div>
          <div className="settings-field"><label htmlFor="state">State or region <span>(if applicable)</span></label><input id="state" name="state" autoComplete="address-level1" value={draft.state} onChange={(event) => setDraft((current) => ({ ...current, state: event.target.value }))} /></div>
          <div className="settings-field"><label htmlFor="postal_code">Postal code <span>(if applicable)</span></label><input id="postal_code" name="postal_code" autoComplete="postal-code" value={draft.postal_code} onChange={(event) => setDraft((current) => ({ ...current, postal_code: event.target.value }))} /></div>
          <div className="settings-field"><label htmlFor="country">Country</label><input id="country" name="country" autoComplete="country-name" value={draft.country} onChange={(event) => setDraft((current) => ({ ...current, country: event.target.value }))} aria-invalid={invalidField === "country"} aria-describedby={invalidField === "country" ? "address-form-error" : undefined} /></div>
        </div>
        {error && <p id="address-form-error" className="settings-error" role="alert">{error}</p>}
        <div className="settings-actions"><button type="button" className="settings-secondary" onClick={cancelEdit} disabled={busy !== null}>Cancel</button><button type="submit" className="settings-primary" disabled={busy !== null}>{busy === "save" ? "Saving…" : editingId ? "Save changes" : "Add address"}</button></div>
      </form>}

      {!loadError && !addresses.length && !formOpen && <div className="settings-empty"><MapPin size={27} aria-hidden="true" /><h2>No addresses saved</h2><p>Add an address when you want to use it with a supported Yavqo service.</p></div>}
      {!loadError && addresses.length > 0 && <ul className="settings-address-list">{addresses.map((address) => <li key={address.id} className="settings-address">
        <div><div className="settings-address-title"><h2>{address.label ?? "Address"}</h2>{address.is_default && <span>Default</span>}</div><address>{address.street_address}{address.extended_address && <>, {address.extended_address}</>}<br />{[address.city, address.state].filter(Boolean).join(", ")}{address.postal_code ? ` ${address.postal_code}` : ""}<br />{address.country}</address></div>
        <div className="settings-address-actions"><button type="button" onClick={() => startEdit(address)} disabled={busy !== null}>Edit</button>{!address.is_default && <button type="button" onClick={() => setDefault(address)} disabled={busy !== null}>{busy === address.id ? "Saving…" : "Make default"}</button>}<button type="button" className="settings-danger-link" onClick={() => confirmDelete(address)} disabled={busy !== null}>Delete</button></div>
      </li>)}</ul>}
      <p className="settings-helper">Addresses are visible to you in this account. Other Yavqo services need to support saved addresses before they can use them.</p>

      <dialog ref={dialogRef} className="settings-dialog" aria-labelledby="address-delete-title" onClose={() => setDeleteTarget(null)} onCancel={(event) => { if (busy === "delete") event.preventDefault(); }}>
        <h2 id="address-delete-title">Delete {deleteTarget?.label ?? "this address"}?</h2>
        <p>This removes the saved address from your Yavqo Account. You can add it again later.</p>
        {error && <p className="settings-error" role="alert">{error}</p>}
        <div className="settings-actions"><button type="button" className="settings-secondary" disabled={busy === "delete"} onClick={() => dialogRef.current?.close()}>Cancel</button><button type="button" className="settings-danger-button" disabled={busy === "delete"} onClick={remove}>{busy === "delete" ? "Deleting…" : "Delete address"}</button></div>
      </dialog>
    </div>
  );
}
