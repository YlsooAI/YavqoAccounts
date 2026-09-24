"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { CircleUserRound, Menu, X } from "lucide-react";
import AccountNav from "@/components/AccountNav";
import Avatar from "@/components/Avatar";
import MobileNav from "@/components/MobileNav";
import SignOutButton from "@/components/SignOutButton";
import type { AccountUser } from "@/lib/account";
import RememberCurrentAccount from "@/components/RememberCurrentAccount";

export default function AccountShell({ active, user, children }: {
  active: string; user: AccountUser; children: ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  return (
    <div className={`account-shell${sidebarOpen ? "" : " sidebar-collapsed"}${active === "overview" ? " account-shell-overview" : ""}`}>
      <RememberCurrentAccount id={user.id} name={user.displayName} email={user.email} avatarUrl={user.avatarUrl} />
      <a href="#account-content" className="account-skip">Skip to content</a>
      <header className="account-header">
        <button
          type="button"
          onClick={() => setSidebarOpen((open) => !open)}
          aria-expanded={sidebarOpen}
          aria-controls="account-sidebar"
          aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          className="account-sidebar-toggle"
        >
          {sidebarOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
        <Link href="/" className="account-brand" aria-label="Yavqo Account home">
          <img src="/img/logo.png" alt="" width={28} height={28} />
          <span>Yavqo</span>
        </Link>
        <nav className="account-header-links" aria-label="Yavqo">
          <Link href="/yavqoid">YavqoID</Link>
          <Link href="/tv/friends">Yavqo TV</Link>
          <Link href="/wallet">Wallet & subscriptions</Link>
        </nav>
        <div className="account-header-end">
          <Link href="/developers/oauth" className="account-developer-link">Developers</Link>
          <Link href="/accounts" aria-label="Switch account" title="Switch account">
            <Avatar avatarUrl={user.avatarUrl} initial={user.initial} className="h-8 w-8 text-sm" />
          </Link>
        </div>
      </header>
      <MobileNav
        active={active}
        name={user.displayName}
        email={user.email}
        avatarUrl={user.avatarUrl}
        initial={user.initial}
      />
      <div className="account-layout">
        <aside id="account-sidebar" className="account-sidebar">
          <AccountNav active={active} />
          <div className="account-sidebar-footer">
            <Link href="/security" className="account-centre-link">
              <CircleUserRound size={20} aria-hidden="true" /> Account centre
            </Link>
            <p>Password, security, personal details, and preferences. All in one place.</p>
            <div className="account-signout">
              <SignOutButton
                name={user.displayName}
                email={user.email}
                avatarUrl={user.avatarUrl}
                initial={user.initial}
              />
            </div>
            <div className="account-legal"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div>
          </div>
        </aside>
        <main id="account-content" className="account-content" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
