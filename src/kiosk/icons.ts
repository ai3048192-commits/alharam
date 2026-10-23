/* Original, simple icons for the station and the printed signs (no logos, no copied artwork). */
import type { ItemId } from '../mirror/checks'

const S = 'stroke="#0B1F44" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"'
const EYES = (y: number) => `<circle cx="25" cy="${y}" r="2" fill="#0B1F44"/><circle cx="39" cy="${y}" r="2" fill="#0B1F44"/>`

export const PPE_ICON: Record<ItemId, string> = {
  // bouffant cap with an elastic scalloped edge
  head: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="38" r="17" fill="#FFD9B8" ${S}/><path d="M12 34c0-14 9-22 20-22s20 8 20 22z" fill="#9CC3E6" ${S}/><path d="M12 34q2.5 3 5 0t5 0 5 0 5 0 5 0 5 0 5 0 5 0" fill="none" ${S}/>${EYES(42)}</svg>`,
  // surgical mask over nose and mouth, ear loops
  mask: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="21" fill="#FFD9B8" ${S}/>${EYES(25)}<path d="M15 34q-5-2-4-9M49 34q5-2 4-9" fill="none" ${S}/><rect x="15" y="29" width="34" height="19" rx="8" fill="#7CB6E8" ${S}/><path d="M20 35h24M20 41h24" fill="none" ${S}/></svg>`,
  // long-sleeved isolation gown
  gown: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M23 8h18l7 7 11 23-7 4-8-15v30H20V27l-8 15-7-4 11-23z" fill="#FFE27A" ${S}/><path d="M27 8q5 6 10 0" fill="none" ${S}/><path d="M32 16v38" fill="none" ${S} stroke-dasharray="2 4"/></svg>`,
  // nitrile glove
  gloves: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M21 59V39l-7-11a4 4 0 0 1 6.5-4.6L25 30V13a4 4 0 0 1 8 0v15V10a4 4 0 0 1 8 0v18V14a4 4 0 0 1 8 0v26c0 11-6 19-15 19z" fill="#8FA8F2" ${S}/><path d="M21 52h28" fill="none" ${S}/></svg>`,
}

export const PLAY_ICON = `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" fill="#FFC93C"/><path d="M26 19l20 13-20 13z" fill="#0B1F44"/></svg>`
export const STEP_ICON = {
  stand: `<svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="22" cy="40" rx="7" ry="15" fill="currentColor"/><ellipse cx="42" cy="40" rx="7" ry="15" fill="currentColor"/></svg>`,
  check: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="28" cy="28" r="16" fill="none" stroke="currentColor" stroke-width="6"/><path d="M40 40l14 14" stroke="currentColor" stroke-width="7" stroke-linecap="round"/></svg>`,
  go: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 33l12 12 24-26" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
}

/** One footprint (sole + heel); `flip` draws the other foot. */
export const footprint = (fill: string, flip = false) =>
  `<svg viewBox="0 0 60 130" aria-hidden="true"${flip ? ' style="transform:scaleX(-1)"' : ''}><path d="M30 4c15 0 24 16 24 36 0 17-6 27-9 37-2 6-6 9-15 9s-14-4-15-11C13 64 6 55 6 38 6 18 15 4 30 4z" fill="${fill}"/><ellipse cx="30" cy="110" rx="16" ry="17" fill="${fill}"/></svg>`
