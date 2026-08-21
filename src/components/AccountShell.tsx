import type { ReactNode } from "react";
import { CircleHelp, ShieldCheck } from "lucide-react";
import AccountNav from "@/components/AccountNav";
import Avatar from "@/components/Avatar";
import MobileNav from "@/components/MobileNav";
import SignOutButton from "@/components/SignOutButton";
import type { AccountUser } from "@/lib/account";

function AppGridIcon() {
  return (
    <span className="grid grid-cols-3 gap-[3px] p-1.5">
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className="h-[3px] w-[3px] rounded-full bg-current" />
      ))}
    </span>
  );
}

export default function AccountShell({
  active,
  user,
  children,
}: {
  active: string;
  user: AccountUser;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2">
          <MobileNav active={active} />
          <img
            src="/img/logo.png"
            alt=""
            className="h-10 w-10 rounded-xl"
          />
          <h1 className="text-[20px] font-medium tracking-tight md:text-[22px]">
            Yavqo Account
          </h1>
        </div>
        <div className="flex items-center gap-1 md:gap-3">
          <button
            type="button"
            aria-label="Help"
            className="rounded-full p-2 transition-colors hover:bg-white/10"
          >
            <CircleHelp size={20} />
          </button>
          <button
            type="button"
            aria-label="Yavqo apps"
            className="hidden rounded-full p-2 transition-colors hover:bg-white/10 sm:block"
          >
            <AppGridIcon />
          </button>
          <SignOutButton />
          <Avatar
            avatarUrl={user.avatarUrl}
            initial={user.initial}
            className="h-8 w-8 text-[14px] font-medium"
          />
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-[240px] shrink-0 px-3 pt-4 md:block">
          <AccountNav active={active} />
        </aside>

        <main className="min-w-0 flex-1 px-4 md:px-6">{children}</main>
      </div>

      <footer className="flex flex-col gap-6 px-6 py-6 text-[12px] text-[#9aa0a6] md:flex-row md:items-start md:justify-between md:px-8">
        <div className="flex flex-col gap-3">
          <div className="flex gap-6">
            <a href="/privacy" className="hover:underline">
              Privacy
            </a>
            <a href="/terms" className="hover:underline">
              Terms
            </a>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:underline">
              Help
            </a>
            <a href="#" className="hover:underline">
              Info
            </a>
          </div>
        </div>
        <p className="max-w-[560px] leading-relaxed">
          Only you can see your settings. You can also review your settings
          for Yavqo Maps, Yavqo Search, and other Yavqo services you use.
          Yavqo treats your data confidentially and securely.{" "}
          <a href="#" className="underline">
            More information
          </a>{" "}
          <ShieldCheck
            size={16}
            className="inline text-[#8ab4f8]"
            aria-hidden="true"
          />
        </p>
      </footer>
    </div>
  );
}
