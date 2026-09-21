import Avatar from "@/components/Avatar";
import type { RememberedAccount } from "@/lib/remembered-accounts";

export default function SwitchingAccountModal({
  account,
}: {
  account: RememberedAccount;
}) {
  return (
    <div className="switching-overlay" role="status">
      <div className="switching-modal">
        <span className="switching-spinner" aria-hidden="true" />
        <h2>Switching Account</h2>
        <div className="switching-account">
          <Avatar
            avatarUrl={account.avatarUrl}
            initial={(account.name[0] ?? "Y").toUpperCase()}
            className="h-14 w-14 shrink-0 text-xl"
          />
          <span className="switching-account-label">
            <span>{account.name}</span>
            <span className="switching-account-email">{account.maskedEmail}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
