"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import AccountNav from "@/components/AccountNav";

export default function MobileNav({ active }: { active: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Open navigation menu"
        onClick={() => setOpen(true)}
        className="rounded-full p-2 transition-colors hover:bg-white/10 md:hidden"
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] overflow-y-auto bg-[#202124] px-3 pb-8 pt-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between px-2">
              <span className="flex items-center gap-2">
                <img
                  src="/img/logo.png"
                  alt=""
                  className="h-9 w-9 rounded-[10px]"
                />
                <span className="text-[18px] font-medium tracking-tight">
                  Yavqo Account
                </span>
              </span>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 transition-colors hover:bg-white/10"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <AccountNav active={active} />
          </div>
        </div>
      )}
    </>
  );
}
