export function originFromUrl(raw: string): { siteUrl: string; siteHost: string } {
  const url = new URL(raw);
  return {
    siteUrl: url.origin,
    siteHost: url.hostname,
  };
}

export function faviconUrl(host: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
}
