import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import AccountShell from "@/components/AccountShell";
import { getAccountUser } from "@/lib/account";

export const dynamic = "force-dynamic";

const sections = [
  {
    title: "Using Yavqo services",
    body: "By using your Yavqo Account and the services connected to it — like Yavqo TV, Yavqo Maps, and Yavqo Search — you agree to these terms. If you don't agree, please don't use the services.",
  },
  {
    title: "Your Yavqo Account",
    body: "You're responsible for keeping your password and sign-in details safe. Keep your account information accurate, and don't share your account with others. You can review and manage your account at any time from this dashboard.",
  },
  {
    title: "Subscriptions and payments",
    body: "Paid services like Yavqo TV renew automatically until you cancel. When you cancel, you keep access until the end of the current billing period. Card verification charges are refunded immediately.",
  },
  {
    title: "Your content",
    body: "You keep ownership of anything you create or upload with your Yavqo Account. You give Yavqo the limited right to store and process that content in order to provide the services to you.",
  },
  {
    title: "Privacy",
    body: "Yavqo treats your data confidentially and securely. How your data is used is described in the Privacy notice, and you can export or delete your data any time from Data & privacy.",
  },
  {
    title: "Changes and termination",
    body: "Yavqo may update these terms; material changes will be announced in advance. You can close your account at any time from Data & privacy. Yavqo may suspend accounts that abuse the services.",
  },
];

export default async function TermsPage() {
  const user = await getAccountUser();

  return (
    <AccountShell active="terms" user={user}>
      <div className="mx-auto max-w-[660px] pb-16 pt-6 md:pt-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-[13px] text-[#8ab4f8] hover:underline"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Back to Overview
        </Link>

        <h2 className="mt-6 text-[24px] font-normal">Yavqo Terms of Service</h2>
        <p className="mt-2 text-[13px] text-[#9aa0a6]">
          Last updated: August 21, 2026
        </p>

        <section className="mt-8 rounded-2xl border border-[#3c4043] px-6">
          {sections.map((section, index) => (
            <div
              key={section.title}
              className={
                index === 0
                  ? "pb-5 pt-1"
                  : "border-t border-[#3c4043] py-5 last:pb-6"
              }
            >
              <h3 className="text-[16px]">{section.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-[#9aa0a6]">
                {section.body}
              </p>
            </div>
          ))}
        </section>
      </div>
    </AccountShell>
  );
}
