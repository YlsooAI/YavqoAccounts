import Link from "next/link";
import { ChevronDown } from "lucide-react";

const groups = [
  { title: "Account", items: [
    { key: "overview", label: "Account overview", href: "/" },
    { key: "personal", label: "Personal information", href: "/personal" },
    { key: "personal-contact", label: "Contact information", href: "/personal/contact" },
    { key: "personal-photo", label: "Profile photo", href: "/personal/photo" },
    { key: "addresses", label: "Saved addresses", href: "/addresses" },
  ] },
  { title: "Billing", items: [
    { key: "wallet", label: "Payment methods & subscriptions", href: "/wallet" },
    { key: "invoices", label: "Invoices", href: "/invoices" },
  ] },
  { title: "Social & family", items: [
    { key: "yavqoid-find", label: "Find people", href: "/yavqoid/find" },
    { key: "family", label: "Family", href: "/family" },
    { key: "contacts", label: "Contacts & sharing", href: "/contacts" },
    { key: "tv-friends", label: "Yavqo TV friends", href: "/tv/friends" },
  ] },
  { title: "Security", items: [
    { key: "security", label: "Password & security", href: "/security" },
    { key: "password", label: "Saved passwords", href: "/password" },
    { key: "apps", label: "Connected apps", href: "/apps" },
  ] },
  { title: "Preferences", items: [
    { key: "notifications", label: "Notifications", href: "/notifications" },
    { key: "preferences", label: "Preferences", href: "/preferences" },
    { key: "storage", label: "Account storage", href: "/storage" },
  ] },
  { title: "Privacy & data", items: [
    { key: "privacy", label: "Data & privacy", href: "/privacy" },
    { key: "delete-account", label: "Delete account", href: "/account/delete" },
  ] },
  { title: "Developer", items: [
    { key: "developers-oauth", label: "Developer credentials", href: "/developers/oauth" },
  ] },
];

export default function AccountNav({ active }: { active: string }) {
  return (
    <nav className="account-nav" aria-label="Account settings">
      {groups.map((group) => {
        const hasActivePage = group.items.some((item) => item.key === active);
        return (
          <details key={`${group.title}-${hasActivePage}`} className="account-nav-group" open={hasActivePage}>
            <summary className="account-nav-heading">
              <span>{group.title}</span>
              <ChevronDown size={18} aria-hidden="true" />
            </summary>
            <div className="account-nav-items">
              {group.items.map((item) => (
                <Link key={item.key} href={item.href} aria-current={active === item.key ? "page" : undefined} className="account-nav-link">
                  {item.label}
                </Link>
              ))}
            </div>
          </details>
        );
      })}
    </nav>
  );
}
