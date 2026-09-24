import type { Metadata } from "next";
import AccountShell from "@/components/AccountShell";
import AddressesManager, { type SavedAddress } from "@/components/AddressesManager";
import { getAccountUser } from "@/lib/account";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Saved addresses · Yavqo Account" };

export default async function AddressesPage() {
  const user = await getAccountUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("addresses")
    .select("id, label, street_address, extended_address, city, state, postal_code, country, is_default")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <AccountShell active="addresses" user={user}>
      <AddressesManager
        userId={user.id}
        mapboxToken={process.env.MAPBOX_PUBLIC_TOKEN ?? ""}
        initialAddresses={(data ?? []) as SavedAddress[]}
        initialError={error?.message ?? null}
      />
    </AccountShell>
  );
}
