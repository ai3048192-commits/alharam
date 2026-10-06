export type ShareData = { title: string; text: string; url: string }

export const appUrl = (path = '/') => window.location.origin + path

/** Native share sheet when available; returns false if the caller should show its own options. */
export async function nativeShare(d: ShareData): Promise<boolean> {
  if (typeof navigator !== 'undefined' && (navigator as any).share) {
    try { await (navigator as any).share(d); return true } catch (e: any) { if (e?.name === 'AbortError') return true }
  }
  return false
}
export const whatsappLink = (d: ShareData) => 'https://wa.me/?text=' + encodeURIComponent(`${d.text}\n${d.url}`)
export async function copyText(t: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(t); return true } catch { return false }
}
