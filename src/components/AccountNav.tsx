import Link from "next/link";

const items = [
  { key: "overview", label: "Account overview", href: "/" },
  { key: "personal", label: "Personal information", href: "/personal" },
  { key: "personal-contact", label: "Contact information", href: "/personal/contact" },
  { key: "personal-photo", label: "Profile photo", href: "/personal/photo" },
  { key: "wallet", label: "Payment methods & subscriptions", href: "/wallet" },
  { key: "invoices", label: "Invoices", href: "/invoices" },
  { key: "yavqoid", label: "YavqoID", href: "/yavqoid" },
  { key: "yavqoid-find", label: "Find people", href: "/yavqoid/find" },
  { key: "family", label: "Family", href: "/family" },
  { key: "contacts", label: "Contacts & sharing", href: "/contacts" },
  { key: "tv-friends", label: "Yavqo TV friends", href: "/tv/friends" },
  { key: "security", label: "Password & security", href: "/security" },
  { key: "password", label: "Saved passwords", href: "/password" },
  { key: "apps", label: "Connected apps", href: "/apps" },
  { key: "storage", label: "Account storage", href: "/storage" },
  { key: "delete-account", label: "Delete account", href: "/account/delete" },
  { key: "privacy", label: "Data & privacy", href: "/privacy" },
  { key: "developers-oauth", label: "Developer credentials", href: "/developers/oauth" },
];

export default function AccountNav({ active }: { active: string }) {
  return (
    <nav className="account-nav" aria-label="Account settings">
      {items.map((item) => {
        const selected = active === item.key ||
          (item.key === "yavqoid" && active === "yavqoid-edit");
        return <Link key={item.key} href={item.href} aria-current={selected ? "page" : undefined}
          className="account-nav-link">{item.label}</Link>;
      })}
    </nav>
  );
}
