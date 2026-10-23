/* Smart PPE Check station: settings kept on this device (localStorage), PIN stored only as a salted SHA-256 hash. */
import { ITEMS, type ItemId } from '../mirror/checks'

export type Rotate = 0 | 90 | 180 | 270
export type KioskSettings = {
  title: string; subtitle: string; tagline: string; event: string
  width: number; height: number; rotate: Rotate
  flip: boolean          // show the camera as a mirror image (natural for someone standing in front of it)
  mirrorMode: boolean    // two-way-mirror build: no video, only bright boxes and text on pure black
  resultSeconds: number
  items: Record<ItemId, boolean>
}
export const KIOSK_DEFAULTS: KioskSettings = {
  title: 'Smart PPE Check', subtitle: 'اتأكد من واقياتك قبل ما تدخل', tagline: 'Check · Correct · Protect', event: '',
  width: 1280, height: 720, rotate: 0, flip: true, mirrorMode: false, resultSeconds: 8,
  items: { head: true, mask: true, gown: true, gloves: true },
}
export const RESOLUTIONS = [[640, 480], [1280, 720], [1920, 1080]] as const
export const ROTATIONS: Rotate[] = [0, 90, 180, 270]

const KEY = 'kiosk.settings', PIN_KEY = 'kiosk.pin', UNLOCK_KEY = 'kiosk.unlocked', TODAY_KEY = 'kiosk.today'
const get = (k: string, s: Storage = localStorage) => { try { return s.getItem(k) } catch { return null } }
const put = (k: string, v: string, s: Storage = localStorage) => { try { s.setItem(k, v) } catch { /* storage blocked */ } }

export function loadKiosk(): KioskSettings {
  try {
    const j = JSON.parse(get(KEY) || '{}')
    const d = KIOSK_DEFAULTS
    const str = (v: unknown, def: string, max: number) => (typeof v === 'string' ? v.slice(0, max) : def)
    const res = RESOLUTIONS.find(([w, h]) => w === j.width && h === j.height) || [d.width, d.height]
    const items = Object.fromEntries(ITEMS.map(k => [k, typeof j.items?.[k] === 'boolean' ? j.items[k] : true])) as Record<ItemId, boolean>
    if (!ITEMS.some(k => items[k])) ITEMS.forEach(k => { items[k] = true })   // at least one item is always checked
    return {
      title: str(j.title, d.title, 40) || d.title, subtitle: str(j.subtitle, d.subtitle, 80), tagline: str(j.tagline, d.tagline, 60), event: str(j.event, '', 80),
      width: res[0], height: res[1], rotate: ROTATIONS.includes(j.rotate) ? j.rotate : 0,
      flip: typeof j.flip === 'boolean' ? j.flip : d.flip, mirrorMode: j.mirrorMode === true,
      resultSeconds: Math.min(30, Math.max(3, Number(j.resultSeconds) || d.resultSeconds)), items,
    }
  } catch { return KIOSK_DEFAULTS }
}
export const saveKiosk = (s: KioskSettings) => put(KEY, JSON.stringify(s))
export const enabledItems = (s: KioskSettings) => ITEMS.filter(k => s.items[k])

/* ---------------- PIN ---------------- */
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('')
const digest = async (salt: string, pin: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pin)))

export const hasPin = () => !!get(PIN_KEY)
export async function setPin(pin: string) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer)
  put(PIN_KEY, JSON.stringify({ salt, hash: await digest(salt, pin) }))
}
export async function checkPin(pin: string) {
  try { const { salt, hash } = JSON.parse(get(PIN_KEY) || '{}'); return !!salt && (await digest(salt, pin)) === hash } catch { return false }
}
/** Unlocked for this browser tab only (also lets the calibration screen open without its own PIN). */
export const isUnlocked = () => get(UNLOCK_KEY, sessionStorage) === '1'
export const unlock = () => put(UNLOCK_KEY, '1', sessionStorage)

/* ---------------- «اتفحص النهارده» counter: last known value, shown while offline ---------------- */
const today = () => new Date().toLocaleDateString('en-CA')
export function cachedToday(): number | null {
  try { const j = JSON.parse(get(TODAY_KEY) || 'null'); return j && j.d === today() ? j.n : null } catch { return null }
}
export const cacheToday = (n: number) => put(TODAY_KEY, JSON.stringify({ d: today(), n }))
