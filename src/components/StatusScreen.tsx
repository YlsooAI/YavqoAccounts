import type { ReactNode } from "react";

export default function StatusScreen({
  code,
  title,
  body,
  actions,
}: {
  code: string;
  title: string;
  body: string;
  actions: ReactNode;
}) {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="w-full max-w-[440px] rounded-2xl bg-[#292a2d] p-8 text-center">
        <img
          src="/img/logo.png"
          alt="Yavqo"
          className="mx-auto h-16 w-16 rounded-2xl"
        />
        <p className="mt-5 text-[13px] font-medium tracking-[0.18em] text-[#8ab4f8]">
          {code}
        </p>
        <h1 className="mt-2 text-[24px] font-normal">{title}</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-[#9aa0a6]">{body}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {actions}
        </div>
      </div>
    </main>
  );
}
