"use client";

import { useCallback, useState } from "react";
import {
  ChevronRight,
  Contact,
  Fingerprint,
  Folder,
  Image as ImageIcon,
  KeyRound,
  Network,
  Users,
} from "lucide-react";
import StorageDrive from "@/components/StorageDrive";
import StorageUsageCard from "@/components/StorageUsageCard";
import { formatBytes } from "@/lib/storageUsage";

const ICONS = {
  photo: ImageIcon,
  password: KeyRound,
  contacts: Contact,
  apps: Network,
  yavqoid: Fingerprint,
  family: Users,
} as const;

export type StaticBucket = {
  href?: string;
  icon: keyof typeof ICONS;
  color: string;
  title: string;
  items: string;
  bytes: number;
};

export default function StorageBoard({
  userId,
  otherBytes,
  initialDriveBytes,
  initialDriveCount,
  otherBuckets,
}: {
  userId: string;
  otherBytes: number;
  initialDriveBytes: number;
  initialDriveCount: number;
  otherBuckets: StaticBucket[];
}) {
  const [driveBytes, setDriveBytes] = useState(initialDriveBytes);
  const [driveCount, setDriveCount] = useState(initialDriveCount);

  const onUsageChange = useCallback((bytes: number, count: number) => {
    setDriveBytes(bytes);
    setDriveCount(count);
  }, []);

  return (
    <>
      <StorageUsageCard usedBytes={otherBytes + driveBytes} />
      <StorageDrive
        userId={userId}
        otherBytes={otherBytes}
        onUsageChange={onUsageChange}
      />
      <h3 className="mt-10 text-[15px] font-medium text-[#9aa0a6]">
        Storage breakdown
      </h3>
      <div className="mt-3 overflow-hidden rounded-2xl border border-[#3c4043]">
        <div className="flex items-center gap-4 border-b border-[#3c4043] bg-[#292a2d] px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#c58af9]">
            <Folder size={18} className="text-[#1f1f1f]" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px]">Files</span>
            <span className="block truncate text-[12px] text-[#9aa0a6]">
              {driveCount === 1 ? "1 file" : `${driveCount} files`}
            </span>
          </span>
          <span className="shrink-0 text-[13px] text-[#9aa0a6]">
            {formatBytes(driveBytes)}
          </span>
        </div>
        {otherBuckets.map((bucket) => {
          const Icon = ICONS[bucket.icon] ?? Folder;
          const inner = (
            <>
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: bucket.color }}
              >
                <Icon size={18} className="text-[#1f1f1f]" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px]">{bucket.title}</span>
                <span className="block truncate text-[12px] text-[#9aa0a6]">
                  {bucket.items}
                </span>
              </span>
              <span className="shrink-0 text-[13px] text-[#9aa0a6]">
                {formatBytes(bucket.bytes)}
              </span>
              {bucket.href ? (
                <ChevronRight
                  size={16}
                  className="shrink-0 text-[#9aa0a6]"
                  aria-hidden="true"
                />
              ) : null}
            </>
          );
          return bucket.href ? (
            <a
              key={bucket.title}
              href={bucket.href}
              className="flex items-center gap-4 border-b border-[#3c4043] bg-[#292a2d] px-5 py-4 last:border-b-0 transition-colors hover:bg-white/5"
            >
              {inner}
            </a>
          ) : (
            <div
              key={bucket.title}
              className="flex items-center gap-4 border-b border-[#3c4043] bg-[#292a2d] px-5 py-4 last:border-b-0"
            >
              {inner}
            </div>
          );
        })}
      </div>
    </>
  );
}
