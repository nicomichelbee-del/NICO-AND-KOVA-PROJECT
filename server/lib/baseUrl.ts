// Normalize a raw base URL so we never emit malformed links (e.g. "http://kickriq.com//").
// Strips trailing slashes and upgrades http→https for non-localhost hosts, since
// PUBLIC_BASE_URL on Render has been set incorrectly in the past and broke the sitemap.
export function normalizeBaseUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, '')
  if (/^http:\/\/(?!localhost|127\.0\.0\.1)/.test(url)) {
    url = url.replace(/^http:\/\//, 'https://')
  }
  return url
}
