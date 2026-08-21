import Link from "next/link";
import { Fingerprint } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-[#4f46e5] via-[#8b5cf6] to-[#06b6d4]">
        <Fingerprint size={30} className="text-white" aria-hidden="true" />
      </span>
      <h1 className="mt-6 text-[28px] font-normal">Page not found</h1>
      <p className="mt-2 max-w-sm text-[14px] text-[#9aa0a6]">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-full bg-[#8ab4f8] px-6 py-2.5 text-[13px] font-medium text-[#202124] transition-opacity hover:opacity-90"
      >
        Go to your Yavqo Account
      </Link>
    </div>
  );
}
