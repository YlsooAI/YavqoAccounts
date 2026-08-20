import { ChevronRight, Contact, KeyRound, ShieldCheck } from "lucide-react";
import AccountShell from "@/components/AccountShell";
import DataExportButton from "@/components/DataExportButton";
import DeleteDataCard from "@/components/DeleteDataCard";
import { createClient } from "@/lib/supabase/server";
import { getAccountUser } from "@/lib/account";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const user = await getAccountUser();
  const supabase = await createClient();

  const [{ count: passwordCount }, { count: contactCount }] =
    await Promise.all([
      supabase
        .from("saved_passwords")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);

  const dataRows = [
    {
      href: "/password",
      icon: KeyRound,
      color: "#8ab4f8",
      title: "Yavqo Password",
      subtitle: `${passwordCount ?? 0} saved password${
        passwordCount === 1 ? "" : "s"
      }`,
    },
    {
      href: "/contacts",
      icon: Contact,
      color: "#ff8bcb",
      title: "Contacts",
      subtitle: `${contactCount ?? 0} contact${
        contactCount === 1 ? "" : "s"
      }`,
    },
  ];

  return (
    <AccountShell active="privacy" user={user}>
      <div className="mx-auto max-w-[660px] pt-6 md:pt-10">
        <h2 className="text-[24px] font-normal">Data &amp; privacy</h2>
        <p className="mt-2 text-[13px] text-[#9aa0a6]">
          See what data is saved to your Yavqo Account, download it, or delete
          it. Only you can see these settings.
        </p>

        <section className="mt-8 rounded-2xl border border-[#3c4043] px-6">
          <h3 className="border-b border-[#3c4043] py-4 text-[16px]">
            Your data in Yavqo services
          </h3>
          <ul>
            {dataRows.map((row) => (
              <li key={row.title} className="border-b border-[#3c4043] last:border-b-0">
                <a
                  href={row.href}
                  className="flex items-center gap-4 py-4 transition-opacity hover:opacity-80"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: row.color }}
                  >
                    <row.icon
                      size={20}
                      className="text-[#1f1f1f]"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-[14px]">
                      {row.title}
                    </span>
                    <span className="block truncate text-[13px] text-[#9aa0a6]">
                      {row.subtitle}
                    </span>
                  </span>
                  <ChevronRight
                    size={18}
                    className="shrink-0 text-[#9aa0a6]"
                    aria-hidden="true"
                  />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-2xl border border-[#3c4043] px-6">
          <h3 className="border-b border-[#3c4043] py-4 text-[16px]">
            Data controls
          </h3>

          <div className="flex items-center justify-between gap-4 border-b border-[#3c4043] py-4">
            <div>
              <p className="text-[14px]">Download your data</p>
              <p className="mt-0.5 text-[13px] text-[#9aa0a6]">
                Get a copy of your profile, saved passwords, and contacts as a
                JSON file.
              </p>
            </div>
            <DataExportButton userId={user.id} email={user.email} />
          </div>

          <DeleteDataCard userId={user.id} />
        </section>

        <p className="mt-6 flex items-start gap-2 text-[12px] leading-relaxed text-[#9aa0a6]">
          <ShieldCheck
            size={16}
            className="mt-0.5 shrink-0 text-[#8ab4f8]"
            aria-hidden="true"
          />
          Yavqo treats your data confidentially and securely. Data shown here
          is visible only to you and is protected by row-level access controls.
        </p>

        <div className="h-10" />
      </div>
    </AccountShell>
  );
}
