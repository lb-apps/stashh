function stripTrailingSlash(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function normalizeInstagramSourceUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  parsed.protocol = "https:";
  parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
  parsed.pathname = stripTrailingSlash(parsed.pathname);
  parsed.hash = "";

  // Keep only the route path; query params such as igsh are tracking-only.
  parsed.search = "";

  return parsed.toString();
}

