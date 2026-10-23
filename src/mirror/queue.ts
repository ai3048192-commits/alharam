/* Mirror results that couldn't be sent (no internet) wait on this device and are sent once the connection is back.
   Only the item states are stored, never an image. */
import { rpc } from '../lib/supabase'
import { isNetworkError } from '../lib/content'
import type { ItemId, State } from './checks'

/** An item switched off on the station is sent as null. source 'kiosk' rows have no player (anonymous station). */
type Pending = Record<ItemId, State | null> & { source?: 'app' | 'kiosk'; event?: string | null }
const KEY = 'mirror.pending'
const MAX = 50

const read = (): Pending[] => { try { const j = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(j) ? j : [] } catch { return [] } }
const write = (l: Pending[]) => { try { if (l.length) localStorage.setItem(KEY, JSON.stringify(l.slice(-MAX))); else localStorage.removeItem(KEY) } catch { /* storage blocked */ } }
const send = (r: Pending) => rpc('save_mirror_check', {
  p_mask: r.mask, p_gown: r.gown, p_gloves: r.gloves, p_head: r.head ?? null, p_source: r.source || 'app', p_event: r.event ?? null,
})
// worth retrying later: no connection, or the sign-in couldn't be refreshed while offline
const later = (e: unknown) => isNetworkError(e) || /not_signed_in|JWT|permission denied/i.test(String((e as Error)?.message))

export type SaveResult = 'saved' | 'queued' | 'skipped' | 'failed'

/** saved · queued (no internet, sent later) · skipped (no name/department on this device) · failed */
export async function saveResult(r: Pending): Promise<SaveResult> {
  try { await send(r); void flushPending(); return 'saved' } catch (e) {
    if (later(e)) { write([...read(), r]); return 'queued' }
    return String((e as Error)?.message).includes('no_profile') ? 'skipped' : 'failed'
  }
}

let flushing = false
/** Send whatever is waiting, oldest first; stops at the first connection problem. */
export async function flushPending() {
  if (flushing || !navigator.onLine || !read().length) return
  flushing = true
  try {
    while (read().length) {
      try { await send(read()[0]) } catch (e) { if (later(e)) break }   // any other error (e.g. no profile): drop that one
      write(read().slice(1))   // new results are only ever appended, so the first one is the one just handled
    }
  } finally { flushing = false }
}
