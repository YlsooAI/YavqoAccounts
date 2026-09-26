import { createHash } from "node:crypto";

const FROM = "Yavqo Accounts <accounts@emails.yavqo.com>";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

export async function sendOAuthAuthorizationEmail({
  to, clientName, siteHost, authorizationCode,
}: {
  to: string;
  clientName: string;
  siteHost: string;
  authorizationCode: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("OAuth notification skipped: RESEND_API_KEY is not configured");
    return;
  }

  const safeClientName = clientName.replace(/[\r\n]/g, " ").trim().slice(0, 120) || "An app";
  const app = escapeHtml(safeClientName);
  const host = escapeHtml(siteHost);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://accounts.yavqo.com";
  const manageUrl = new URL("/apps", baseUrl).toString();
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>New app connected to your Yavqo Account</title></head>
<body style="margin:0;padding:0;background:#f2f4f7;color:#1c2b33;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden">${app} was given access to your Yavqo Account.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f7"><tr><td align="center" style="padding:36px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e0e5eb;border-radius:20px">
<tr><td style="padding:36px 40px 22px;font-size:23px;font-weight:700;letter-spacing:-.5px">Yavqo<span style="color:#0866ff">.</span> <span style="font-size:14px;font-weight:400;color:#607080">Accounts</span></td></tr>
<tr><td style="padding:0 40px 36px"><p style="margin:0 0 12px;color:#64748b;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Account security</p>
<h1 style="margin:0 0 18px;font-size:28px;line-height:1.2;font-weight:600">A new app is connected</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.55">You authorized <strong>${app}</strong> to connect to your Yavqo Account.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;background:#f6f8fa;border-radius:12px"><tr><td style="padding:18px 20px;font-size:14px;line-height:1.7"><strong>App</strong><br>${app}<br><strong>Website</strong><br>${host}</td></tr></table>
<a href="${escapeHtml(manageUrl)}" style="display:inline-block;padding:14px 24px;border-radius:24px;background:#0866ff;color:#fff;font-size:15px;font-weight:700;text-decoration:none">Review connected apps</a>
<p style="margin:26px 0 0;color:#607080;font-size:14px;line-height:1.5">If you don't recognize this app, remove its access from Connected apps and review your account security.</p></td></tr></table>
<p style="max-width:560px;margin:18px 0 0;color:#748191;font-size:12px;line-height:1.5">This is a security notification from Yavqo Accounts.</p>
</td></tr></table></body></html>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `oauth-authorized/${createHash("sha256").update(authorizationCode).digest("hex")}`,
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject: `${safeClientName} was connected to your Yavqo Account`,
      html,
      text: `A new app is connected to your Yavqo Account.\n\nApp: ${safeClientName}\nWebsite: ${siteHost}\n\nReview connected apps: ${manageUrl}\n\nIf you don't recognize this app, remove its access and review your account security.`,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Resend returned ${response.status}`);
}
