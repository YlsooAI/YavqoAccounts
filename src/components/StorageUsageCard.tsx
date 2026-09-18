"use client";

import { ACCOUNT_QUOTA_BYTES, formatBytes } from "@/lib/storageUsage";

export default function StorageUsageCard({
  usedBytes,
}: {
  usedBytes: number;
}) {
  const used = Math.max(0, usedBytes);
  const percent = Math.min(100, (used / ACCOUNT_QUOTA_BYTES) * 100);
  const barWidth = used === 0 ? 0.6 : Math.max(percent, 1.2);

  return (
    <section className="mt-8 rounded-2xl border border-[#3c4043] bg-[#292a2d] p-6">
      <p className="text-[15px] font-medium">
        {formatBytes(used)} of {formatBytes(ACCOUNT_QUOTA_BYTES)} used
      </p>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#3c4043]">
        <div
          className="h-full rounded-full bg-[#c58af9] transition-[width] duration-300"
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <p className="mt-3 text-[12px] text-[#9aa0a6]">
        {percent < 1 && used > 0
          ? "Less than 1% of your storage is in use."
          : `${percent.toFixed(percent < 10 ? 1 : 0)}% of your storage is in use.`}
      </p>
    </section>
  );
}
