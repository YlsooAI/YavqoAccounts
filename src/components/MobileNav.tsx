import { Menu } from "lucide-react";
import AccountNav from "@/components/AccountNav";
import SignOutButton from "@/components/SignOutButton";

export default function MobileNav({ active }: { active: string }) {
  return (
    <details className="account-mobile-nav">
      <summary><Menu size={20} aria-hidden="true" /> Account settings</summary>
      <div className="account-mobile-panel">
        <AccountNav active={active} />
        <SignOutButton />
      </div>
    </details>
  );
}
