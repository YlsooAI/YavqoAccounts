import { CircleCheck, CircleAlert } from "lucide-react";
import AccountShell from "@/components/AccountShell";
import ChangePasswordCard from "@/components/ChangePasswordCard";
import ResendVerificationButton from "@/components/ResendVerificationButton";
import TwoStepVerificationCard from "@/components/TwoStepVerificationCard";
import SecurityActivityCard from "@/components/SecurityActivityCard";
import SecurityCheckupCard from "@/components/SecurityCheckupCard";
import PasskeysCard from "@/components/PasskeysCard";
import { getAccountUser } from "@/lib/account";
import { getSecurityStatus } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function formatSignIn(iso: string | null): string {
  if (!iso) return "Unknown";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function SecurityPage() {
  const user = await getAccountUser("/security");
  const security = await getSecurityStatus(await createClient());

  return (
    <AccountShell active="security" user={user}>
      <div className="mx-auto max-w-[660px] pt-6 md:pt-10">
        <h2 className="text-[24px] font-normal">Security &amp; sign-in</h2>
        <p className="mt-2 text-[13px] text-[#9aa0a6]">
          Control how you sign in to your Yavqo Account and keep it safe.
        </p>

        {security && <SecurityCheckupCard status={security} />}

        <section className="mt-6 rounded-2xl border border-[#3c4043] px-6">
          <h3 className="border-b border-[#3c4043] py-4 text-[16px]">
            How you sign in to Yavqo
          </h3>

          <ChangePasswordCard email={user.email} />

          <div id="two-step" className="scroll-mt-24 border-t border-[#3c4043]">
            <TwoStepVerificationCard />
          </div>

          {security?.passkeysAvailable && (
            <div className="border-t border-[#3c4043]">
              <PasskeysCard />
            </div>
          )}
        </section>

        <section id="account-status" className="mt-6 scroll-mt-24 rounded-2xl border border-[#3c4043] px-6">
          <h3 className="border-b border-[#3c4043] py-4 text-[16px]">
            Account status
          </h3>

          <div className="flex items-center justify-between gap-4 border-b border-[#3c4043] py-4">
            <div>
              <p className="text-[14px]">Email address</p>
              <p className="mt-0.5 text-[13px] text-[#9aa0a6]">{user.email}</p>
            </div>
            {user.emailConfirmed ? (
              <span className="flex items-center gap-1.5 text-[13px] text-[#81c995]">
                <CircleCheck size={16} aria-hidden="true" />
                Confirmed
              </span>
            ) : (
              <>
                <span className="flex items-center gap-1.5 text-[13px] text-[#fdd663]">
                  <CircleAlert size={16} aria-hidden="true" />
                  Not confirmed
                </span>
                <ResendVerificationButton email={user.email} />
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 py-4">
            <div>
              <p className="text-[14px]">Last sign-in</p>
              <p className="mt-0.5 text-[13px] text-[#9aa0a6]">
                On this device
              </p>
            </div>
            <span className="text-[13px] text-[#9aa0a6]">
              {formatSignIn(user.lastSignInAt)}
            </span>
          </div>
        </section>

        <SecurityActivityCard />

        <div className="h-10" />
      </div>
    </AccountShell>
  );
}
