import type { ReactNode } from "react";
import LockedFeature from "@/components/LockedFeature";
import {
  missingRequirements,
  type ProtectedFeature,
  type SecurityRequirement,
  type SecurityStatus,
} from "@/lib/security-requirements";

// Renders the feature only when the security checkup requirements it
// depends on are met; otherwise explains what is missing. Pass `heading`
// when the gate wraps a whole page so the locked state keeps its title.
export default function SecurityGate({ feature, status, heading, children }: {
  feature: ProtectedFeature;
  status: SecurityStatus | null;
  heading?: string;
  children: ReactNode;
}) {
  const missing: SecurityRequirement[] = status
    ? missingRequirements(status, feature)
    : ["two-step"];
  if (missing.length === 0) return children;

  const locked = (
    <LockedFeature
      feature={feature}
      missing={missing}
      totpFactorId={status?.totpFactorId ?? null}
    />
  );
  if (!heading) return locked;
  return (
    <div className="mx-auto max-w-[660px] pb-16 pt-6 md:pt-10">
      <h2 className="text-[24px] font-normal">{heading}</h2>
      {locked}
    </div>
  );
}
