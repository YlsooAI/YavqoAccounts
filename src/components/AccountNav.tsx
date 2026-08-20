"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ChevronDown,
  Cloud,
  Contact,
  Fingerprint,
  Home,
  IdCard,
  Image as ImageIcon,
  KeyRound,
  Lock,
  Mail,
  Network,
  Package,
  Pencil,
  ToggleLeft,
  Tv,
  User,
  UserSearch,
  Users,
  Wallet,
} from "lucide-react";

type NavNode = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  color?: string;
  children?: NavNode[];
};

const navItems: NavNode[] = [
  { key: "overview", label: "Overview", href: "/", icon: Home, color: "#8ab4f8" },
  {
    key: "yavqoid",
    label: "YavqoID",
    href: "/yavqoid",
    icon: Fingerprint,
    color: "#8b5cf6",
    children: [
      { key: "yavqoid", label: "My YavqoID", href: "/yavqoid", icon: Fingerprint },
      {
        key: "yavqoid-find",
        label: "Find people",
        href: "/yavqoid/find",
        icon: UserSearch,
      },
      {
        key: "yavqoid-edit",
        label: "Edit",
        href: "/yavqoid/edit",
        icon: Pencil,
      },
    ],
  },
  {
    key: "products",
    label: "Products",
    href: "#",
    icon: Package,
    color: "#c58af9",
    children: [
      {
        key: "yavqo-tv",
        label: "YavqoTV",
        href: "#",
        icon: Tv,
        children: [
          { key: "tv-friends", label: "Friends", href: "/tv/friends", icon: Users },
        ],
      },
    ],
  },
  { key: "family", label: "Family", href: "/family", icon: Users, color: "#8ab4f8" },
  {
    key: "wallet",
    label: "Yavqo Wallet & Subscriptions",
    href: "/wallet",
    icon: Wallet,
    color: "#c58af9",
  },
  {
    key: "personal",
    label: "Personal info",
    href: "/personal",
    icon: IdCard,
    color: "#81c995",
    children: [
      { key: "personal", label: "Basic info", href: "/personal", icon: User },
      {
        key: "personal-contact",
        label: "Contact info",
        href: "/personal/contact",
        icon: Mail,
      },
      {
        key: "personal-photo",
        label: "Photo",
        href: "/personal/photo",
        icon: ImageIcon,
      },
    ],
  },
  { key: "security", label: "Security & sign-in", href: "/security", icon: Lock, color: "#8ab4f8" },
  { key: "password", label: "Yavqo Password", href: "/password", icon: KeyRound, color: "#8ab4f8" },
  { key: "apps", label: "Connected apps", href: "#", icon: Network, color: "#8ab4f8" },
  { key: "privacy", label: "Data & privacy", href: "/privacy", icon: ToggleLeft, color: "#fcad70" },
  { key: "contacts", label: "Contacts & sharing", href: "/contacts", icon: Contact, color: "#ff8bcb" },
  { key: "storage", label: "Account storage", href: "#", icon: Cloud, color: "#c58af9" },
];

// Returns the keys of all ancestors of the node with `key`, so groups
// containing the active page start expanded.
function findOpenKeys(nodes: NavNode[], key: string, trail: string[] = []): string[] | null {
  for (const node of nodes) {
    if (node.key === key && !node.children) return trail;
    if (node.children) {
      const found = findOpenKeys(node.children, key, [...trail, node.key]);
      if (found) return found;
    }
  }
  return null;
}

export default function AccountNav({ active }: { active: string }) {
  const [openGroups, setOpenGroups] = useState<string[]>(
    () => findOpenKeys(navItems, active) ?? []
  );

  function toggleGroup(key: string) {
    setOpenGroups((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function renderNodes(nodes: NavNode[], depth: number) {
    return nodes.map((node) => {
      const hasChildren = Boolean(node.children?.length);
      const isOpen = openGroups.includes(node.key);
      const isActive = active === node.key && !hasChildren;
      const isTop = depth === 0;

      return (
        <div key={node.key}>
          <div
            className={`flex items-center rounded-full ${
              isActive ? "bg-[#14344f]" : "transition-colors hover:bg-white/5"
            }`}
          >
            {isTop ? (
              node.href === "#" ? (
                <span className="flex min-w-0 flex-1 items-center gap-4 p-2 md:px-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: node.color }}
                  >
                    <node.icon
                      size={20}
                      strokeWidth={2}
                      className="text-[#1f1f1f]"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="text-[13px] leading-tight">
                    {node.label}
                  </span>
                </span>
              ) : (
                <a
                  href={node.href}
                  aria-current={isActive ? "page" : undefined}
                  className="flex min-w-0 flex-1 items-center gap-4 p-2 md:px-3"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: node.color }}
                  >
                    <node.icon
                      size={20}
                      strokeWidth={2}
                      className="text-[#1f1f1f]"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="text-[13px] leading-tight">
                    {node.label}
                  </span>
                </a>
              )
            ) : hasChildren ? (
              <span className="flex min-w-0 flex-1 items-center gap-3 py-1.5 pl-3 pr-4">
                <node.icon
                  size={15}
                  className="shrink-0 text-[#9aa0a6]"
                  aria-hidden="true"
                />
                <span className="text-[13px]">{node.label}</span>
              </span>
            ) : (
              <a
                href={node.href}
                aria-current={isActive ? "page" : undefined}
                className="flex min-w-0 flex-1 items-center gap-3 py-1.5 pl-3 pr-4 text-[13px]"
              >
                <node.icon
                  size={15}
                  className="shrink-0 text-[#9aa0a6]"
                  aria-hidden="true"
                />
                {node.label}
              </a>
            )}

            {hasChildren && (
              <button
                type="button"
                aria-label={isOpen ? `Collapse ${node.label}` : `Expand ${node.label}`}
                aria-expanded={isOpen}
                onClick={() => toggleGroup(node.key)}
                className="mr-2 rounded-full p-2 text-[#9aa0a6] transition-colors hover:bg-white/10 hover:text-white"
              >
                <ChevronDown
                  size={16}
                  aria-hidden="true"
                  className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
            )}
          </div>

          {hasChildren && isOpen && (
            <div
              className={
                isTop
                  ? "mt-1 flex flex-col gap-1 pl-[26px] md:pl-[30px]"
                  : "mt-1 flex flex-col gap-1 pl-4"
              }
            >
              {renderNodes(node.children!, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  }

  return <nav className="flex flex-col gap-1">{renderNodes(navItems, 0)}</nav>;
}
