"use client";

import { useEffect } from "react";
import StatusScreen from "@/components/StatusScreen";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusScreen
      code="ERROR"
      title="This page couldn’t load"
      body={
        error.digest
          ? `A server error occurred. Reference ${error.digest}. Try again, or go back to your account.`
          : "A server error occurred. Try again, or go back to your account."
      }
      actions={
        <>
          <button
            type="button"
            onClick={() => reset()}
            className="flex h-10 items-center rounded-full bg-[#8ab4f8] px-5 text-[13px] font-medium text-[#202124] transition-opacity hover:opacity-90"
          >
            Try again
          </button>
          <a
            href="/"
            className="flex h-10 items-center rounded-full border border-[#5f6368] px-5 text-[13px] transition-colors hover:bg-white/5"
          >
            Go to your account
          </a>
        </>
      }
    />
  );
}
