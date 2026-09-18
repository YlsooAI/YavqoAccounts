import Link from "next/link";
import StatusScreen from "@/components/StatusScreen";

export default function NotFound() {
  return (
    <StatusScreen
      code="404"
      title="This page couldn’t be found"
      body="The address may be mistyped, or the page may have been moved or deleted."
      actions={
        <>
          <Link
            href="/"
            className="flex h-10 items-center rounded-full bg-[#8ab4f8] px-5 text-[13px] font-medium text-[#202124] transition-opacity hover:opacity-90"
          >
            Go to your account
          </Link>
          <Link
            href="/privacy"
            className="flex h-10 items-center rounded-full border border-[#5f6368] px-5 text-[13px] transition-colors hover:bg-white/5"
          >
            Help &amp; privacy
          </Link>
        </>
      }
    />
  );
}
