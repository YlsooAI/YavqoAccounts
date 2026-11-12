import { signBackchannelLogoutToken } from "@/lib/oauth";

function isPrivateOrLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "::1" ||
    host === "::"
  ) {
    return true;
  }
  if (/^fc00:|^fd[0-9a-f]{2}:|^fe80:/i.test(host)) {
    return true;
  }
  const ipv4Match = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const [a, b] = [Number(ipv4Match[1]), Number(ipv4Match[2])];
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    ) {
      return true;
    }
  }
  return false;
}

export function isSafeBackchannelUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }

  const allowDevHttp = process.env.NODE_ENV !== "production";
  if (parsed.protocol === "https:") {
    return allowDevHttp || !isPrivateOrLocalHostname(parsed.hostname);
  }
  if (
    allowDevHttp &&
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
  ) {
    return true;
  }
  return false;
}

export async function dispatchBackchannelLogout({
  uri,
  issuer,
  clientId,
  userId,
  authorizationId,
}: {
  uri: string | null | undefined;
  issuer: string;
  clientId: string;
  userId: string;
  authorizationId?: string;
}): Promise<{ ok: boolean; status?: number }> {
  if (!uri || !isSafeBackchannelUrl(uri)) {
    return { ok: false };
  }

  try {
    const logoutToken = signBackchannelLogoutToken(
      issuer,
      clientId,
      userId,
      authorizationId
    );
    const response = await fetch(uri, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ logout_token: logoutToken }).toString(),
      redirect: "manual",
      signal: AbortSignal.timeout(4000),
    });
    return { ok: response.ok, status: response.status };
  } catch (error) {
    console.warn("Back-channel logout failed for", clientId, error);
    return { ok: false };
  }
}
