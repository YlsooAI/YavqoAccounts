import Link from "next/link";
import { ChevronRight, CircleAlert, CircleCheck, Lock, LockOpen } from "lucide-react";
import {
  checkupItems,
  missingRequirements,
  PROTECTED_FEATURES,
  REQUIREMENTS,
  type ProtectedFeature,
  type SecurityStatus,
} from "@/lib/security-requirements";

export default function SecurityCheckupCard({ status }: { status: SecurityStatus }) {
  const items = checkupItems(status);
  const done = items.filter((item) => item.done).length;
  const requiredLeft = items.filter((item) => item.required && !item.done).length;
  const percent = Math.round((done / items.length) * 100);

  return (
    <section className="mt-8 rounded-2xl border border-[#3c4043] px-6" aria-labelledby="security-checkup-title">
      <div className="border-b border-[#3c4043] py-4">
        <h3 id="security-checkup-title" className="text-[16px]">Security checkup</h3>
        <p className="mt-1 text-[13px] text-[#9aa0a6]">
          {requiredLeft > 0
            ? `${requiredLeft} required ${requiredLeft === 1 ? "step is" : "steps are"} left. Some features stay locked until you finish them.`
            : done === items.length
              ? "Your account has every recommended protection."
              : "Required steps are done. Finish the recommended ones for extra protection."}
        </p>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#3c4043]"
          role="progressbar"
          aria-label="Security checkup progress"
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-valuenow={done}
        >
          <div
            className={`h-full rounded-full ${requiredLeft > 0 ? "bg-[#fdd663]" : "bg-[#81c995]"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <ul>
        {items.map((item) => (
          <li key={item.key} className="border-b border-[#3c4043]">
            <Link href={item.href} className="flex items-center gap-3 py-3.5 transition-opacity hover:opacity-80">
              {item.done ? (
                <CircleCheck size={18} className="shrink-0 text-[#81c995]" aria-hidden="true" />
              ) : (
                <CircleAlert size={18} className={`shrink-0 ${item.required ? "text-[#fdd663]" : "text-[#9aa0a6]"}`} aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1 text-[14px]">
                {item.label}
                <span className="sr-only">{item.done ? " — done" : " — not done"}</span>
              </span>
              <span className="text-[12px] text-[#9aa0a6]">{item.required ? "Required" : "Recommended"}</span>
              <ChevronRight size={16} className="shrink-0 text-[#9aa0a6]" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>

      <div className="py-4">
        <p className="text-[13px] font-medium">Protected features</p>
        <ul className="mt-2 grid gap-2">
          {(Object.keys(PROTECTED_FEATURES) as ProtectedFeature[]).map((feature) => {
            const missing = missingRequirements(status, feature).filter(
              (requirement) => requirement !== "recent-verification"
            );
            const unlocked = missing.length === 0;
            return (
              <li key={feature}>
                <Link href={PROTECTED_FEATURES[feature].href} className="flex items-center gap-2 text-[13px] hover:underline">
                  {unlocked ? (
                    <LockOpen size={15} className="shrink-0 text-[#81c995]" aria-hidden="true" />
                  ) : (
                    <Lock size={15} className="shrink-0 text-[#fdd663]" aria-hidden="true" />
                  )}
                  <span>{PROTECTED_FEATURES[feature].title}</span>
                  <span className="text-[#9aa0a6]">
                    {unlocked
                      ? PROTECTED_FEATURES[feature].requires.includes("recent-verification")
                        ? "· Available after a quick code check"
                        : "· Available"
                      : `· Locked: ${REQUIREMENTS[missing[0]].label.toLowerCase()}`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
