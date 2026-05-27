function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export function getPublicAppUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredUrl) {
    return normalizeBaseUrl(configuredUrl);
  }

  if (typeof window !== "undefined" && window.location.origin) {
    const origin = window.location.origin;

    if (!/localhost|127\.0\.0\.1/i.test(origin)) {
      return normalizeBaseUrl(origin);
    }
  }

  if (process.env.VERCEL_URL) {
    return `https://${normalizeBaseUrl(process.env.VERCEL_URL)}`;
  }

  return "http://localhost:3000";
}

export function buildPublicAppPath(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getPublicAppUrl()}${normalizedPath}`;
}
