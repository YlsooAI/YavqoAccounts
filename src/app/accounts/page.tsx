import type { Metadata } from "next";
import AccountChooser from "@/components/AccountChooser";
import { safeInternalPath } from "@/lib/account-slots";

export const metadata: Metadata = { title: "Choose an account — Yavqo" };

export default async function AccountsPage({ searchParams }: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = (await searchParams).next;
  return <AccountChooser nextTarget={safeInternalPath(next)} />;
}
